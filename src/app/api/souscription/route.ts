// Souscription en ligne : crée le compte (non confirmé) et la demande, puis ouvre le paiement Stripe.
// POST { etablissement, ville, pays, code, prenom, nom, email, motDePasse }
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe, joursEssai } from "@/lib/stripeServeur";
import { VERSION_CONDITIONS } from "@/lib/editeur";

export const runtime = "nodejs";

const texte = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  const prix = process.env.STRIPE_PRICE_ID;
  if (!stripe || !admin || !prix) return NextResponse.json({ erreur: "indisponible", message: "La souscription en ligne n'est pas encore ouverte. Écris-nous pour démarrer." }, { status: 503 });

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const f = {
    etablissement: texte(b.etablissement),
    ville: texte(b.ville, 80),
    pays: b.pays === "BE" ? "BE" : "FR",
    code: texte(b.code, 20).normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
    prenom: texte(b.prenom, 60),
    nom: texte(b.nom, 60),
    email: texte(b.email, 200).toLowerCase(),
    motDePasse: typeof b.motDePasse === "string" ? b.motDePasse : "",
  };
  if (!f.etablissement || !f.prenom || !f.nom) return NextResponse.json({ erreur: "champs", message: "Nom de l'établissement, prénom et nom sont obligatoires." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return NextResponse.json({ erreur: "email", message: "Adresse e-mail invalide." }, { status: 400 });
  if (f.motDePasse.length < 8) return NextResponse.json({ erreur: "mdp", message: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });
  if (b.accepteConditions !== true) return NextResponse.json({ erreur: "conditions", message: "Pour continuer, accepte les conditions générales d'abonnement." }, { status: 400 });
  if (f.code.length < 3) return NextResponse.json({ erreur: "code", message: "Le code établissement doit faire au moins 3 lettres ou chiffres." }, { status: 400 });

  const { data: codePris } = await admin.from("etablissements").select("id").eq("code", f.code).maybeSingle();
  const { data: codeReserve } = await admin.from("souscriptions").select("id, email").eq("code", f.code).eq("statut", "en_attente").gte("created_at", new Date(Date.now() - 864e5).toISOString()).neq("email", f.email).maybeSingle();
  if (codePris || codeReserve) return NextResponse.json({ erreur: "code", message: "Ce code établissement est déjà pris : choisis-en un autre." }, { status: 409 });

  // Compte Auth non confirmé : il ne permet pas de se connecter tant que le paiement n'est pas validé.
  let userId: string | null = null;
  const cree = await admin.auth.admin.createUser({ email: f.email, password: f.motDePasse, email_confirm: false, user_metadata: { prenom: f.prenom, nom: f.nom } });
  if (cree.data.user) userId = cree.data.user.id;
  else {
    // Adresse déjà inscrite : on ne reprend qu'une inscription restée en attente de paiement.
    const { data: attente } = await admin.from("souscriptions").select("auth_user_id").eq("email", f.email).eq("statut", "en_attente").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!attente?.auth_user_id) return NextResponse.json({ erreur: "email_pris", message: "Un compte existe déjà avec cette adresse. Connecte-toi, puis ajoute ton établissement depuis Paramètres › Mes établissements." }, { status: 409 });
    userId = attente.auth_user_id as string;
    await admin.auth.admin.updateUserById(userId, { password: f.motDePasse });
  }

  const { data: s, error } = await admin
    .from("souscriptions")
    .insert({ auth_user_id: userId, email: f.email, prenom: f.prenom, nom: f.nom, etablissement_nom: f.etablissement, ville: f.ville || null, pays: f.pays, code: f.code, conditions_version: VERSION_CONDITIONS, conditions_acceptees_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !s) return NextResponse.json({ erreur: "enregistrement", message: "Inscription impossible pour le moment, réessaie dans un instant." }, { status: 500 });

  const origine = new URL(request.url).origin;
  const essai = joursEssai();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: prix, quantity: 1 }],
    customer_email: f.email,
    client_reference_id: s.id,
    metadata: { souscription_id: s.id, code: f.code },
    subscription_data: { ...(essai > 0 ? { trial_period_days: essai } : {}), metadata: { souscription_id: s.id, code: f.code } },
    payment_method_collection: "always",
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    locale: "fr",
    success_url: `${origine}/souscription/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/souscription?annule=1`,
  });
  await admin.from("souscriptions").update({ stripe_session_id: session.id }).eq("id", s.id);
  return NextResponse.json({ url: session.url });
}
