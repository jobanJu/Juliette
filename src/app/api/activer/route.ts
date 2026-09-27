import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const motDePasse = typeof body?.motDePasse === "string" ? body.motDePasse : "";
  if (!code || !email || motDePasse.length < 8) {
    return NextResponse.json({ erreur: "Code, e-mail ou mot de passe invalide." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ erreur: "Activation indisponible pour le moment." }, { status: 503 });

  // L'invitation (code + adresse) autorise l'activation et la confirmation de l'adresse.
  const { data: etablissement } = await admin.from("etablissements").select("id").eq("code", code).maybeSingle();
  if (!etablissement) return NextResponse.json({ erreur: "Aucune invitation ne correspond à ce code et cet e-mail." }, { status: 400 });
  const { data: invitation } = await admin
    .from("comptes")
    .select("id")
    .eq("etablissement_id", etablissement.id)
    .eq("email", email)
    .eq("statut", "invite")
    .is("auth_user_id", null)
    .maybeSingle();
  if (!invitation) return NextResponse.json({ erreur: "Aucune invitation ne correspond à ce code et cet e-mail." }, { status: 400 });

  const { error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
  if (error) {
    const message = /password/i.test(error.message)
      ? "Mot de passe trop faible : 8 caractères minimum, avec des lettres et des chiffres."
      : /already|registered|exists/i.test(error.message)
        ? "Cet e-mail a déjà un compte Juliette : connecte-toi avec ton mot de passe habituel."
        : "Activation impossible pour le moment. Réessaie dans un instant.";
    return NextResponse.json({ erreur: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
