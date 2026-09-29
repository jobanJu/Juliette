// Déconnexion de la caisse (directeur) : la clé est effacée, les ventes déjà importées restent.
import { NextResponse } from "next/server";
import { appelant } from "@/lib/appelant";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { etablissementId?: unknown };
  const qui = await appelant(request, b.etablissementId, "directeur");
  if (qui instanceof NextResponse) return qui;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ erreur: "serveur" }, { status: 503 });
  await admin.from("caisse_secrets").delete().eq("etablissement_id", qui.etablissementId);
  const { error } = await admin.from("caisse_connexions").delete().eq("etablissement_id", qui.etablissementId);
  if (error) return NextResponse.json({ erreur: "suppression" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
