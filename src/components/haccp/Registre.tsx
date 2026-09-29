"use client";

import { useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { ajouterJours, depuisIso, iso } from "@/lib/planning";
import { csv } from "@/lib/pointage";
import { CONSERVATIONS, estTracePhoto, etapeRefroidissementConforme, formatTemp, refroidissementConforme } from "@/lib/haccp";
import type { Enregistrement, Etiquette, Nettoyage, Production, Refroidissement, Temperature, TypeEnregistrement } from "@/lib/haccp";
import PhotoHaccp from "@/components/haccp/Photo";

const TYPES: Record<TypeEnregistrement, string> = { temperature: "Température", nettoyage: "Nettoyage", refroidissement: "Refroidissement", tracabilite: "Traçabilité", production: "Production" };

function detail(e: Enregistrement): { texte: string; conforme: boolean | null } {
  if (e.type === "temperature") {
    const d = e.data as Temperature;
    return { texte: `${d.equipement} : ${formatTemp(d.valeur)} (norme ${formatTemp(d.min)} à ${formatTemp(d.max)})${d.action ? ` · action : ${d.action}` : ""}`, conforme: d.conforme };
  }
  if (e.type === "nettoyage") {
    const d = e.data as Nettoyage;
    return { texte: `${d.zone} · ${d.element}${d.non_fait ? " · PAS FAIT" : ""}${d.remarque ? ` · ${d.remarque}` : ""}`, conforme: !d.non_fait };
  }
  if (e.type === "refroidissement") {
    const d = e.data as Refroidissement;
    const ok = refroidissementConforme(d);
    return {
      texte: `${d.produit} : ${formatTemp(d.temp_debut)} → ${d.temp_fin != null ? formatTemp(d.temp_fin) : "en cours"}${d.fin_at ? ` en ${Math.round((new Date(d.fin_at).getTime() - new Date(d.debut_at).getTime()) / 60000)} min` : ""}${d.action ? ` · action : ${d.action}` : ""}`,
      conforme: ok,
    };
  }
  if (e.type === "production") {
    const d = e.data as Production;
    const ok = etapeRefroidissementConforme(d.refroidissement);
    return {
      texte: `${d.recette} · lot ${d.lot} · ${d.lignes.length} produit(s)${d.conservation ? ` · ${CONSERVATIONS[d.conservation]?.label ?? d.conservation}` : ""}${d.cloture_at ? "" : " · en cours"}${d.remarque ? ` · ${d.remarque}` : ""}`,
      conforme: ok,
    };
  }
  if (estTracePhoto(e.data)) {
    const d = e.data;
    return { texte: `📷 ${d.produit || "Article non renseigné"}${d.lot ? ` · lot ${d.lot}` : ""}${d.dlc ? ` · DLC ${depuisIso(d.dlc).toLocaleDateString("fr-FR")}` : ""}`, conforme: null };
  }
  const d = e.data as Etiquette;
  return { texte: `${d.produit}${d.quantite ? ` (${d.quantite})` : ""} · lot ${d.lot} · DLC ${depuisIso(d.dlc).toLocaleDateString("fr-FR")}`, conforme: null };
}

export default function Registre({ liste, gestion, etablissementCode, typeInitial = "tout", onSaved }: { liste: Enregistrement[]; gestion: boolean; etablissementCode: string; typeInitial?: TypeEnregistrement | "tout"; onSaved: (m: string) => void }) {
  const [du, setDu] = useState(() => ajouterJours(iso(new Date()), -6));
  const [au, setAu] = useState(() => iso(new Date()));
  const [type, setType] = useState<TypeEnregistrement | "tout">(typeInitial);
  const [nonConformes, setNonConformes] = useState(false);

  const lignes = useMemo(
    () =>
      liste
        .filter((e) => {
          const j = iso(new Date(e.created_at));
          return j >= du && j <= au && (type === "tout" || e.type === type);
        })
        .map((e) => ({ e, ...detail(e) }))
        .filter((l) => !nonConformes || l.conforme === false)
        .sort((a, b) => b.e.created_at.localeCompare(a.e.created_at)),
    [liste, du, au, type, nonConformes],
  );

  const [copieOk, setCopieOk] = useState(false);

  function copierGoogleSheets() {
    const rows: string[][] = [["Date", "Heure", "Type", "Détail", "Conformité", "Auteur"]];
    for (const l of lignes) {
      const d = new Date(l.e.created_at);
      rows.push([
        d.toLocaleDateString("fr-FR"),
        d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        TYPES[l.e.type],
        l.texte,
        l.conforme === null ? "" : l.conforme ? "Conforme" : "NON CONFORME",
        l.e.auteur,
      ]);
    }
    const tsv = rows.map((r) => r.join("\t")).join("\n");
    navigator.clipboard.writeText(tsv).then(() => {
      setCopieOk(true);
      setTimeout(() => setCopieOk(false), 2500);
      onSaved("Données copiées ! Ouvre Google Sheets et colle (Cmd+V ou Ctrl+V)");
    });
  }

  function exporter() {
    const rows: (string | number)[][] = [["Date", "Heure", "Type", "Détail", "Conformité", "Auteur"]];
    for (const l of lignes) {
      const d = new Date(l.e.created_at);
      rows.push([d.toLocaleDateString("fr-FR"), d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), TYPES[l.e.type], l.texte, l.conforme === null ? "" : l.conforme ? "Conforme" : "NON CONFORME", l.e.auteur]);
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv(rows)], { type: "text/csv;charset=utf-8" }));
    a.download = `registre-haccp-${etablissementCode}-${du}-au-${au}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function supprimer(e: Enregistrement) {
    const { error } = await getSupabaseClient()!.from("haccp_enregistrements").delete().eq("id", e.id);
    onSaved(error ? "Suppression refusée" : "Enregistrement supprimé");
  }

  return (
    <>
      <div className="week-nav print-hide">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" className="select-sm" value={du} onChange={(e) => setDu(e.target.value)} aria-label="Du" />
          <span className="hint">au</span>
          <input type="date" className="select-sm" value={au} onChange={(e) => setAu(e.target.value)} aria-label="Au" />
          <select className="select-sm" value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Type">
            <option value="tout">Tous les types</option>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={nonConformes} onChange={(e) => setNonConformes(e.target.checked)} /> Non-conformités seulement
          </label>
        </div>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={copierGoogleSheets} title="Copier les données tabulées pour les coller directement dans Google Sheets">
            {copieOk ? "✓ Copié !" : "📋 Google Sheets"}
          </button>
          <button className="btn btn-sm" onClick={exporter} title="Télécharger sous format CSV compatible Microsoft Excel">
            ⤓ Export Excel (.csv)
          </button>
          <button className="btn btn-sm" onClick={() => window.print()}>
            ⎙ Imprimer
          </button>
        </span>
      </div>
      <p className="hint" style={{ margin: "0 0 10px" }}>
        {lignes.length} enregistrement(s) · {lignes.filter((l) => l.conforme === false).length} non-conformité(s). Les relevés sont horodatés par le serveur et ne se modifient pas.
      </p>
      <section className="card" style={{ padding: "16px 6px 6px" }}>
        {!lignes.length ? (
          <div className="empty">Aucun enregistrement sur cette période.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Détail</th>
                  <th>Conformité</th>
                  <th>Auteur</th>
                  {gestion && <th className="print-hide" />}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(l.e.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{TYPES[l.e.type]}</td>
                    <td>
                      {l.texte}
                      {estTracePhoto(l.e.data) && <PhotoHaccp chemin={l.e.data.photo} className="registre-photo print-hide" alt="" />}
                    </td>
                    <td>{l.conforme === null ? "—" : <span className={`pill ${l.conforme ? "t-mint" : "t-red"}`}>{l.conforme ? "Conforme" : "Non conforme"}</span>}</td>
                    <td className="hint">{l.e.auteur}</td>
                    {gestion && (
                      <td className="print-hide" style={{ textAlign: "right" }}>
                        <button className="icon-btn" onClick={() => supprimer(l.e)} aria-label="Supprimer" title="Supprimer (erreur de saisie)">
                          🗑
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
