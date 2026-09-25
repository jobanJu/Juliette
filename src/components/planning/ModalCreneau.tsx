"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { depuisIso, dureeCreneau, formatDuree, hm, JOURS_COURTS, MOTIFS_ABSENCE } from "@/lib/planning";
import type { Creneau, TypeCreneau } from "@/lib/planning";

type Frequent = { debut: string; fin: string; pause: number };

type Props = {
  etablissementId: string;
  auteurId: string;
  personne: string;
  compteId: string;
  date: string;
  semaine: string[];
  existants: Creneau[]; // créneaux de la semaine de cette personne
  frequents: Frequent[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

const PAUSES = [0, 15, 30, 45, 60];

function intervalle(debut: string, fin: string) {
  const [a, b] = [debut, fin].map((h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)));
  return [a, b <= a ? b + 1440 : b] as const;
}

export default function ModalCreneau(p: Props) {
  const duJour = p.existants.filter((c) => c.date === p.date);
  const [edite, setEdite] = useState<Creneau | null>(null);
  const [type, setType] = useState<TypeCreneau>("shift");
  const [debut, setDebut] = useState("09:00");
  const [fin, setFin] = useState("15:00");
  const [pause, setPause] = useState(0);
  const [motif, setMotif] = useState("conge_paye");
  const [note, setNote] = useState("");
  const [autresJours, setAutresJours] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const sb = getSupabaseClient()!;
  const jourLong = depuisIso(p.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  function charger(c: Creneau | null) {
    setEdite(c);
    setErreur(null);
    setAutresJours([]);
    if (!c) return;
    setType(c.type);
    if (c.type === "shift") {
      setDebut(hm(c.heure_debut));
      setFin(hm(c.heure_fin));
      setPause(c.pause_minutes ?? 0);
    }
    if (c.motif) setMotif(c.motif);
    setNote(c.note ?? "");
  }

  async function supprimer(c: Creneau) {
    setEnvoi(true);
    const { error } = await sb.from("planning_creneaux").delete().eq("id", c.id);
    setEnvoi(false);
    if (error) return setErreur("Suppression refusée. Seuls les responsables peuvent modifier le planning.");
    p.onSaved("Créneau supprimé");
  }

  async function enregistrer() {
    setErreur(null);
    if (type === "shift" && debut === fin) return setErreur("L'heure de fin doit être différente de l'heure de début.");
    if (type === "shift" && dureeCreneau({ type, heure_debut: debut, heure_fin: fin, pause_minutes: pause }) <= 0)
      return setErreur("La pause est plus longue que le créneau.");

    const jours = [p.date, ...autresJours];
    const aSupprimer: string[] = [];
    for (const jour of jours) {
      const autres = p.existants.filter((c) => c.date === jour && c.id !== edite?.id);
      if (type === "shift") {
        // Un créneau de travail remplace un repos ou une absence, mais ne doit pas chevaucher un autre créneau.
        aSupprimer.push(...autres.filter((c) => c.type !== "shift").map((c) => c.id));
        const [a, b] = intervalle(debut, fin);
        const conflit = autres.find((c) => {
          if (c.type !== "shift" || !c.heure_debut || !c.heure_fin) return false;
          const [x, y] = intervalle(hm(c.heure_debut), hm(c.heure_fin));
          return a < y && x < b;
        });
        if (conflit) {
          const j = jour === p.date ? "ce jour-là" : depuisIso(jour).toLocaleDateString("fr-FR", { weekday: "long" });
          return setErreur(`Chevauche le créneau ${hm(conflit.heure_debut)}–${hm(conflit.heure_fin)} (${j}).`);
        }
      } else {
        // Repos ou absence : la journée entière, donc remplace tout ce qui y était.
        aSupprimer.push(...autres.map((c) => c.id));
      }
    }

    const ligne = {
      etablissement_id: p.etablissementId,
      compte_id: p.compteId,
      type,
      heure_debut: type === "shift" ? debut : null,
      heure_fin: type === "shift" ? fin : null,
      pause_minutes: type === "shift" ? pause || null : null,
      motif: type === "conge" ? motif : null,
      note: note.trim() || null,
    };

    // On écrit d'abord, on retire ensuite ce qui est remplacé : un échec n'efface rien.
    setEnvoi(true);
    const { error } = edite
      ? await sb.from("planning_creneaux").update(ligne).eq("id", edite.id)
      : await sb.from("planning_creneaux").insert(jours.map((date) => ({ ...ligne, date, created_by: p.auteurId })));
    if (!error && aSupprimer.length) await sb.from("planning_creneaux").delete().in("id", aSupprimer);
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé. Seuls les responsables peuvent modifier le planning.");
    p.onSaved(edite ? "Créneau modifié" : jours.length > 1 ? `${jours.length} créneaux ajoutés` : "Créneau ajouté");
  }

  const duree = type === "shift" ? dureeCreneau({ type, heure_debut: debut, heure_fin: fin, pause_minutes: pause }) : 0;

  return (
    <Modal
      titre={p.personne}
      sousTitre={jourLong.charAt(0).toUpperCase() + jourLong.slice(1)}
      onClose={p.onClose}
      pied={
        <>
          {edite && (
            <button className="btn" onClick={() => charger(null)} disabled={envoi} style={{ marginRight: "auto" }}>
              + Nouveau créneau
            </button>
          )}
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : edite ? "Modifier" : "Ajouter"}
          </button>
        </>
      }
    >
      {duJour.length > 0 && (
        <div className="field">
          <label>Déjà prévu ce jour</label>
          <div className="rows">
            {duJour.map((c) => (
              <div key={c.id} className="row" style={{ padding: "8px 0" }}>
                <button className={`slot slot-${c.type}${edite?.id === c.id ? " slot-sel" : ""}`} onClick={() => charger(c)} title="Modifier">
                  {c.type === "shift" ? `${hm(c.heure_debut)} – ${hm(c.heure_fin)}` : c.type === "repos" ? "Repos" : MOTIFS_ABSENCE[c.motif ?? "autre"] ?? "Absence"}
                </button>
                <span className="main-txt">
                  <small>{c.type === "shift" ? `${formatDuree(dureeCreneau(c))}${c.pause_minutes ? ` · pause ${c.pause_minutes} min` : ""}` : c.note ?? ""}</small>
                </span>
                <button className="icon-btn" onClick={() => supprimer(c)} disabled={envoi} aria-label="Supprimer ce créneau" title="Supprimer">
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="seg" role="tablist">
        {(["shift", "repos", "conge"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={type === t} className={type === t ? "on" : ""} onClick={() => setType(t)}>
            {t === "shift" ? "Travail" : t === "repos" ? "Repos" : "Absence"}
          </button>
        ))}
      </div>

      {type === "shift" && (
        <>
          <div className="field">
            <label>Créneaux fréquents</label>
            <div className="chips">
              {p.frequents.map((f) => (
                <button
                  key={`${f.debut}${f.fin}${f.pause}`}
                  className={`chip${debut === f.debut && fin === f.fin && pause === f.pause ? " on" : ""}`}
                  onClick={() => {
                    setDebut(f.debut);
                    setFin(f.fin);
                    setPause(f.pause);
                  }}
                >
                  {f.debut}–{f.fin}
                  {f.pause ? ` · ${f.pause}′` : ""}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field">
              <label htmlFor="debut">Début</label>
              <input id="debut" type="time" step={300} value={debut} onChange={(e) => setDebut(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fin">Fin</label>
              <input id="fin" type="time" step={300} value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Pause</label>
            <div className="chips">
              {PAUSES.map((m) => (
                <button key={m} className={`chip${pause === m ? " on" : ""}`} onClick={() => setPause(m)}>
                  {m ? `${m} min` : "Aucune"}
                </button>
              ))}
              <input
                aria-label="Autre durée de pause, en minutes"
                className="chip-input"
                type="number"
                min={0}
                max={240}
                placeholder="autre"
                value={PAUSES.includes(pause) ? "" : pause}
                onChange={(e) => setPause(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <p className="hint">
            Temps travaillé : <b>{formatDuree(duree)}</b>
            {fin <= debut && debut !== fin ? " · finit le lendemain" : ""}
          </p>
        </>
      )}

      {type === "conge" && (
        <div className="field">
          <label htmlFor="motif">Motif</label>
          <select id="motif" value={motif} onChange={(e) => setMotif(e.target.value)}>
            {Object.entries(MOTIFS_ABSENCE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}

      {type !== "shift" && duJour.some((c) => c.id !== edite?.id) && <p className="hint">Remplace ce qui était prévu ce jour-là.</p>}

      <div className="field">
        <label htmlFor="note">Note (facultatif)</label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : fermeture, formation, coupure…" maxLength={120} />
      </div>

      {!edite && (
        <div className="field">
          <label>Appliquer aussi à</label>
          <div className="chips">
            {p.semaine.map((j, i) =>
              j === p.date ? null : (
                <button
                  key={j}
                  className={`chip${autresJours.includes(j) ? " on" : ""}`}
                  onClick={() => setAutresJours((a) => (a.includes(j) ? a.filter((x) => x !== j) : [...a, j]))}
                >
                  {JOURS_COURTS[i]} {depuisIso(j).getDate()}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
