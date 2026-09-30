// Tarif public de la formule Juliette, lu dans Stripe.
import { NextResponse } from "next/server";
import { lireTarif } from "@/lib/stripeServeur";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tarif = await lireTarif();
    if (!tarif) return NextResponse.json({ disponible: false });
    return NextResponse.json({ disponible: true, ...tarif });
  } catch {
    return NextResponse.json({ disponible: false });
  }
}
