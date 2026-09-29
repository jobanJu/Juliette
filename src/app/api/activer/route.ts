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

  // Une première tentative peut avoir créé le compte Auth avant d'échouer à la connexion
  // (par exemple si la confirmation e-mail était activée). Dans ce cas, réutilise-le et
  // confirme-le ici au lieu de dépendre d'un e-mail Supabase qui peut ne jamais arriver.
  const { error: erreurCreation } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (erreurCreation) {
    if (/password/i.test(erreurCreation.message)) {
      return NextResponse.json(
        { erreur: "Mot de passe trop faible : 8 caractères minimum, avec des lettres et des chiffres." },
        { status: 400 },
      );
    }
    if (!/already|registered|exists/i.test(erreurCreation.message)) {
      return NextResponse.json({ erreur: "Activation impossible pour le moment. Réessaie dans un instant." }, { status: 400 });
    }

    const parPage = 1000;
    let utilisateur: { id: string; email?: string } | null = null;
    for (let page = 1; page <= 10; page++) {
      const { data, error: erreurListe } = await admin.auth.admin.listUsers({ page, perPage: parPage });
      if (erreurListe) {
        return NextResponse.json({ erreur: "Activation impossible pour le moment. Réessaie dans un instant." }, { status: 503 });
      }
      utilisateur = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
      if (utilisateur || data.users.length < parPage) break;
    }
    if (!utilisateur) {
      return NextResponse.json({ erreur: "Activation impossible pour le moment. Réessaie dans un instant." }, { status: 503 });
    }

    const { error: erreurMaj } = await admin.auth.admin.updateUserById(utilisateur.id, {
      password: motDePasse,
      email_confirm: true,
    });
    if (erreurMaj) {
      const message = /password/i.test(erreurMaj.message)
        ? "Mot de passe trop faible : 8 caractères minimum, avec des lettres et des chiffres."
        : "Activation impossible pour le moment. Réessaie dans un instant.";
      return NextResponse.json({ erreur: message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
