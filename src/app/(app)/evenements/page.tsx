"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { ajouterJours, depuisIso, iso, lundi } from "@/lib/planning";
import { COLONNES_EVT, couvre, IMPACTS, reperes, TYPES_EVT } from "@/lib/evenements";
import type { Evenement, Repere } from "@/lib/evenements";
import Modal from "@/components/Modal";

export default function Evenements() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;
  const [mois, setMois] = useState(() => iso(new Date()).slice(0, 7));
  const [evts, setEvts] = useState<Evenement[] | null>(null);
  const [edition, setEdition] = useState<Evenement | Partial<Evenement> | null>(null);
  const [voirReperes, setVoirReperes] = useState(true);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  const debutMois = mois + "-01";
  const finMois = iso(new Date(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0));
  const debutGrille = lundi(depuisIso(debutMois));
  const jours = useMemo(() => {
    const n = Math.ceil((depuisIso(finMois).getTime() - depuisIso(debutGrille).getTime()) / 864e5 / 7 + 0.01) * 7;
    return Array.from({ length: Math.max(35, n) }, (_, i) => ajouterJours(debutGrille, i));
  }, [debutGrille, finMois]);

  useEffect(() => {
    let vivant = true;
    const aujourdhui = iso(new Date());
    sb.from("evenements")
      .select(COLONNES_EVT)
      .eq("etablissement_id", etablissement.id)
      .or(`date.gte.${[debutGrille, aujourdhui].sort()[0]},date_fin.gte.${debutGrille}`)
      .lte("date", ajouterJours(finMois, 90))
      .order("date")
      .then(({ data }) => vivant && setEvts((data ?? []) as Evenement[]));
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, debutGrille, finMois, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const reps = useMemo(() => {
    const annees = [...new Set([jours[0], jours[jours.length - 1], ajouterJours(iso(new Date()), 60)].map((j) => Number(j.slice(0, 4))))];
    return annees.flatMap(reperes);
  }, [jours]);

  const aujourdhui = iso(new Date());
  const aVenir = useMemo(() => {
    const limite = ajouterJours(aujourdhui, 60);
    const perso = (evts ?? []).filter((e) => (e.date_fin ?? e.date) >= aujourdhui && e.date <= limite).map((e) => ({ ...e, repere: false as const }));
    const calc = voirReperes ? reps.filter((r) => (r.date_fin ?? r.date) >= aujourdhui && r.date <= limite && !(evts ?? []).some((e) => e.date === r.date && e.nom === r.nom)).map((r) => ({ ...r, repere: true as const })) : [];
    return [...perso, ...calc].sort((a, b) => a.date.localeCompare(b.date));
  }, [evts, reps, voirReperes, aujourdhui]);

  function decaler(n: number) {
    const d = depuisIso(debutMois);
    d.setMonth(d.getMonth() + n);
    setMois(iso(d).slice(0, 7));
  }

  async function ajouterRepere(r: Repere) {
    const { error } = await sb.from("evenements").insert({ etablissement_id: etablissement.id, nom: r.nom, date: r.date, date_fin: r.date_fin ?? null, type: r.type, sens: r.sens, impact: r.impact, created_by: compte.id });
    setToast(error ? "Ajout refusé : réservé aux responsables" : `« ${r.nom} » ajouté à ton calendrier`);
    recharger();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Pilotage</p>
          <h1>Événements</h1>
          <p>Concerts, matchs, marchés, jours fériés : tout ce qui fait varier l&apos;affluence, pour anticiper planning et commandes.</p>
        </div>
        {gestion && (
          <button className="btn btn-primary" onClick={() => setEdition({ date: aujourdhui, sens: "hausse", impact: "moyen", type: "Concert" })}>
            + Événement
          </button>
        )}
      </div>

      <div className="resa-grid">
        <section className="card" style={{ padding: 14 }}>
          <div className="card-head">
            <span className="week-arrows">
              <button className="btn" onClick={() => decaler(-1)} aria-label="Mois précédent">
                ←
              </button>
              <b style={{ textTransform: "capitalize", minWidth: 150, textAlign: "center" }}>{depuisIso(debutMois).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b>
              <button className="btn" onClick={() => decaler(1)} aria-label="Mois suivant">
                →
              </button>
            </span>
            <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={voirReperes} onChange={(e) => setVoirReperes(e.target.checked)} /> Jours fériés et grands rendez-vous
            </label>
          </div>
          <div className="cal-mois">
            {["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((j) => (
              <div key={j} className="cal-mois-head">
                {j}
              </div>
            ))}
            {jours.map((j) => {
              const du = (evts ?? []).filter((e) => couvre(e, j));
              const rp = voirReperes ? reps.filter((r) => couvre(r, j) && !du.some((e) => e.nom === r.nom)) : [];
              const horsMois = !j.startsWith(mois);
              return (
                <div
                  key={j}
                  className={`cal-jour${horsMois ? " hors" : ""}${j === aujourdhui ? " today" : ""}`}
                  onDoubleClick={() => gestion && setEdition({ date: j, sens: "hausse", impact: "moyen", type: "Concert" })}
                  title={gestion ? "Double-clic pour ajouter un événement" : undefined}
                >
                  <span className="cal-num">{depuisIso(j).getDate()}</span>
                  {du.map((e) => (
                    <button key={e.id} className={`cal-evt ${e.sens} impact-${e.impact}`} onClick={() => setEdition(e)} title={`${e.nom}${e.lieu ? ` · ${e.lieu}` : ""}`}>
                      {TYPES_EVT[e.type ?? "Autre"] ?? "✦"} {e.nom}
                    </button>
                  ))}
                  {rp.map((r) => (
                    <span key={r.nom} className="cal-evt repere" title={`${r.nom} (repère calculé)`}>
                      {TYPES_EVT[r.type] ?? "📅"} {r.nom}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span>
              <span className="cal-evt hausse" style={{ display: "inline-block" }}>▲</span> plus de monde
            </span>
            <span>
              <span className="cal-evt baisse" style={{ display: "inline-block" }}>▼</span> moins de monde
            </span>
            <span>
              <span className="cal-evt repere" style={{ display: "inline-block" }}>📅</span> repère calculé
            </span>
          </div>
        </section>

        <section className="card" style={{ alignSelf: "start" }}>
          <div className="card-head">
            <h2>Les 60 prochains jours</h2>
          </div>
          {!evts ? (
            <div className="skeleton" style={{ height: 160 }} />
          ) : !aVenir.length ? (
            <div className="empty">Rien de prévu.</div>
          ) : (
            <div className="rows">
              {aVenir.map((e, i) => (
                <div key={("id" in e && e.id) || `${e.nom}${i}`} className="row">
                  <span className={`chip-ic ${e.sens === "hausse" ? "t-yellow" : "t-blue"}`}>{TYPES_EVT[e.type ?? "Autre"] ?? "✦"}</span>
                  <button className="main-txt resa-main" onClick={() => !e.repere && setEdition(e as Evenement)} style={{ cursor: e.repere ? "default" : "pointer" }}>
                    <b>{e.nom}</b>
                    <small>
                      {depuisIso(e.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                      {e.date_fin && e.date_fin !== e.date ? ` → ${depuisIso(e.date_fin).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}
                      {"lieu" in e && e.lieu ? ` · ${e.lieu}` : ""}
                    </small>
                  </button>
                  {e.repere ? (
                    gestion ? (
                      <button className="btn" style={{ height: 28 }} onClick={() => ajouterRepere(e)} title="L'ajouter à ton calendrier pour ajuster l'impact">
                        + Ajouter
                      </button>
                    ) : null
                  ) : (
                    <span className={`pill ${e.sens === "hausse" ? "t-yellow" : "t-blue"}`}>
                      {e.sens === "hausse" ? "▲" : "▼"} {IMPACTS[e.impact].label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {edition && (
        <ModalEvenement
          etablissementId={etablissement.id}
          compteId={compte.id}
          gestion={gestion}
          evt={edition}
          onClose={() => setEdition(null)}
          onSaved={(m) => {
            setEdition(null);
            setToast(m);
            recharger();
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function ModalEvenement({ etablissementId, compteId, gestion, evt, onClose, onSaved }: { etablissementId: string; compteId: string; gestion: boolean; evt: Partial<Evenement>; onClose: () => void; onSaved: (m: string) => void }) {
  const [nom, setNom] = useState(evt.nom ?? "");
  const [date, setDate] = useState(evt.date ?? iso(new Date()));
  const [dateFin, setDateFin] = useState(evt.date_fin ?? "");
  const [lieu, setLieu] = useState(evt.lieu ?? "");
  const [type, setType] = useState(evt.type ?? "Autre");
  const [sens, setSens] = useState<Evenement["sens"]>(evt.sens ?? "hausse");
  const [impact, setImpact] = useState<Evenement["impact"]>(evt.impact ?? "moyen");
  const [note, setNote] = useState(evt.note ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [suppr, setSuppr] = useState(false);
  const sb = getSupabaseClient()!;
  const lecture = !gestion;

  async function enregistrer() {
    if (!nom.trim()) return setErreur("Donne un nom à l'événement.");
    if (dateFin && dateFin < date) return setErreur("La date de fin est avant la date de début.");
    const ligne = { etablissement_id: etablissementId, nom: nom.trim(), date, date_fin: dateFin || null, lieu: lieu.trim() || null, type, sens, impact, note: note.trim() || null };
    const { error } = evt.id ? await sb.from("evenements").update(ligne).eq("id", evt.id) : await sb.from("evenements").insert({ ...ligne, created_by: compteId });
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onSaved(evt.id ? "Événement modifié" : "Événement ajouté");
  }

  async function supprimer() {
    const { error } = await sb.from("evenements").delete().eq("id", evt.id!);
    if (error) return setErreur("Suppression refusée.");
    onSaved("Événement supprimé");
  }

  return (
    <Modal
      titre={evt.id ? evt.nom ?? "Événement" : "Nouvel événement"}
      onClose={onClose}
      pied={
        lecture ? (
          <button className="btn" onClick={onClose}>
            Fermer
          </button>
        ) : (
          <>
            {evt.id && (
              <span style={{ marginRight: "auto" }}>
                {!suppr ? (
                  <button className="btn btn-danger-ghost" onClick={() => setSuppr(true)}>
                    Supprimer
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={supprimer}>
                    Confirmer
                  </button>
                )}
              </span>
            )}
            <button className="btn" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={enregistrer}>
              Enregistrer
            </button>
          </>
        )
      }
    >
      <fieldset disabled={lecture} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 14 }}>
        <div className="field">
          <label htmlFor="ev-nom">Nom</label>
          <input id="ev-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Concert au Zénith, derby LOSC" autoFocus={!evt.id} />
        </div>
        <div className="field">
          <label>Type</label>
          <div className="chips">
            {Object.entries(TYPES_EVT).map(([t, i]) => (
              <button key={t} className={`chip${type === t ? " on" : ""}`} onClick={() => setType(t)}>
                {i} {t}
              </button>
            ))}
          </div>
        </div>
        <div className="form-2">
          <div className="field">
            <label htmlFor="ev-date">Du</label>
            <input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev-fin">Au (facultatif)</label>
            <input id="ev-fin" type="date" value={dateFin} min={date} onChange={(e) => setDateFin(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ev-lieu">Lieu</label>
          <input id="ev-lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Ex. : Stade Pierre-Mauroy" />
        </div>
        <div className="form-2">
          <div className="field">
            <label>Effet sur l&apos;affluence</label>
            <div className="seg seg-2">
              <button className={sens === "hausse" ? "on" : ""} onClick={() => setSens("hausse")}>
                ▲ Plus de monde
              </button>
              <button className={sens === "baisse" ? "on" : ""} onClick={() => setSens("baisse")}>
                ▼ Moins
              </button>
            </div>
          </div>
          <div className="field">
            <label>Intensité</label>
            <select value={impact} onChange={(e) => setImpact(e.target.value as Evenement["impact"])}>
              {Object.entries(IMPACTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ev-note">Note</label>
          <input id="ev-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : renfort en salle, commander plus de bière" />
        </div>
      </fieldset>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
