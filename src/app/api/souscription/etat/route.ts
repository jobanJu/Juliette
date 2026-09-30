// État d'une souscription après le paiement. Si le webhook n'est pas encore passé, on vérifie
// directement auprès de Stripe et on active : l'établissement est prêt dès le retour du paiement.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { activerSouscription, getStripe } from "@/lib/stripeServeur";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return NextResponse.json({ statut: "erreur", message: "Lien invalide" }, { status: 400 });
  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  if (!stripe || !admin) return NextResponse.json({ statut: "erreur", message: "Service indisponible" }, { status: 503 });

  const { data: s } = await admin.from("souscriptions").select("statut, code, etablissement_nom, email, etablissement_id").eq("stripe_session_id", sessionId).maybeSingle();
  if (!s) return NextResponse.json({ statut: "erreur", message: "Souscription introuvable" }, { status: 404 });
  if (s.statut === "active" && s.etablissement_id) return NextResponse.json({ statut: "active", code: s.code, etablissement: s.etablissement_nom, email: s.email });
  if (s.statut === "active") return NextResponse.json({ statut: "en_attente" });

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const r = await activerSouscription(admin, stripe, session);
  return NextResponse.json({ ...r, email: s.email });
}
