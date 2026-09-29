"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { depuisIso, dureeCreneau, formatDuree, JOURS_COURTS } from "@/lib/planning";
import type { Creneau } from "@/lib/planning";
import { evenementsDuJour } from "@/lib/suggestion";
import type { JourEvenement, Proposition } from "@/lib/suggestion";

type Membre = { id: string; nom: string; heures_contrat: number | null };

type Props = {
  etablissementId: string;
  auteurId: string;
  semaine: string[];
  membres: Membre[];
  propositions: Proposition[];
  existants: Creneau[];
  evenements: JourEvenement[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

const cle = (p: Proposition) => `${p.compteId}|${p.date}`;

export default function ModalSuggestion(p: Props) {
  const [choisies, setChoisies] = useState(() => new Set(p.propositions.map(cle)));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const parMembre = useMemo(
    () =>
      p.membres
        .map((m) => ({ m, props: p.propositions.filter((x) => x.compteId === m.id) }))
        .filter((x) => x.props.length),
    [p.membres, p.propositions],
  );
  const sansHistorique = p.membres.filter((m) => !p.propositions.some((x) => x.compteId === m.id));
  const joursEvt = p.semaine.map((j) => ({ j, evts: evenementsDuJour(p.evenements, j) })).filter((x) => x.evts.length);

  const basculer = (k: string) =>
    setChoisies((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  async function appliquer() {
    const lignes = p.propositions
      .filter((x) => choisies.has(cle(x)))
      .flatMap((x) =>
        x.services.map((s) => ({
          etablissement_id: p.etablissementId,
          compte_id: x.compteId,
          date: x.date,
          type: "shift",
          heure_debut: s.debut,
          heure_fin: s.fin,
          pause_minutes: s.pause || null,
          note: null,
          created_by: p.auteurId,
        })),
      );
    if (!lignes.length) return setErreur("Coche au moins une proposition.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("planning_creneaux").insert(lignes);
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé. Seuls les responsables peuvent modifier le planning.");
    p.onSaved(`${choisies.size} journée(s) ajoutée(s) au planning`);
  }

  return (
    <Modal
      titre="Suggestion de planning"
      sousTitre="D'après les 8 dernières semaines, les heures contrat, les congés et les événements"
      onClose={p.onClose}
      pied={
        <>
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={appliquer} disabled={envoi || !choisies.size}>
            {envoi ? "Ajout…" : `Ajouter ${choisies.size} journée(s)`}
          </button>
        </>
      }
    >
      {joursEvt.length > 0 && (
        <div className="sugg-evts">
          {joursEvt.map(({ j, evts }) => (
            <span key={j} className={`pill ${evts.some((e) => e.sens === "hausse") ? "t-peach" : "t-blue"}`}>
              {JOURS_COURTS[(depuisIso(j).getDay() + 6) % 7]} {depuisIso(j).getDate()} : {evts.map((e) => `${e.nom} (${e.sens === "hausse" ? "↗" : "↘"} ${e.impact})`).join(", ")}
            </span>
          ))}
        </div>
      )}

      {!parMembre.length ? (
        <div className="empty">
          <b>Rien à suggérer</b>
          Il faut quelques semaines de planning pour que Juliette apprenne les habitudes de l&apos;équipe. Les cases déjà remplies et les congés ne sont jamais touchés.
        </div>
      ) : (
        <div className="sugg-liste">
          {parMembre.map(({ m, props }) => {
            const deja = p.existants.filter((c) => c.compte_id === m.id).reduce((t, c) => t + dureeCreneau(c), 0);
            const total = deja + props.filter((x) => choisies.has(cle(x))).reduce((t, x) => t + x.minutes, 0);
            const contrat = m.heures_contrat != null ? Number(m.heures_contrat) * 60 : null;
            return (
              <section key={m.id} className="sugg-personne">
                <div className="sugg-tete">
                  <b>{m.nom}</b>
                  <span className={`pill ${contrat && Math.abs(total - contrat) > contrat * 0.1 ? "t-peach" : "t-mint"}`}>
                    {formatDuree(total)}
                    {contrat ? ` / ${formatDuree(contrat)} contrat` : ""}
                  </span>
                </div>
                {props.map((x) => (
                  <label key={cle(x)} className={`sugg-ligne${choisies.has(cle(x)) ? " on" : ""}`}>
                    <input type="checkbox" checked={choisies.has(cle(x))} onChange={() => basculer(cle(x))} />
                    <span className="sugg-jour">
                      {JOURS_COURTS[(depuisIso(x.date).getDay() + 6) % 7]} {depuisIso(x.date).getDate()}
                    </span>
                    <span className="sugg-horaires">
                      {x.services.map((s) => `${s.debut}–${s.fin}${s.pause ? ` (${s.pause}′)` : ""}`).join(" / ")}
                    </span>
                    <small className="sugg-raison">{x.raison}</small>
                  </label>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {sansHistorique.length > 0 && parMembre.length > 0 && <p className="hint">Pas de proposition pour : {sansHistorique.map((m) => m.nom).join(", ")} (pas assez d&apos;historique, ou semaine déjà remplie).</p>}
      <p className="hint">Rien n&apos;est écrasé : seules les cases vides sont proposées. Plus tu valides de plannings, plus les suggestions collent à ton équipe.</p>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
