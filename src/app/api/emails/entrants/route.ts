// Réception des e-mails (webhook du prestataire : Mailjet Parse API, Postmark inbound…).
//
// POST /api/emails/entrants?cle=<INBOUND_EMAIL_SECRET>
// Le prestataire transmet chaque message reçu sur le domaine INBOUND_EMAIL_DOMAIN. On retrouve
// l'établissement grâce au jeton de l'adresse, on rattache le fournisseur (expéditeur connu) et la
// commande (référence dans le sujet, sinon la dernière commande à ce fournisseur), on range les
// pièces jointes dans le bucket privé « emails », puis on enregistre le message.
//
// Écrit avec la clé de service : la clé secrète dans l'URL est la seule porte d'entrée.
// GET renvoie { configure, domaine } pour que l'interface affiche l'état de la boîte.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { jetonDepuisAdresse, nomFichierSur, normaliserEntrant, refCommande, refDepuisSujet } from "@/lib/boiteMail";

export const runtime = "nodejs";

const domaine = process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase() || null;
const secret = process.env.INBOUND_EMAIL_SECRET?.trim() || null;
const TAILLE_MAX_PJ = 20 * 1024 * 1024;

export async function GET() {
  return NextResponse.json({ configure: Boolean(domaine && secret && getSupabaseAdmin()), domaine });
}

function cleValide(recue: string | null) {
  if (!secret || !recue) return false;
  const a = Buffer.from(recue);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  if (!domaine || !secret || !admin) return NextResponse.json({ erreur: "non_configure" }, { status: 503 });
  const cle = new URL(request.url).searchParams.get("cle") ?? request.headers.get("x-juliette-cle");
  if (!cleValide(cle)) return NextResponse.json({ erreur: "interdit" }, { status: 401 });

  const brut = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const mail = brut && normaliserEntrant(brut);
  if (!mail) return NextResponse.json({ erreur: "format" }, { status: 400 });

  const jetons = [...new Set(mail.a.map((a) => jetonDepuisAdresse(a, domaine)).filter((j): j is string => !!j))];
  if (!jetons.length) return NextResponse.json({ ok: true, ignore: "destinataire_inconnu" });
  const { data: etabs } = await admin.from("etablissements").select("id, boite_mail_jeton").in("boite_mail_jeton", jetons);
  // Réponse 200 même si inconnu : le prestataire ne doit pas réessayer indéfiniment.
  if (!etabs?.length) return NextResponse.json({ ok: true, ignore: "etablissement_inconnu" });

  const enregistres: string[] = [];
  for (const etab of etabs) {
    const [{ data: fournisseurs }, { data: commandes }] = await Promise.all([
      admin.from("fournisseurs").select("id, email").eq("etablissement_id", etab.id).not("email", "is", null),
      admin
        .from("commandes_envoyees")
        .select("id, fournisseur_id, fournisseur_email, envoyee_at")
        .eq("etablissement_id", etab.id)
        .gte("envoyee_at", new Date(Date.now() - 90 * 864e5).toISOString())
        .order("envoyee_at", { ascending: false })
        .limit(300),
    ]);
    const fournisseur = (fournisseurs ?? []).find((f) => f.email?.trim().toLowerCase() === mail.deEmail);
    const ref = refDepuisSujet(mail.sujet);
    const commande =
      (ref && (commandes ?? []).find((c) => refCommande(c.id) === ref)) ||
      (commandes ?? []).find((c) => (fournisseur && c.fournisseur_id === fournisseur.id) || c.fournisseur_email?.trim().toLowerCase() === mail.deEmail);

    const { data: ligne, error } = await admin
      .from("emails_recus")
      .insert({
        etablissement_id: etab.id,
        de_email: mail.deEmail,
        de_nom: mail.deNom,
        a_email: mail.a[0] ?? null,
        sujet: mail.sujet.slice(0, 500),
        texte: mail.texte.slice(0, 200_000),
        html: mail.html?.slice(0, 500_000) ?? null,
        fournisseur_id: fournisseur?.id ?? commande?.fournisseur_id ?? null,
        commande_id: commande?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !ligne) continue;

    const pieces: { nom: string; type: string; taille: number; chemin: string }[] = [];
    for (const [i, pj] of mail.pieces.entries()) {
      const contenu = Buffer.from(pj.contenuBase64, "base64");
      if (!contenu.length || contenu.length > TAILLE_MAX_PJ) continue;
      const chemin = `${etab.id}/${ligne.id}/${i + 1}-${nomFichierSur(pj.nom)}`;
      const { error: e } = await admin.storage.from("emails").upload(chemin, contenu, { contentType: pj.type || "application/octet-stream", upsert: true });
      if (!e) pieces.push({ nom: pj.nom, type: pj.type, taille: contenu.length, chemin });
    }
    if (pieces.length) await admin.from("emails_recus").update({ pieces_jointes: pieces }).eq("id", ligne.id);
    enregistres.push(ligne.id);
  }
  return NextResponse.json({ ok: true, enregistres: enregistres.length });
}
