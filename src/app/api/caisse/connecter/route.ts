// Connexion d'une caisse par le directeur.
// POST { etablissementId, logiciel, cle?, identifiant? }
//   * caisse « api » (SumUp, Square) : la clé est vérifiée auprès de l'éditeur, chiffrée, puis les
//     ventes des 60 derniers jours sont importées ;
//   * caisse « partenaire » : on enregistre la demande, que l'équipe Juliette traite dans la console.
import { NextResponse } from "next/server";
import { appelant } from "@/lib/appelant";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { caisse } from "@/lib/caisses";
import { chiffrer, CONNECTEURS, synchroniser } from "@/lib/caisseServeur";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { etablissementId?: unknown; logiciel?: unknown; cle?: unknown; identifiant?: unknown };
  const qui = await appelant(request, b.etablissementId, "directeur");
  if (qui instanceof NextResponse) return qui;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ erreur: "serveur" }, { status: 503 });
  const c = caisse(typeof b.logiciel === "string" ? b.logiciel : null);
  if (!c) return NextResponse.json({ erreur: "logiciel" }, { status: 400 });

  if (c.mode === "partenaire") {
    const note = typeof b.identifiant === "string" ? b.identifiant.trim().slice(0, 120) || null : null;
    const { error } = await admin.from("caisse_connexions").upsert({ etablissement_id: qui.etablissementId, logiciel: c.cle, statut: "demandee", identifiant: note, derniere_erreur: null, demande_par: qui.compteId, demande_at: new Date().toISOString() }, { onConflict: "etablissement_id" });
    await admin.from("caisse_secrets").delete().eq("etablissement_id", qui.etablissementId);
    if (error) return NextResponse.json({ erreur: "enregistrement" }, { status: 500 });
    return NextResponse.json({ ok: true, statut: "demandee" });
  }

  const cle = typeof b.cle === "string" ? b.cle.trim() : "";
  if (cle.length < 10 || cle.length > 500) return NextResponse.json({ erreur: "cle", message: "Colle la clé complète." }, { status: 400 });
  const identifiantSaisi = typeof b.identifiant === "string" && b.identifiant.trim() ? b.identifiant.trim().slice(0, 80) : null;
  let identifiant: string;
  try {
    identifiant = await CONNECTEURS[c.cle].verifier(cle, identifiantSaisi);
  } catch (e) {
    return NextResponse.json({ erreur: "verification", message: e instanceof Error ? e.message : "Clé refusée" }, { status: 422 });
  }
  const [s1, s2] = await Promise.all([
    admin.from("caisse_secrets").upsert({ etablissement_id: qui.etablissementId, secret_chiffre: chiffrer(cle), updated_at: new Date().toISOString() }, { onConflict: "etablissement_id" }),
    admin.from("caisse_connexions").upsert({ etablissement_id: qui.etablissementId, logiciel: c.cle, statut: "connectee", identifiant, derniere_synchro: null, derniere_erreur: null, demande_par: qui.compteId, demande_at: new Date().toISOString() }, { onConflict: "etablissement_id" }),
  ]);
  if (s1.error || s2.error) return NextResponse.json({ erreur: "enregistrement" }, { status: 500 });
  try {
    const nb = await synchroniser(admin, qui.etablissementId);
    return NextResponse.json({ ok: true, statut: "connectee", importees: nb });
  } catch (e) {
    return NextResponse.json({ ok: true, statut: "erreur", message: e instanceof Error ? e.message : "Import impossible" });
  }
}
