// Import manuel des dernières ventes (responsable ou directeur). POST { etablissementId }
import { NextResponse } from "next/server";
import { appelant } from "@/lib/appelant";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { synchroniser } from "@/lib/caisseServeur";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { etablissementId?: unknown };
  const qui = await appelant(request, b.etablissementId, "manager");
  if (qui instanceof NextResponse) return qui;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ erreur: "serveur" }, { status: 503 });
  try {
    return NextResponse.json({ ok: true, importees: await synchroniser(admin, qui.etablissementId) });
  } catch (e) {
    return NextResponse.json({ erreur: "synchro", message: e instanceof Error ? e.message : "Import impossible" }, { status: 502 });
  }
}
