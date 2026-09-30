// Webhook Stripe : validation automatique des souscriptions et suivi des abonnements.
// À déclarer dans Stripe (Développeurs › Webhooks) vers https://<domaine>/api/stripe/webhook avec les
// événements checkout.session.completed, customer.subscription.updated et customer.subscription.deleted.
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { activerSouscription, enregistrerAbonnement, getStripe } from "@/lib/stripeServeur";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !secret) return NextResponse.json({ erreur: "non_configure" }, { status: 503 });

  let evenement: Stripe.Event;
  try {
    evenement = await stripe.webhooks.constructEventAsync(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ erreur: "signature" }, { status: 400 });
  }

  switch (evenement.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const r = await activerSouscription(admin, stripe, evenement.data.object);
      if (r.statut === "erreur") console.error("Souscription non activée", evenement.data.object.id, r.message);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await enregistrerAbonnement(admin, evenement.data.object);
      break;
  }
  return NextResponse.json({ recu: true });
}
