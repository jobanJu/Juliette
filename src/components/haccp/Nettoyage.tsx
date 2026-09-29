"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { enRetard, FREQUENCES, JOURS_COURTS, libelleRythme, MOMENTS, nouvelId, passages, prevueLe } from "@/lib/haccp";
import type { Enregistrement, Nettoyage as Fait, Tache } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  compteId: string;
  /** Accréditation « paramètres HACCP » : peut modifier le plan. */
  parametres: boolean;
  plan: Tache[];
  faits: Enregistrement<Fait>[];
  /** Vue réduite : seulement les tâches du jour. */
  duJour?: boolean;
  onConfigurer?: () => void;
  onSaved: (message: string) => void;
};

// Plan de nettoyage (maquette p. 4) : un onglet par zone (cuisine, plonge, bar, salle…), une carte
// par tâche avec un passage par ligne ; ✓ fait, ✕ pas fait (noté comme non-conformité).
export default function Nettoyage(p: Props) {
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [zone, setZone] = useState<string>("tout");
  const sb = getSupabaseClient()!;
  const maintenant = new Date();

  const zones = useMemo(() => [...new Set(p.plan.map((t) => t.zone))], [p.plan]);
  const pour = (t: Tache, periode: string) => p.faits.find((f) => f.data.tache_id === t.id && f.data.periode === periode);

  async function marquer(t: Tache, periode: string, nonFait: boolean) {
    const f = pour(t, periode);
    setEnvoi(`${t.id}|${periode}`);
    if (f) {
      const { error } = await sb.from("haccp_enregistrements").delete().eq("id", f.id);
      setEnvoi(null);
      if (error) return p.onSaved("Annuler est réservé à l'auteur (15 min) ou à un responsable");
      if (!!f.data.non_fait === nonFait) return p.onSaved(`« ${t.element} » remis à faire`);
    }
    let remarque: string | undefined;
    if (nonFait) {
      const r = prompt(`« ${t.element} » pas fait : pourquoi ? (facultatif)`);
      if (r === null) return setEnvoi(null);
      remarque = r.trim() || undefined;
    }
    const data: Fait = { tache_id: t.id, element: t.element, zone: t.zone, frequence: t.frequence, periode, ...(nonFait ? { non_fait: true } : {}), ...(remarque ? { remarque } : {}) };
    const { error } = await sb.from("haccp_enregistrements").insert({ etablissement_id: p.etablissementId, compte_id: p.compteId, type: "nettoyage", data });
    setEnvoi(null);
    p.onSaved(error ? "Enregistrement refusé" : nonFait ? `« ${t.element} » noté non fait` : `« ${t.element} » fait`);
  }

  if (!p.plan.length) {
    return (
      <section className="card empty">
        <b>Aucun plan de nettoyage</b>
        {p.parametres ? "Crée le plan : ce qu'il faut nettoyer, où, comment, et quand." : "Un responsable doit d'abord créer le plan."}
        {p.parametres && p.onConfigurer && (
          <p style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={p.onConfigurer}>
              Créer le plan
            </button>
          </p>
        )}
      </section>
    );
  }

  const frequences = (p.duJour ? ["quotidien"] : ["quotidien", "hebdomadaire", "mensuel"]) as Tache["frequence"][];
  const visibles = p.plan.filter((t) => (zone === "tout" || t.zone === zone) && (!p.duJour || prevueLe(t, maintenant)));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!p.duJour && zones.length > 1 && (
        <div className="tabs-scroll print-hide" style={{ marginBottom: 0 }}>
          <div className="haccp-tabs haccp-subtabs" role="tablist" aria-label="Zones">
            {["tout", ...zones].map((z) => {
              const taches = p.plan.filter((t) => (z === "tout" || t.zone === z) && t.frequence === "quotidien");
              const retard = taches.some((t) => enRetard(t, passages(t, maintenant).filter((per) => !pour(t, per)).length, maintenant));
              return (
                <button key={z} role="tab" aria-selected={zone === z} className={zone === z ? "on" : ""} onClick={() => setZone(z)}>
                  {z === "tout" ? "Toutes les zones" : z}
                  {retard && <span className="dot-alerte" aria-label="tâche en retard" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {frequences.map((fr) => {
        const taches = visibles.filter((t) => t.frequence === fr);
        if (!taches.length) return null;
        const tous = taches.flatMap((t) => passages(t, maintenant).map((per) => pour(t, per)));
        const nb = tous.filter((f) => f && !f.data.non_fait).length;
        return (
          <section key={fr} className="card">
            <div className="card-head">
              <h2>
                {FREQUENCES[fr].label} <span className="hint">· à faire {FREQUENCES[fr].periode}</span>
              </h2>
              <span className={`pill ${nb === tous.length ? "t-mint" : "t-lav"}`}>
                {nb} / {tous.length}
              </span>
            </div>
            <div className="bar" style={{ height: 6, marginBottom: 12 }}>
              <i style={{ width: `${tous.length ? (nb / tous.length) * 100 : 0}%`, background: "var(--mint-ink)" }} />
            </div>
            <div className="clean-cards">
              {taches.map((t) => {
                const pers = passages(t, maintenant);
                const restants = pers.filter((per) => !pour(t, per)).length;
                const retard = enRetard(t, restants, maintenant);
                return (
                  <div key={t.id} className={`clean-card${!pers.length ? " off" : retard ? " retard" : restants === 0 ? " done" : ""}`}>
                    <div className="clean-card-head">
                      <b>{t.element}</b>
                      <small>
                        {zone === "tout" && `${t.zone} · `}
                        {libelleRythme(t)}
                        {t.moment ? ` · ${MOMENTS[t.moment]}` : ""}
                      </small>
                      {t.methode && <small className="hint">{t.methode}</small>}
                      {retard && <span className="pill t-red">En retard</span>}
                    </div>
                    {!pers.length ? (
                      <div className="clean-pass off">Pas prévu aujourd&apos;hui</div>
                    ) : (
                      pers.map((per, i) => {
                        const f = pour(t, per);
                        const cle = `${t.id}|${per}`;
                        return (
                          <div key={per} className={`clean-pass${f ? (f.data.non_fait ? " non" : " oui") : ""}`}>
                            <button className="clean-x" onClick={() => marquer(t, per, true)} disabled={envoi === cle} aria-label={`${t.element}, passage ${i + 1} : pas fait`} aria-pressed={!!f?.data.non_fait}>
                              ✕
                            </button>
                            <span className="clean-pass-txt">
                              {pers.length > 1 && <small>Passage {i + 1}</small>}
                              {f ? (
                                <small>
                                  {f.auteur.split(" ")[0]} · {new Date(f.created_at).toLocaleString("fr-FR", fr === "quotidien" ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                                  {f.data.remarque ? ` · ${f.data.remarque}` : ""}
                                </small>
                              ) : (
                                <small className="hint">à faire</small>
                              )}
                            </span>
                            <button className="clean-v" onClick={() => marquer(t, per, false)} disabled={envoi === cle} aria-label={`${t.element}, passage ${i + 1} : fait`} aria-pressed={!!f && !f.data.non_fait}>
                              ✓
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ModalPlan({ etablissementId, plan, onClose, onSaved }: { etablissementId: string; plan: Tache[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [liste, setListe] = useState<Tache[]>(plan);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (id: string, c: Partial<Tache>) => setListe((l) => l.map((t) => (t.id === id ? { ...t, ...c } : t)));
  const deplacer = (i: number, d: -1 | 1) =>
    setListe((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function enregistrer() {
    const propres = liste
      .filter((t) => t.element.trim())
      .map((t) => ({ ...t, element: t.element.trim(), zone: t.zone.trim() || "Général", methode: t.methode.trim(), fois: t.fois && t.fois > 1 ? t.fois : undefined, jours: t.jours?.length && t.jours.length < 7 ? t.jours : undefined, heure: t.heure || undefined }));
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_config").upsert({ etablissement_id: etablissementId, cle: "plan_nettoyage", data: propres }, { onConflict: "etablissement_id,cle" });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : il faut l'accréditation « paramètres HACCP ».");
    onSaved("Plan de nettoyage enregistré");
  }

  return (
    <Modal
      titre="Paramètres du plan de nettoyage"
      sousTitre={`${liste.length} tâche(s) · zones, passages, jours et heure limite`}
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
        {liste.map((t, i) => (
          <div key={t.id} className="plan-card">
            <div className="plan-row">
              <input value={t.element} onChange={(x) => maj(t.id, { element: x.target.value })} placeholder="Quoi (ex. : four)" aria-label="Élément" />
              <input value={t.zone} onChange={(x) => maj(t.id, { zone: x.target.value })} placeholder="Zone" aria-label="Zone" list="zones-plan" />
              <span style={{ display: "flex", gap: 4 }}>
                <button className="icon-btn" onClick={() => deplacer(i, -1)} aria-label="Monter" disabled={i === 0}>
                  ↑
                </button>
                <button className="icon-btn" onClick={() => deplacer(i, 1)} aria-label="Descendre" disabled={i === liste.length - 1}>
                  ↓
                </button>
                <button className="icon-btn" onClick={() => setListe((l) => l.filter((x) => x.id !== t.id))} aria-label="Retirer">
                  ✕
                </button>
              </span>
            </div>
            <input value={t.methode} onChange={(x) => maj(t.id, { methode: x.target.value })} placeholder="Comment (produit, méthode)" aria-label="Méthode" className="plan-methode" />
            <div className="plan-rythme">
              <select value={t.frequence} onChange={(x) => maj(t.id, { frequence: x.target.value as Tache["frequence"] })} aria-label="Fréquence">
                {Object.entries(FREQUENCES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <select value={t.fois ?? 1} onChange={(x) => maj(t.id, { fois: Number(x.target.value) })} aria-label="Passages">
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} fois
                  </option>
                ))}
              </select>
              <label className="plan-heure">
                avant
                <input type="time" value={t.heure ?? ""} onChange={(x) => maj(t.id, { heure: x.target.value })} aria-label="Heure limite" />
              </label>
            </div>
            {t.frequence === "quotidien" && (
              <div className="plan-jours" role="group" aria-label="Jours concernés">
                {[1, 2, 3, 4, 5, 6, 0].map((j) => {
                  const on = !t.jours?.length || t.jours.includes(j);
                  return (
                    <button
                      key={j}
                      className={on ? "on" : ""}
                      aria-pressed={on}
                      onClick={() => {
                        const actuels = t.jours?.length ? t.jours : [0, 1, 2, 3, 4, 5, 6];
                        const suite = on ? actuels.filter((x) => x !== j) : [...actuels, j];
                        maj(t.id, { jours: suite.length ? suite : [j] });
                      }}
                    >
                      {JOURS_COURTS[j]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <datalist id="zones-plan">
          {[...new Set(["Cuisine", "Plonge", "Bar", "Salle", ...liste.map((t) => t.zone)])].map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </div>
      <button className="btn" onClick={() => setListe((l) => [...l, { id: `n-${nouvelId()}`, zone: l.at(-1)?.zone ?? "Cuisine", element: "", methode: "", frequence: "quotidien" }])}>
        + Ajouter une tâche
      </button>
      <p className="hint">Exemple : « Four », zone Cuisine, chaque jour, 1 fois, du lundi au jeudi, avant 22h00 : passé 22h, la tâche non faite s&apos;affiche en retard.</p>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
