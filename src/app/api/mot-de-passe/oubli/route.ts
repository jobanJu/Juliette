// Mot de passe oublié : envoie un lien de réinitialisation par e-mail.
// POST { email } → toujours { ok: true }, qu'un compte existe ou non (on ne révèle pas qui est inscrit).
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { emailServiceConfigure, envoyerEmailService, gabaritEmail } from "@/lib/emailService";

export const runtime = "nodejs";

const MAX_PAR_HEURE = 3;

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 200) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ erreur: "email", message: "Adresse e-mail invalide." }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ erreur: "serveur" }, { status: 503 });

  // Limite par adresse, pour qu'on ne puisse pas inonder quelqu'un d'e-mails.
  const empreinte = createHash("sha256").update(email).digest("hex");
  const { count } = await admin.from("reinitialisations_mdp").select("id", { count: "exact", head: true }).eq("email_empreinte", empreinte).gte("created_at", new Date(Date.now() - 3600e3).toISOString());
  if ((count ?? 0) >= MAX_PAR_HEURE) return NextResponse.json({ ok: true });
  await admin.from("reinitialisations_mdp").insert({ email_empreinte: empreinte });

  const origine = new URL(request.url).origin;
  const destination = `${origine}/nouveau-mot-de-passe`;

  if (emailServiceConfigure()) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    // Adresse inconnue : même réponse, rien n'est envoyé.
    if (!error && data.properties?.hashed_token) {
      const lien = `${destination}?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
      const { html, texte } = gabaritEmail(
        "Choisis un nouveau mot de passe",
        ["Tu as demandé à réinitialiser le mot de passe de ton compte Juliette.", "Ce lien est valable une heure et ne fonctionne qu'une seule fois."],
        { texte: "Choisir un nouveau mot de passe", lien },
        "Si tu n'es pas à l'origine de cette demande, ignore cet e-mail : ton mot de passe actuel reste valable.",
      );
      await envoyerEmailService({ a: email, sujet: "Réinitialisation de ton mot de passe Juliette", texte, html });
    }
  } else {
    // Sans prestataire d'e-mail configuré : envoi par le service intégré de Supabase.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    await anon.auth.resetPasswordForEmail(email, { redirectTo: destination });
  }
  return NextResponse.json({ ok: true });
}
