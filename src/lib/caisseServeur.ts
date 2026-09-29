// Connecteurs de caisse (serveur uniquement : clé de service et secrets des clients).
//
// Les clés d'API des clients sont chiffrées en AES-256-GCM avant d'être stockées dans
// caisse_secrets. Clé de chiffrement : CAISSE_SECRET_KEY si définie, sinon dérivée de la clé de
// service Supabase (changer l'une ou l'autre oblige les clients à recoller leur clé).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Vente = { id_externe: string; vendu_at: string; montant_centimes: number; devise: string; moyen: string | null };
type Connecteur = {
  /** Vérifie la clé et renvoie l'identifiant du compte (n° marchand, emplacement). */
  verifier: (cle: string, identifiant: string | null) => Promise<string>;
  ventes: (cle: string, identifiant: string, depuis: Date) => Promise<Vente[]>;
};

const JOURS_INITIAUX = 60;
const MAX_PAGES = 60;

function cleChiffrement() {
  const base = process.env.CAISSE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Chiffrement indisponible");
  return createHash("sha256").update(`juliette-caisse:${base}`).digest();
}

export function chiffrer(texte: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cleChiffrement(), iv);
  const corps = Buffer.concat([c.update(texte, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corps]).toString("base64");
}

export function dechiffrer(b64: string) {
  const brut = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", cleChiffrement(), brut.subarray(0, 12));
  d.setAuthTag(brut.subarray(12, 28));
  return Buffer.concat([d.update(brut.subarray(28)), d.final()]).toString("utf8");
}

async function json(url: string, cle: string, entetes: Record<string, string> = {}) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${cle}`, Accept: "application/json", ...entetes }, cache: "no-store" });
  if (r.status === 401 || r.status === 403) throw new Error("Clé refusée par la caisse (vérifie-la ou recrée-la)");
  if (!r.ok) throw new Error(`La caisse a répondu ${r.status}`);
  return r.json();
}

const centimes = (euros: number) => Math.round(Number(euros) * 100);

// SumUp : https://developer.sumup.com/api/transactions
const sumup: Connecteur = {
  async verifier(cle) {
    const moi = await json("https://api.sumup.com/v0.1/me", cle);
    const code = moi?.merchant_profile?.merchant_code;
    if (!code) throw new Error("Compte SumUp introuvable pour cette clé");
    return String(code);
  },
  async ventes(cle, code, depuis) {
    const res: Vente[] = [];
    const base = `https://api.sumup.com/v2.1/merchants/${encodeURIComponent(code)}/`;
    let url: string | null = `${base}transactions/history?order=ascending&limit=100&statuses[]=SUCCESSFUL&types[]=PAYMENT&oldest_time=${encodeURIComponent(depuis.toISOString())}`;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const r = await json(url, cle);
      for (const t of (r.items ?? []) as { id: string; transaction_code?: string; amount: number; currency?: string; timestamp: string; payment_type?: string }[]) {
        res.push({ id_externe: String(t.id ?? t.transaction_code), vendu_at: t.timestamp, montant_centimes: centimes(t.amount), devise: t.currency ?? "EUR", moyen: t.payment_type ?? null });
      }
      const suivant = ((r.links ?? []) as { rel?: string; href?: string }[]).find((l) => l.rel === "next")?.href;
      url = suivant ? (suivant.startsWith("http") ? suivant : base + suivant.replace(/^\//, "")) : null;
    }
    return res;
  },
};

// Square : https://developer.squareup.com/reference/square/payments-api/list-payments
const SQUARE_VERSION = { "Square-Version": "2025-01-23" };
const square: Connecteur = {
  async verifier(cle, identifiant) {
    const r = await json("https://connect.squareup.com/v2/locations", cle, SQUARE_VERSION);
    const lieux = ((r.locations ?? []) as { id: string; status?: string }[]).filter((l) => l.status !== "INACTIVE");
    if (identifiant) {
      if (!lieux.some((l) => l.id === identifiant)) throw new Error("Emplacement Square introuvable pour ce jeton");
      return identifiant;
    }
    if (!lieux.length) throw new Error("Aucun point de vente actif sur ce compte Square");
    return lieux[0].id;
  },
  async ventes(cle, lieu, depuis) {
    const res: Vente[] = [];
    let curseur: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ begin_time: depuis.toISOString(), location_id: lieu, limit: "100", sort_order: "ASC" });
      if (curseur) q.set("cursor", curseur);
      const r = await json(`https://connect.squareup.com/v2/payments?${q}`, cle, SQUARE_VERSION);
      for (const p of (r.payments ?? []) as { id: string; status: string; created_at: string; amount_money?: { amount: number; currency: string }; refunded_money?: { amount: number }; source_type?: string }[]) {
        if (p.status !== "COMPLETED" || !p.amount_money) continue;
        res.push({ id_externe: p.id, vendu_at: p.created_at, montant_centimes: p.amount_money.amount - (p.refunded_money?.amount ?? 0), devise: p.amount_money.currency, moyen: p.source_type ?? null });
      }
      curseur = r.cursor ?? null;
      if (!curseur) break;
    }
    return res;
  },
};

export const CONNECTEURS: Record<string, Connecteur> = { sumup, square };

/** Importe les ventes depuis la dernière synchro (avec 2 jours de recouvrement) ; idempotent. */
export async function synchroniser(admin: SupabaseClient, etablissementId: string) {
  const [{ data: cx }, { data: sec }] = await Promise.all([
    admin.from("caisse_connexions").select("logiciel, identifiant, derniere_synchro").eq("etablissement_id", etablissementId).maybeSingle(),
    admin.from("caisse_secrets").select("secret_chiffre").eq("etablissement_id", etablissementId).maybeSingle(),
  ]);
  const connecteur = cx && CONNECTEURS[cx.logiciel];
  if (!cx || !connecteur || !sec || !cx.identifiant) throw new Error("Aucune caisse connectée automatiquement");
  const depuis = cx.derniere_synchro ? new Date(new Date(cx.derniere_synchro).getTime() - 2 * 864e5) : new Date(Date.now() - JOURS_INITIAUX * 864e5);
  try {
    const ventes = await connecteur.ventes(dechiffrer(sec.secret_chiffre), cx.identifiant, depuis);
    for (let i = 0; i < ventes.length; i += 500) {
      const lot = ventes.slice(i, i + 500).map((v) => ({ ...v, etablissement_id: etablissementId, source: cx.logiciel }));
      const { error } = await admin.from("ventes_caisse").upsert(lot, { onConflict: "etablissement_id,source,id_externe" });
      if (error) throw new Error("Enregistrement des ventes impossible");
    }
    await admin.from("caisse_connexions").update({ statut: "connectee", derniere_synchro: new Date().toISOString(), derniere_erreur: null }).eq("etablissement_id", etablissementId);
    return ventes.length;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    await admin.from("caisse_connexions").update({ statut: "erreur", derniere_erreur: message.slice(0, 300) }).eq("etablissement_id", etablissementId);
    throw e;
  }
}
