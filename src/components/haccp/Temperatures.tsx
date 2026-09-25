"use client";

import { useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { ajouterJours, depuisIso, iso } from "@/lib/planning";
import { CRENEAUX_RELEVE, creneauReleve, EQUIPEMENTS_TYPES, estConforme, formatTemp } from "@/lib/haccp";
import type { Enregistrement, Equipement, Temperature } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  compteId: string;
  equipements: Equipement[];
  releves: Enregistrement<Temperature>[];
  historique?: boolean;
  gestion: boolean;
  onConfigurer: () => void;
  onSaved: (message: string) => void;
};

export default function Temperatures(p: Props) {
  const jour = iso(new Date());
  const creneau = creneauReleve(new Date());
  const duJour = p.releves.filter((r) => iso(new Date(r.created_at)) === jour);

  if (!p.equipements.length) {
    return (
      <section className="card empty">
        <b>Aucun équipement froid déclaré</b>
        {p.gestion ? "Déclare tes frigos, chambres froides et vitrines pour commencer les relevés." : "Un responsable doit d'abord déclarer les équipements."}
        {p.gestion && (
          <p style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={p.onConfigurer}>
              Déclarer les équipements
            </button>
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Relevés du {creneau === "matin" ? "matin" : "soir"}</h2>
          {p.gestion && (
            <button className="btn" style={{ height: 32 }} onClick={p.onConfigurer}>
              Équipements
            </button>
          )}
        </div>
        <div className="temp-grid">
          {p.equipements.map((e) => (
            <SaisieEquipement
              key={e.id}
              e={e}
              fait={duJour.filter((r) => r.data.equipement_id === e.id && creneauReleve(r.created_at) === creneau).at(-1)}
              {...p}
            />
          ))}
        </div>
      </section>
      {p.historique && <Historique equipements={p.equipements} releves={p.releves} />}
    </>
  );
}

function SaisieEquipement({ e, fait, etablissementId, compteId, onSaved }: { e: Equipement; fait?: Enregistrement<Temperature> } & Props) {
  const [valeur, setValeur] = useState("");
  const [action, setAction] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [refaire, setRefaire] = useState(false);
  const v = Number(valeur.replace(",", "."));
  const saisi = valeur.trim() !== "" && Number.isFinite(v);
  const horsNorme = saisi && !estConforme(v, e);

  async function enregistrer() {
    setErreur(null);
    if (!saisi) return setErreur("Indique la température.");
    if (v < -40 || v > 110) return setErreur("Valeur improbable : vérifie le thermomètre.");
    if (horsNorme && !action.trim()) return setErreur("Hors norme : indique l'action corrective.");
    setEnvoi(true);
    const data: Temperature = { equipement_id: e.id, equipement: e.nom, valeur: v, min: e.min, max: e.max, conforme: !horsNorme, ...(horsNorme ? { action: action.trim() } : {}) };
    const { error } = await getSupabaseClient()!.from("haccp_enregistrements").insert({ etablissement_id: etablissementId, compte_id: compteId, type: "temperature", data });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé.");
    setValeur("");
    setAction("");
    setRefaire(false);
    onSaved(`${e.nom} : ${formatTemp(v)}${horsNorme ? " (hors norme)" : ""}`);
  }

  const t = EQUIPEMENTS_TYPES[e.type];
  return (
    <div className={`temp-card${fait && !refaire ? (fait.data.conforme ? " ok" : " ko") : horsNorme ? " ko" : ""}`}>
      <div className="temp-top">
        <span className="chip-ic t-blue">{t.icone}</span>
        <span style={{ minWidth: 0 }}>
          <b>{e.nom}</b>
          <small>
            {formatTemp(e.min)} à {formatTemp(e.max)}
          </small>
        </span>
      </div>
      {fait && !refaire ? (
        <div className="temp-done">
          <span className="temp-val">{formatTemp(fait.data.valeur)}</span>
          <small>
            {fait.data.conforme ? "✓ conforme" : "⚠ hors norme"} · {new Date(fait.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {fait.auteur}
          </small>
          {fait.data.action && <small className="temp-action">Action : {fait.data.action}</small>}
          <button className="link-btn" onClick={() => setRefaire(true)}>
            Nouveau relevé
          </button>
        </div>
      ) : (
        <div className="temp-form">
          <div className="temp-input">
            <input inputMode="decimal" value={valeur} onChange={(x) => setValeur(x.target.value)} placeholder={String((e.min + e.max) / 2).replace(".", ",")} aria-label={`Température ${e.nom}`} onKeyDown={(x) => x.key === "Enter" && enregistrer()} />
            <span>°C</span>
            <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
              OK
            </button>
          </div>
          {horsNorme && <input className="temp-action-input" value={action} onChange={(x) => setAction(x.target.value)} placeholder="Action corrective (ex. : produits transférés, technicien appelé)" />}
          {erreur && <small className="temp-err">{erreur}</small>}
        </div>
      )}
    </div>
  );
}

function Historique({ equipements, releves }: { equipements: Equipement[]; releves: Enregistrement<Temperature>[] }) {
  const jours = useMemo(() => Array.from({ length: 14 }, (_, i) => ajouterJours(iso(new Date()), -i)), []);
  const index = useMemo(() => {
    const m = new Map<string, Enregistrement<Temperature>>();
    for (const r of releves) m.set(`${r.data.equipement_id}|${iso(new Date(r.created_at))}|${creneauReleve(r.created_at)}`, r);
    return m;
  }, [releves]);

  return (
    <section className="card" style={{ marginTop: 14, padding: "16px 6px 6px" }}>
      <div className="card-head" style={{ padding: "0 12px" }}>
        <h2>14 derniers jours</h2>
        <span className="hint">Case vide = relevé manquant</span>
      </div>
      <div className="table-wrap">
        <table className="data temp-hist">
          <thead>
            <tr>
              <th>Jour</th>
              {equipements.map((e) => (
                <th key={e.id} colSpan={2}>
                  {e.nom}
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {equipements.map((e) => CRENEAUX_RELEVE.map((c) => <th key={e.id + c.cle}>{c.label}</th>))}
            </tr>
          </thead>
          <tbody>
            {jours.map((j) => (
              <tr key={j}>
                <td style={{ whiteSpace: "nowrap", textTransform: "capitalize" }}>{depuisIso(j).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
                {equipements.map((e) =>
                  CRENEAUX_RELEVE.map((c) => {
                    const r = index.get(`${e.id}|${j}|${c.cle}`);
                    return (
                      <td key={e.id + c.cle} className={r ? (r.data.conforme ? "th-ok" : "th-ko") : "th-vide"} title={r ? `${r.auteur}${r.data.action ? ` · ${r.data.action}` : ""}` : "Aucun relevé"}>
                        {r ? formatTemp(r.data.valeur) : "—"}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
