// Abonnement Juliette avec Stripe : tarif, activation d'une souscription payée, suivi de l'abonnement.
// Serveur uniquement (clé secrète Stripe et clé de service Supabase).
//
// Variables d'environnement :
//   STRIPE_SECRET_KEY      clé secrète (sk_live_… ou sk_test_…)
//   STRIPE_WEBHOOK_SECRET  secret de signature du webhook (whsec_…)
//   STRIPE_PRICE_ID        prix récurrent de la formule (price_…)
//   STRIPE_ESSAI_JOURS     jours d'essai gratuit (14 par défaut, 0 pour aucun)

import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return null;
  if (!client) client = new Stripe(cle);
  return client;
}

export const joursEssai = () => {
  const n = Number(process.env.STRIPE_ESSAI_JOURS ?? 14);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 14;
};

export type Tarif = { montant: number; devise: string; intervalle: "month" | "year" | "week" | "day"; essaiJours: number };

let tarifCache: { tarif: Tarif; at: number } | null = null;

/** Prix de la formule, lu dans Stripe (mis en cache 10 minutes). */
export async function lireTarif(): Promise<Tarif | null> {
  const stripe = getStripe();
  const prix = process.env.STRIPE_PRICE_ID;
  if (!stripe || !prix) return null;
  if (tarifCache && Date.now() - tarifCache.at < 600_000) return tarifCache.tarif;
  const p = await stripe.prices.retrieve(prix);
  if (p.unit_amount == null || !p.recurring) return null;
  const tarif: Tarif = { montant: p.unit_amount / 100, devise: p.currency.toUpperCase(), intervalle: p.recurring.interval as Tarif["intervalle"], essaiJours: joursEssai() };
  tarifCache = { tarif, at: Date.now() };
  return tarif;
}

const date = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

/** Recopie l'état d'un abonnement Stripe dans la base, et suspend l'accès s'il n'est plus payé. */
export async function enregistrerAbonnement(admin: SupabaseClient, sub: Stripe.Subscription, etablissementId?: string) {
  let etab = etablissementId;
  if (!etab) {
    const { data } = await admin.from("abonnements").select("etablissement_id").eq("stripe_subscription_id", sub.id).maybeSingle();
    etab = data?.etablissement_id as string | undefined;
  }
  if (!etab) return;
  const finPeriode = sub.items.data.reduce<number | null>((m, it) => Math.max(m ?? 0, it.current_period_end), null);
  await admin.from("abonnements").upsert(
    {
      etablissement_id: etab,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      statut: sub.status,
      fin_essai: date(sub.trial_end),
      fin_periode: date(finPeriode),
      resiliation_prevue: sub.cancel_at_period_end || sub.cancel_at != null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "etablissement_id" },
  );

  // Accès coupé quand l'abonnement est terminé ou impayé ; rétabli dès qu'il repart.
  // Une suspension posée à la main dans la console (autre motif) n'est jamais levée ici.
  const bloque = sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired";
  const { data: adm } = await admin.from("etablissements_admin").select("suspendu, motif_suspension").eq("etablissement_id", etab).maybeSingle();
  const manuel = adm?.suspendu && adm.motif_suspension !== MOTIF_ABONNEMENT;
  if (!manuel) {
    await admin
      .from("etablissements_admin")
      .upsert({ etablissement_id: etab, suspendu: bloque, motif_suspension: bloque ? MOTIF_ABONNEMENT : null, formule: bloque ? "resilie" : sub.status === "trialing" ? "essai" : "abonnement", fin_essai: date(sub.trial_end)?.slice(0, 10) ?? null }, { onConflict: "etablissement_id" });
  }
}

export const MOTIF_ABONNEMENT = "Abonnement terminé ou impayé";

/**
 * Validation automatique : une fois la session de paiement terminée, crée l'établissement,
 * le compte directeur, confirme l'adresse e-mail et enregistre l'abonnement. Sans effet si déjà fait.
 */
export async function activerSouscription(admin: SupabaseClient, stripe: Stripe, session: Stripe.Checkout.Session): Promise<{ statut: "active" | "en_attente" | "erreur"; code?: string; etablissement?: string; message?: string }> {
  const id = session.client_reference_id ?? session.metadata?.souscription_id;
  if (!id) return { statut: "erreur", message: "Souscription introuvable" };
  const { data: s } = await admin.from("souscriptions").select("*").eq("id", id).maybeSingle();
  if (!s) return { statut: "erreur", message: "Souscription introuvable" };
  if (s.statut === "active") return { statut: "active", code: s.code, etablissement: s.etablissement_nom };
  if (session.status !== "complete") return { statut: "en_attente" };

  const sub = typeof session.subscription === "string" ? await stripe.subscriptions.retrieve(session.subscription) : session.subscription;
  const finEssai = sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10) : null;

  // Réservation atomique : si deux appels arrivent en même temps (webhook + page de confirmation),
  // un seul crée l'établissement.
  const { data: pris } = await admin.from("souscriptions").update({ statut: "active", activee_at: new Date().toISOString() }).eq("id", id).eq("statut", "en_attente").select("id").maybeSingle();
  if (!pris) {
    const { data: r } = await admin.from("souscriptions").select("statut, code, etablissement_nom, erreur").eq("id", id).single();
    return r?.statut === "active" ? { statut: "active", code: r.code, etablissement: r.etablissement_nom } : { statut: "erreur", message: r?.erreur ?? "Activation impossible" };
  }

  const { data: etabId, error } = await admin.rpc("creer_etablissement_pour", {
    p_user: s.auth_user_id,
    p_nom: s.etablissement_nom,
    p_ville: s.ville,
    p_pays: s.pays,
    p_prenom: s.prenom,
    p_nom_directeur: s.nom,
    p_code: s.code,
    p_fin_essai: finEssai,
  });
  if (error || !etabId) {
    await admin.from("souscriptions").update({ statut: "erreur", erreur: error?.message ?? "Création impossible" }).eq("id", id);
    return { statut: "erreur", message: "Le paiement est bien reçu, mais la création de l'établissement a échoué. L'équipe Juliette est prévenue et va finaliser ton inscription." };
  }
  await admin.auth.admin.updateUserById(s.auth_user_id, { email_confirm: true });
  await admin.from("souscriptions").update({ etablissement_id: etabId }).eq("id", id);
  if (sub) {
    await admin.from("abonnements").upsert({ etablissement_id: etabId, stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id, stripe_subscription_id: sub.id, statut: sub.status }, { onConflict: "etablissement_id" });
    await enregistrerAbonnement(admin, sub, etabId as string);
  }
  return { statut: "active", code: s.code, etablissement: s.etablissement_nom };
}
