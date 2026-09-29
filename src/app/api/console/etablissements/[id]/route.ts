// Console : détail d'un établissement (équipe, réglages internes) et modification de son paramétrage.
import { NextResponse } from "next/server";
import { equipeJuliette, FORMULES, STATUTS_CAISSE } from "@/lib/console";
import { MODULES } from "@/lib/modules";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const acces = await equipeJuliette(request);
  if (acces instanceof NextResponse) return acces;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ erreur: "id" }, { status: 400 });
  const [etab, reglages, comptes, outils, emails, contrats, caisse, ventes] = await Promise.all([
    acces.admin.from("etablissements").select("id, nom, code, ville, pays, adresse, telephone, email_contact, siret, created_at, modules_masques, boite_mail_jeton").eq("id", id).maybeSingle(),
    acces.admin.from("etablissements_admin").select("*").eq("etablissement_id", id).maybeSingle(),
    acces.admin.from("comptes").select("id, prenom, nom, email, role, statut, poste, created_at").eq("etablissement_id", id).order("role").order("prenom"),
    acces.admin.from("outils_externes").select("id", { count: "exact", head: true }).eq("etablissement_id", id),
    acces.admin.from("emails_recus").select("id", { count: "exact", head: true }).eq("etablissement_id", id),
    acces.admin.from("contrats_travail").select("id", { count: "exact", head: true }).eq("etablissement_id", id),
    acces.admin.from("caisse_connexions").select("logiciel, statut, identifiant, derniere_synchro, derniere_erreur, demande_at").eq("etablissement_id", id).maybeSingle(),
    acces.admin.from("ventes_caisse").select("id", { count: "exact", head: true }).eq("etablissement_id", id),
  ]);
  if (!etab.data) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  return NextResponse.json({
    etablissement: etab.data,
    reglages: reglages.data ?? null,
    comptes: comptes.data ?? [],
    caisse: caisse.data ?? null,
    usage: { outils: outils.count ?? 0, emails: emails.count ?? 0, contrats: contrats.count ?? 0, ventes: ventes.count ?? 0 },
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const acces = await equipeJuliette(request);
  if (acces instanceof NextResponse) return acces;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ erreur: "id" }, { status: 400 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const texte = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);

  // Paramétrage visible par le client : pays et modules utilisés.
  const etab: Record<string, unknown> = {};
  if (b.pays === "FR" || b.pays === "BE") etab.pays = b.pays;
  if (Array.isArray(b.modules_masques)) {
    const connus = new Set(MODULES.map((m) => m.module));
    etab.modules_masques = (b.modules_masques as unknown[]).filter((m): m is string => typeof m === "string" && connus.has(m));
  }
  if (Object.keys(etab).length) {
    const { error } = await acces.admin.from("etablissements").update(etab).eq("id", id);
    if (error) return NextResponse.json({ erreur: "etablissement" }, { status: 500 });
  }

  // Réglages internes (jamais visibles par le client).
  const interne: Record<string, unknown> = {};
  if (typeof b.formule === "string" && (FORMULES as readonly string[]).includes(b.formule)) interne.formule = b.formule;
  if ("fin_essai" in b) interne.fin_essai = typeof b.fin_essai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.fin_essai) ? b.fin_essai : null;
  if (typeof b.suspendu === "boolean") interne.suspendu = b.suspendu;
  if ("motif_suspension" in b) interne.motif_suspension = texte(b.motif_suspension, 300);
  if ("caisse_note" in b) interne.caisse_note = texte(b.caisse_note, 1000);
  if ("notes" in b) interne.notes = texte(b.notes, 5000);
  if (Object.keys(interne).length) {
    const { error } = await acces.admin.from("etablissements_admin").upsert({ etablissement_id: id, ...interne }, { onConflict: "etablissement_id" });
    if (error) return NextResponse.json({ erreur: "reglages" }, { status: 500 });
  }
  // Connexion caisse : l'équipe fait avancer une demande (en cours, connectée…) ou en crée une.
  const logiciel = texte(b.caisse_logiciel, 60);
  if (logiciel && typeof b.caisse_statut === "string" && (STATUTS_CAISSE as readonly string[]).includes(b.caisse_statut)) {
    if (b.caisse_statut === "aucune") {
      await acces.admin.from("caisse_secrets").delete().eq("etablissement_id", id);
      await acces.admin.from("caisse_connexions").delete().eq("etablissement_id", id);
    } else {
      const { error } = await acces.admin.from("caisse_connexions").upsert({ etablissement_id: id, logiciel, statut: b.caisse_statut }, { onConflict: "etablissement_id" });
      if (error) return NextResponse.json({ erreur: "caisse" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
