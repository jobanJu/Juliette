// Envoi automatique d'une commande fournisseur par e-mail (Resend).
//
// POST { commandeId } avec l'en-tête Authorization: Bearer <jeton de la session>.
// Toutes les lectures et écritures passent par la session de l'utilisateur : la RLS garantit qu'il
// est responsable ou directeur de l'établissement de la commande. Aucune clé de service ici.
//
// Sans RESEND_API_KEY / RESEND_FROM_EMAIL, répond 503 { erreur: "non_configure" } : l'application
// propose alors l'envoi depuis la messagerie de l'utilisateur.
// GET renvoie { configure } pour que l'interface sache quel bouton afficher.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { htmlCommande, sujetCommande, texteCommande } from "@/lib/emailCommande";
import type { LigneEmail } from "@/lib/emailCommande";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendCle = process.env.RESEND_API_KEY;
const expediteur = process.env.RESEND_FROM_EMAIL;

const configure = () => Boolean(resendCle && expediteur);

export async function GET() {
  return NextResponse.json({ configure: configure() });
}

export async function POST(request: Request) {
  if (!url || !cle) return NextResponse.json({ erreur: "serveur" }, { status: 500 });
  const jeton = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return NextResponse.json({ erreur: "non_connecte" }, { status: 401 });
  const { commandeId } = (await request.json().catch(() => ({}))) as { commandeId?: string };
  if (!commandeId) return NextResponse.json({ erreur: "commande_manquante" }, { status: 400 });

  const sb = createClient(url, cle, { global: { headers: { Authorization: `Bearer ${jeton}` } }, auth: { persistSession: false } });
  const { data: user } = await sb.auth.getUser(jeton);
  if (!user.user) return NextResponse.json({ erreur: "non_connecte" }, { status: 401 });

  const { data: cmd } = await sb
    .from("commandes_envoyees")
    .select("id, etablissement_id, fournisseur_id, fournisseur_nom, fournisseur_email, lignes, created_by, email_statut")
    .eq("id", commandeId)
    .maybeSingle();
  if (!cmd) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

  const { data: estManager } = await sb.rpc("est_manager_de", { p_etablissement_id: cmd.etablissement_id });
  if (!estManager) return NextResponse.json({ erreur: "interdit" }, { status: 403 });
  if (!configure()) return NextResponse.json({ erreur: "non_configure" }, { status: 503 });
  if (!cmd.fournisseur_email) return NextResponse.json({ erreur: "sans_email" }, { status: 422 });

  const [{ data: etab }, { data: auteur }] = await Promise.all([
    sb.from("etablissements").select("nom, adresse, telephone, email_contact").eq("id", cmd.etablissement_id).single(),
    sb.from("comptes").select("prenom, nom").eq("etablissement_id", cmd.etablissement_id).eq("auth_user_id", user.user.id).maybeSingle(),
  ]);
  const donnees = {
    etablissement: etab?.nom ?? "",
    adresse: etab?.adresse ?? null,
    telephone: etab?.telephone ?? null,
    fournisseur: cmd.fournisseur_nom,
    signataire: [auteur?.prenom, auteur?.nom].filter(Boolean).join(" ") || (etab?.nom ?? ""),
    date: new Date(),
    lignes: (cmd.lignes ?? []) as LigneEmail[],
  };

  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendCle}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: expediteur,
      to: [cmd.fournisseur_email],
      reply_to: etab?.email_contact || user.user.email || undefined,
      subject: sujetCommande(donnees),
      text: texteCommande(donnees),
      html: htmlCommande(donnees),
    }),
  }).catch(() => null);

  const corps = reponse ? ((await reponse.json().catch(() => ({}))) as { id?: string; message?: string }) : {};
  if (!reponse || !reponse.ok) {
    const message = corps.message ?? "Prestataire d'e-mail injoignable";
    await sb.from("commandes_envoyees").update({ email_statut: "echec", email_erreur: message.slice(0, 300) }).eq("id", cmd.id);
    return NextResponse.json({ erreur: "echec_envoi", message }, { status: 502 });
  }
  await sb.from("commandes_envoyees").update({ email_statut: "envoye", email_envoye_at: new Date().toISOString(), email_id: corps.id ?? null, email_erreur: null }).eq("id", cmd.id);
  return NextResponse.json({ ok: true, id: corps.id });
}
