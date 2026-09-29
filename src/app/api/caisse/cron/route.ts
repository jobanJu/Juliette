// Synchronisation de nuit de toutes les caisses connectées automatiquement (Vercel Cron).
// Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CONNECTEURS, synchroniser } from "@/lib/caisseServeur";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ erreur: "interdit" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ erreur: "serveur" }, { status: 503 });
  const { data } = await admin.from("caisse_connexions").select("etablissement_id, logiciel").in("logiciel", Object.keys(CONNECTEURS)).in("statut", ["connectee", "erreur"]);
  const bilan = { ok: 0, erreurs: 0 };
  for (const c of data ?? []) {
    try {
      await synchroniser(admin, c.etablissement_id);
      bilan.ok++;
    } catch {
      bilan.erreurs++;
    }
  }
  return NextResponse.json(bilan);
}
