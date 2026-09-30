"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { depuisIso } from "@/lib/planning";
import { heure, LIBELLE_TYPE } from "@/lib/pointage";
import type { PointageBrut, TypePointage } from "@/lib/pointage";
import Icone from "@/components/Icone";

type Props = {
  etablissementId: string;
  responsableId: string;
  compteId: string;
  personne: string;
  jour: string;
  evenements: PointageBrut[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

function horodatage(jour: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = depuisIso(jour);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export default function ModalCorrection(p: Props) {
  const tries = [...p.evenements].sort((a, b) => a.horodatage.localeCompare(b.horodatage));
  const [edite, setEdite] = useState<PointageBrut | null>(null);
  const [type, setType] = useState<TypePointage>(tries.length && tries[tries.length - 1].type !== "depart" ? "depart" : "arrivee");
  const [h, setH] = useState(() => new Date().toTimeString().slice(0, 5));
  const [jourSaisi, setJourSaisi] = useState(p.jour);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const sb = getSupabaseClient()!;

  function choisir(e: PointageBrut | null) {
    setEdite(e);
    setErreur(null);
    setMotif("");
    if (e) {
      setType(e.type);
      setH(new Date(e.horodatage).toTimeString().slice(0, 5));
      const d = new Date(e.horodatage);
      setJourSaisi(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }

  async function enregistrer() {
    setErreur(null);
    if (!motif.trim()) return setErreur("Indique la raison de la correction : elle reste dans l'historique.");
    const quand = horodatage(jourSaisi, h);
    if (new Date(quand).getTime() > Date.now() + 60000) return setErreur("On ne peut pas pointer dans le futur.");
    setEnvoi(true);
    const trace = `Correction ${new Date().toLocaleDateString("fr-FR")} : ${motif.trim()}`;
    const { error } = edite
      ? await sb
          .from("pointages")
          .update({ type, horodatage: quand, manuel: true, responsable_id: p.responsableId, justificatif: [edite.justificatif, trace].filter(Boolean).join(" · ") })
          .eq("id", edite.id)
      : await sb.from("pointages").insert({
          etablissement_id: p.etablissementId,
          compte_id: p.compteId,
          type,
          horodatage: quand,
          manuel: true,
          created_by: p.responsableId,
          responsable_id: p.responsableId,
          justificatif: trace,
        });
    setEnvoi(false);
    if (error) return setErreur("Correction refusée. Seuls les responsables peuvent corriger un pointage.");
    p.onSaved(edite ? "Pointage corrigé" : "Pointage ajouté");
  }

  async function supprimer(e: PointageBrut) {
    setEnvoi(true);
    const { error } = await sb.from("pointages").delete().eq("id", e.id);
    setEnvoi(false);
    if (error) return setErreur("Suppression refusée.");
    p.onSaved("Pointage supprimé");
  }

  return (
    <Modal
      titre={p.personne}
      sousTitre={`Pointages du ${depuisIso(p.jour).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
      onClose={p.onClose}
      pied={
        <>
          {edite && (
            <button className="btn" onClick={() => choisir(null)} disabled={envoi} style={{ marginRight: "auto" }}>
              + Ajouter plutôt
            </button>
          )}
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Fermer
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : edite ? "Corriger" : "Ajouter le pointage"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Pointages enregistrés</label>
        {!tries.length ? (
          <p className="hint">Aucun pointage ce jour-là.</p>
        ) : (
          <div className="rows">
            {tries.map((e) => (
              <div key={e.id} className="row" style={{ padding: "8px 0" }}>
                <button className={`slot slot-shift${edite?.id === e.id ? " slot-sel" : ""}`} onClick={() => choisir(e)} title="Corriger">
                  {heure(e.horodatage)}
                </button>
                <span className="main-txt">
                  <b style={{ fontSize: 12.5 }}>
                    {LIBELLE_TYPE[e.type]}
                    {e.manuel ? " · corrigé" : ""}
                  </b>
                  {e.justificatif && <small title={e.justificatif}>{e.justificatif}</small>}
                </span>
                <button className="icon-btn" onClick={() => supprimer(e)} disabled={envoi} aria-label="Supprimer ce pointage" title="Supprimer">
                  <Icone nom="supprimer" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label>{edite ? "Corriger le pointage sélectionné" : "Ajouter un pointage oublié"}</label>
        <div className="chips">
          {(Object.keys(LIBELLE_TYPE) as TypePointage[]).map((t) => (
            <button key={t} className={`chip${type === t ? " on" : ""}`} onClick={() => setType(t)}>
              {LIBELLE_TYPE[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="c-jour">Jour</label>
          <input id="c-jour" type="date" value={jourSaisi} onChange={(e) => setJourSaisi(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="c-heure">Heure</label>
          <input id="c-heure" type="time" value={h} onChange={(e) => setH(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-motif">Raison de la correction *</label>
        <input id="c-motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : oubli de pointage au départ" maxLength={160} />
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
