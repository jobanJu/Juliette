"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { FREQUENCES, MOMENTS, nouvelId, periodeDe } from "@/lib/haccp";
import type { Enregistrement, Nettoyage as Fait, Tache } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  compteId: string;
  gestion: boolean;
  plan: Tache[];
  faits: Enregistrement<Fait>[];
  /** Vue réduite : seulement les tâches du jour. */
  duJour?: boolean;
  onSaved: (message: string) => void;
};

export default function Nettoyage(p: Props) {
  const [edition, setEdition] = useState(false);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const sb = getSupabaseClient()!;

  const faitPour = (t: Tache) => p.faits.find((f) => f.data.tache_id === t.id && f.data.periode === periodeDe(t.frequence));

  async function cocher(t: Tache) {
    const f = faitPour(t);
    setEnvoi(t.id);
    if (f) {
      const { error } = await sb.from("haccp_enregistrements").delete().eq("id", f.id);
      setEnvoi(null);
      return p.onSaved(error ? "Décocher est réservé à l'auteur (15 min) ou à un responsable" : `« ${t.element} » décoché`);
    }
    const data: Fait = { tache_id: t.id, element: t.element, zone: t.zone, frequence: t.frequence, periode: periodeDe(t.frequence) };
    const { error } = await sb.from("haccp_enregistrements").insert({ etablissement_id: p.etablissementId, compte_id: p.compteId, type: "nettoyage", data });
    setEnvoi(null);
    p.onSaved(error ? "Enregistrement refusé" : `« ${t.element} » fait`);
  }

  const frequences = (p.duJour ? ["quotidien"] : ["quotidien", "hebdomadaire", "mensuel"]) as Tache["frequence"][];

  if (!p.plan.length) {
    return (
      <section className="card empty">
        <b>Aucun plan de nettoyage</b>
        {p.gestion ? "Crée le plan : ce qu'il faut nettoyer, comment, et à quelle fréquence." : "Un responsable doit d'abord créer le plan."}
        {p.gestion && (
          <p style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => setEdition(true)}>
              Créer le plan
            </button>
          </p>
        )}
        {edition && <ModalPlan {...p} onClose={() => setEdition(false)} />}
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {frequences.map((fr) => {
        const taches = p.plan.filter((t) => t.frequence === fr);
        if (!taches.length) return null;
        const nb = taches.filter((t) => faitPour(t)).length;
        const zones = [...new Set(taches.map((t) => t.zone))];
        return (
          <section key={fr} className="card">
            <div className="card-head">
              <h2>
                {FREQUENCES[fr].label} <span className="hint">· à faire {FREQUENCES[fr].periode}</span>
              </h2>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`pill ${nb === taches.length ? "t-mint" : "t-lav"}`}>
                  {nb} / {taches.length}
                </span>
                {p.gestion && !p.duJour && fr === "quotidien" && (
                  <button className="btn" style={{ height: 32 }} onClick={() => setEdition(true)}>
                    Modifier le plan
                  </button>
                )}
              </span>
            </div>
            <div className="bar" style={{ height: 6, marginBottom: 12 }}>
              <i style={{ width: `${(nb / taches.length) * 100}%`, background: "var(--mint-ink)" }} />
            </div>
            {zones.map((z) => (
              <div key={z} className="clean-zone">
                <div className="nav-label" style={{ padding: 0, margin: "10px 0 4px" }}>
                  {z}
                </div>
                {taches
                  .filter((t) => t.zone === z)
                  .map((t) => {
                    const f = faitPour(t);
                    return (
                      <label key={t.id} className={`clean-task${f ? " done" : ""}`}>
                        <input type="checkbox" checked={!!f} onChange={() => cocher(t)} disabled={envoi === t.id} />
                        <span className="clean-txt">
                          <b>{t.element}</b>
                          <small>
                            {t.methode}
                            {t.moment ? ` · ${MOMENTS[t.moment]}` : ""}
                          </small>
                        </span>
                        {f && (
                          <small className="clean-who">
                            {f.auteur.split(" ")[0]} · {new Date(f.created_at).toLocaleString("fr-FR", fr === "quotidien" ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                          </small>
                        )}
                      </label>
                    );
                  })}
              </div>
            ))}
          </section>
        );
      })}
      {edition && <ModalPlan {...p} onClose={() => setEdition(false)} />}
    </div>
  );
}

function ModalPlan({ etablissementId, plan, onClose, onSaved }: Props & { onClose: () => void }) {
  const [liste, setListe] = useState<Tache[]>(plan);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (id: string, c: Partial<Tache>) => setListe((l) => l.map((t) => (t.id === id ? { ...t, ...c } : t)));

  async function enregistrer() {
    const propres = liste.filter((t) => t.element.trim()).map((t) => ({ ...t, element: t.element.trim(), zone: t.zone.trim() || "Général", methode: t.methode.trim() }));
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_config").upsert({ etablissement_id: etablissementId, cle: "plan_nettoyage", data: propres }, { onConflict: "etablissement_id,cle" });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onClose();
    onSaved("Plan de nettoyage enregistré");
  }

  return (
    <Modal
      titre="Plan de nettoyage"
      sousTitre={`${liste.length} tâche(s)`}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer le plan"}
          </button>
        </>
      }
    >
      <div className="plan-list">
        {liste.map((t) => (
          <div key={t.id} className="plan-row">
            <input value={t.element} onChange={(x) => maj(t.id, { element: x.target.value })} placeholder="Quoi (ex. : plan de travail)" aria-label="Élément" />
            <input value={t.methode} onChange={(x) => maj(t.id, { methode: x.target.value })} placeholder="Comment" aria-label="Méthode" />
            <input value={t.zone} onChange={(x) => maj(t.id, { zone: x.target.value })} placeholder="Zone" aria-label="Zone" list="zones-plan" />
            <select value={t.frequence} onChange={(x) => maj(t.id, { frequence: x.target.value as Tache["frequence"] })} aria-label="Fréquence">
              {Object.entries(FREQUENCES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <button className="icon-btn" onClick={() => setListe((l) => l.filter((x) => x.id !== t.id))} aria-label="Retirer">
              ✕
            </button>
          </div>
        ))}
        <datalist id="zones-plan">
          {[...new Set(liste.map((t) => t.zone))].map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </div>
      <button className="btn" onClick={() => setListe((l) => [...l, { id: `n-${nouvelId()}`, zone: l.at(-1)?.zone ?? "Cuisine", element: "", methode: "", frequence: "quotidien" }])}>
        + Ajouter une tâche
      </button>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
