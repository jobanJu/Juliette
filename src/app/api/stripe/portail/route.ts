// Espace de facturation Stripe du directeur : moyen de paiement, factures, résiliation.
// POST { etablissementId }
import { NextResponse } from "next/server";
import { appelant } from "@/lib/appelant";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripeServeur";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { etablissementId?: unknown };
  const qui = await appelant(request, b.etablissementId, "directeur");
  if (qui instanceof NextResponse) return qui;
  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  if (!stripe || !admin) return NextResponse.json({ erreur: "indisponible" }, { status: 503 });
  const { data: a } = await admin.from("abonnements").select("stripe_customer_id").eq("etablissement_id", qui.etablissementId).maybeSingle();
  if (!a) return NextResponse.json({ erreur: "aucun_abonnement" }, { status: 404 });
  const portail = await stripe.billingPortal.sessions.create({ customer: a.stripe_customer_id as string, return_url: `${new URL(request.url).origin}/parametres`, locale: "fr" });
  return NextResponse.json({ url: portail.url });
}
