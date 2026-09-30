"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, useConnecte } from "@/lib/session";
import type { Compte } from "@/lib/session";
import {
  ajouterJours,
  alertesCoupure,
  congeLe,
  coupuresDuJour,
  creneauxFrequents,
  depuisIso,
  dureeCreneau,
  formatDuree,
  hm,
  iso,
  JOURS_COURTS,
  joursDeLaSemaine,
  libelleSemaine,
  lundi,
  minutesPointees,
  MOTIFS_ABSENCE,
  ORDRE_POSTES,
  POSTES,
} from "@/lib/planning";
import type { CongeValide, Creneau, Pointage } from "@/lib/planning";
import ModalCreneau from "@/components/planning/ModalCreneau";
import ModalPersonne from "@/components/planning/ModalPersonne";
import ModalSuggestion from "@/components/planning/ModalSuggestion";
import { suggererSemaine } from "@/lib/suggestion";
import type { JourEvenement } from "@/lib/suggestion";
import { COLONNES_EVT, reperes } from "@/lib/evenements";
import Icone from "@/components/Icone";

type Membre = Compte & { heures_contrat: number | null };

type Donnees = {
  membres: Membre[];
  creneaux: Creneau[];
  historique: Creneau[];
  pointages: Pointage[] | null;
  conges: CongeValide[];
  taux: Map<string, number> | null;
  evenements: JourEvenement[];
};

const COLONNES = "id, compte_id, date, type, heure_debut, heure_fin, pause_minutes, motif, note";

export default function Planning() {
  const { compte, etablissement, modules } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;

  const [semaine, setSemaine] = useState(() => lundi(new Date()));
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);
  const [filtre, setFiltre] = useState<string>("tous");
  const [reel, setReel] = useState(false);
  const [cellule, setCellule] = useState<{ compteId: string; date: string } | null>(null);
  const [personne, setPersonne] = useState<Membre | null>(null);
  const [copie, setCopie] = useState<{ etat: "confirmer" | "encours" } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [jourMobile, setJourMobile] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState(false);

  const jours = useMemo(() => joursDeLaSemaine(semaine), [semaine]);
  const aujourdhui = iso(new Date());

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let actif = true;
    const fin = ajouterJours(semaine, 6);
    // Pointages : du lundi 00h au lundi suivant 06h, pour attraper les services qui finissent après minuit.
    const lundiSuivant = depuisIso(ajouterJours(semaine, 7));
    lundiSuivant.setHours(6);
    Promise.all([
      sb.from("comptes").select("id, etablissement_id, prenom, nom, email, role, statut, poste, avatar_url, heures_contrat").eq("etablissement_id", etablissement.id).neq("statut", "parti"),
      sb.from("planning_creneaux").select(COLONNES).eq("etablissement_id", etablissement.id).gte("date", semaine).lte("date", fin),
      sb.from("planning_creneaux").select(COLONNES).eq("etablissement_id", etablissement.id).gte("date", ajouterJours(semaine, -56)).eq("type", "shift").limit(1000),
      modules.has("pointeuse")
        ? sb.from("pointages").select("compte_id, type, horodatage").eq("etablissement_id", etablissement.id).gte("horodatage", depuisIso(semaine).toISOString()).lt("horodatage", lundiSuivant.toISOString())
        : null,
      sb.from("conges").select("compte_id, date_debut, date_fin, motif").eq("etablissement_id", etablissement.id).eq("type", "conge").eq("statut", "validee").lte("date_debut", fin).gte("date_fin", semaine),
      compte.role === "directeur" ? sb.from("comptes_remuneration").select("compte_id, taux_brut").eq("etablissement_id", etablissement.id) : null,
      sb.from("evenements").select(COLONNES_EVT).eq("etablissement_id", etablissement.id).lte("date", fin).or(`date_fin.gte.${semaine},date.gte.${semaine}`),
    ])
      .then(([membres, creneaux, historique, pointages, conges, taux, evts]) => {
        if (!actif) return;
        if (membres.error || creneaux.error) throw new Error();
        setD({
          membres: (membres.data ?? []) as Membre[],
          creneaux: (creneaux.data ?? []) as Creneau[],
          historique: (historique.data ?? []) as Creneau[],
          pointages: pointages && !pointages.error ? (pointages.data as Pointage[]) : null,
          conges: (conges.data ?? []) as CongeValide[],
          taux: taux && !taux.error ? new Map(taux.data.map((t) => [t.compte_id, Number(t.taux_brut)])) : null,
          // Événements saisis + repères calculés (fériés, Braderie…) : ils pèsent sur la suggestion.
          evenements: [
            ...((evts.data ?? []) as JourEvenement[]),
            ...[...new Set([semaine, fin].map((j) => Number(j.slice(0, 4))))].flatMap((a) => reperes(a)).filter((e) => e.date <= fin && (e.date_fin ?? e.date) >= semaine),
          ],
        });
        setErreur(false);
      })
      .catch(() => actif && setErreur(true));
    return () => {
      actif = false;
    };
  }, [sb, semaine, etablissement.id, modules, compte.role, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const parCellule = useMemo(() => {
    const m = new Map<string, Creneau[]>();
    for (const c of d?.creneaux ?? []) {
      const k = `${c.compte_id}|${c.date}`;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    for (const l of m.values()) l.sort((a, b) => (a.heure_debut ?? "").localeCompare(b.heure_debut ?? ""));
    return m;
  }, [d]);

  const reelParCellule = useMemo(() => (d?.pointages ? minutesPointees(d.pointages) : null), [d]);
  const frequents = useMemo(() => creneauxFrequents(d?.historique ?? []), [d]);

  const groupes = useMemo(() => {
    const membres = (d?.membres ?? []).filter((m) => filtre === "tous" || (m.poste ?? "aucun") === filtre);
    const cles = [...ORDRE_POSTES, "aucun"];
    return cles
      .map((k) => ({
        cle: k,
        label: k === "aucun" ? "Poste non défini" : POSTES[k].label,
        ton: k === "aucun" ? "t-lav" : POSTES[k].ton,
        membres: membres.filter((m) => (m.poste ?? "aucun") === k).sort((a, b) => nomComplet(a).localeCompare(nomComplet(b))),
      }))
      .filter((g) => g.membres.length);
  }, [d, filtre]);

  const minutesPersonne = useCallback(
    (id: string) => jours.reduce((s, j) => s + (parCellule.get(`${id}|${j}`) ?? []).reduce((t, c) => t + dureeCreneau(c), 0), 0),
    [jours, parCellule],
  );

  const stats = useMemo(() => {
    if (!d) return null;
    let total = 0;
    let ecart = 0;
    let cout = 0;
    let planifies = 0;
    for (const m of d.membres) {
      const min = minutesPersonne(m.id);
      total += min;
      if (min > 0) planifies++;
      if (m.heures_contrat != null) ecart += min - Number(m.heures_contrat) * 60;
      if (d.taux?.has(m.id)) cout += (min / 60) * d.taux.get(m.id)!;
    }
    const parJour = jours.map((j) => {
      let min = 0;
      const presents = new Set<string>();
      for (const m of d.membres) {
        const l = parCellule.get(`${m.id}|${j}`) ?? [];
        const x = l.reduce((t, c) => t + dureeCreneau(c), 0);
        if (x > 0) presents.add(m.id);
        min += x;
      }
      return { min, nb: presents.size };
    });
    return { total, ecart, cout, planifies, parJour };
  }, [d, jours, parCellule, minutesPersonne]);

  async function copierSemainePrecedente() {
    if (!d) return;
    setCopie({ etat: "encours" });
    const precedente = ajouterJours(semaine, -7);
    const { data, error } = await sb
      .from("planning_creneaux")
      .select(COLONNES)
      .eq("etablissement_id", etablissement.id)
      .gte("date", precedente)
      .lte("date", ajouterJours(precedente, 6));
    if (error) {
      setCopie(null);
      return setToast("Impossible de lire la semaine précédente");
    }
    const actifs = new Set(d.membres.map((m) => m.id));
    const lignes = (data as Creneau[])
      .filter((c) => actifs.has(c.compte_id) && !parCellule.has(`${c.compte_id}|${ajouterJours(c.date, 7)}`))
      .map((c) => ({
        etablissement_id: etablissement.id,
        compte_id: c.compte_id,
        date: ajouterJours(c.date, 7),
        type: c.type,
        heure_debut: c.heure_debut,
        heure_fin: c.heure_fin,
        pause_minutes: c.pause_minutes,
        motif: c.motif,
        note: c.note,
        created_by: compte.id,
      }));
    if (!lignes.length) {
      setCopie(null);
      return setToast(data.length ? "Rien à copier : les cases concernées sont déjà remplies" : "La semaine précédente est vide");
    }
    const { error: e2 } = await sb.from("planning_creneaux").insert(lignes);
    setCopie(null);
    setToast(e2 ? "Copie refusée" : `${lignes.length} créneau(x) copié(s) depuis la semaine précédente`);
    recharger();
  }

  const membreCellule = cellule && d?.membres.find((m) => m.id === cellule.compteId);
  const moi = d?.membres.find((m) => m.id === compte.id);

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">Équipe</p>
          <h1>Planning</h1>
          <p>{gestion ? "Clique sur une case pour poser un créneau, un repos ou une absence." : "Ton planning et celui de l'équipe. Une erreur ? Signale-la à ton responsable."}</p>
        </div>
        <div className="toolbar">
          {d?.pointages && (
            <button className={`btn${reel ? " btn-on" : ""}`} onClick={() => setReel((r) => !r)} title="Comparer les heures prévues aux heures réellement pointées">
              <Icone nom="horloge" /> {reel ? "Masquer le réel" : "Comparer au pointage"}
            </button>
          )}
          <button className="btn" onClick={() => window.print()}>
            ⎙ Imprimer
          </button>
          {gestion && (
            <button className="btn" onClick={() => setSuggestion(true)} disabled={!d} title="Proposer la semaine d'après les habitudes de l'équipe, les contrats, les congés et les événements">
              Suggestion
            </button>
          )}
          {gestion && (
            <button className="btn btn-primary" onClick={() => setCopie({ etat: "confirmer" })} disabled={!d || copie?.etat === "encours"}>
              <Icone nom="copier" /> Copier la semaine précédente
            </button>
          )}
        </div>
      </div>

      {copie?.etat === "confirmer" && (
        <div className="banner print-hide">
          <span>
            Recopier les créneaux, repos et absences de la semaine du <b>{libelleSemaine(ajouterJours(semaine, -7))}</b> ? Seules les cases vides de cette semaine sont remplies, rien n&apos;est écrasé.
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setCopie(null)}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={copierSemainePrecedente}>
              Copier
            </button>
          </span>
        </div>
      )}

      <div className="week-nav">
        <div className="week-arrows">
          <button className="btn" onClick={() => setSemaine(ajouterJours(semaine, -7))} aria-label="Semaine précédente">
            ←
          </button>
          <div className="week-label">
            <b>Semaine du {libelleSemaine(semaine)}</b>
            <small>{semaine === lundi(new Date()) ? "Cette semaine" : ""}</small>
          </div>
          <button className="btn" onClick={() => setSemaine(ajouterJours(semaine, 7))} aria-label="Semaine suivante">
            →
          </button>
          {semaine !== lundi(new Date()) && (
            <button className="btn print-hide" onClick={() => setSemaine(lundi(new Date()))}>
              Aujourd&apos;hui
            </button>
          )}
        </div>
        <div className="chips print-hide">
          {["tous", ...ORDRE_POSTES, "aucun"]
            .filter((k) => k === "tous" || d?.membres.some((m) => (m.poste ?? "aucun") === k))
            .map((k) => (
              <button key={k} className={`chip${filtre === k ? " on" : ""}`} onClick={() => setFiltre(k)}>
                {k === "tous" ? "Toute l'équipe" : k === "aucun" ? "Sans poste" : POSTES[k].label}
              </button>
            ))}
        </div>
      </div>

      {stats && (
        <div className="grid-stats print-hide" style={{ marginBottom: 14 }}>
          <div className="card stat">
            <div className="stat-top">Heures prévues</div>
            <div className="stat-value">{formatDuree(stats.total)}</div>
            <div className="stat-foot">{stats.planifies} personne(s) planifiée(s)</div>
          </div>
          <div className="card stat">
            <div className="stat-top">Écart au contrat</div>
            <div className="stat-value" style={{ color: stats.ecart > 0 ? "var(--peach-ink)" : undefined }}>
              {stats.ecart > 0 ? "+" : stats.ecart < 0 ? "−" : ""}
              {formatDuree(Math.abs(stats.ecart))}
            </div>
            <div className="stat-foot">{stats.ecart > 0 ? "Heures sup. à prévoir" : stats.ecart < 0 ? "Heures contrat non planifiées" : "Pile dans les contrats"}</div>
          </div>
          <div className="card stat">
            <div className="stat-top">Jour le plus chargé</div>
            <div className="stat-value">
              {(() => {
                const i = stats.parJour.reduce((b, x, k, a) => (x.min > a[b].min ? k : b), 0);
                return stats.parJour[i].min ? JOURS_COURTS[i] : "—";
              })()}
            </div>
            <div className="stat-foot">{Math.max(...stats.parJour.map((x) => x.nb))} personne(s) au maximum</div>
          </div>
          {d?.taux ? (
            <div className="card stat">
              <div className="stat-top">Coût brut estimé</div>
              <div className="stat-value">{stats.cout.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</div>
              <div className="stat-foot">{d.taux.size ? "Heures prévues × taux horaire brut" : "Aucun taux horaire saisi"}</div>
            </div>
          ) : (
            <div className="card stat">
              <div className="stat-top">Absences validées</div>
              <div className="stat-value">{d?.conges.length ?? 0}</div>
              <div className="stat-foot">Congés RH sur la semaine</div>
            </div>
          )}
        </div>
      )}

      {!gestion && moi && d && (
        <section className="card my-week print-hide">
          <div className="card-head">
            <h2>Ma semaine</h2>
            <span className="pill t-lav">
              {formatDuree(minutesPersonne(moi.id))}
              {moi.heures_contrat != null ? ` / ${moi.heures_contrat}h` : ""}
            </span>
          </div>
          <div className="rows">
            {jours.map((j, i) => {
              const l = parCellule.get(`${moi.id}|${j}`) ?? [];
              const c = congeLe(d.conges, moi.id, j);
              return (
                <div key={j} className={`row${j === aujourdhui ? " row-today" : ""}`}>
                  <span className="main-txt">
                    <b>
                      {JOURS_COURTS[i]} {depuisIso(j).getDate()}
                    </b>
                  </span>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {l.length ? l.map((x) => <Slot key={x.id} c={x} />) : c ? <span className="slot slot-conge">Congé validé</span> : <span className="hint">Rien de prévu</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {erreur && <div className="error">Impossible de charger le planning. Vérifie ta connexion puis recharge la page.</div>}

      {d && d.membres.length > 0 && (
        <JourMobile
          jours={jours}
          jour={jourMobile && jours.includes(jourMobile) ? jourMobile : jours.includes(aujourdhui) ? aujourdhui : jours[0]}
          onJour={setJourMobile}
          groupes={groupes}
          parCellule={parCellule}
          conges={d.conges}
          gestion={gestion}
          moiId={compte.id}
          reel={reel ? reelParCellule : null}
          onCellule={(compteId, date) => setCellule({ compteId, date })}
        />
      )}

      <section className="card planning-card">
        {!d ? (
          <div style={{ display: "grid", gap: 10, padding: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48 }} />
            ))}
          </div>
        ) : !d.membres.length ? (
          <div className="empty">
            <b>Aucune personne dans l&apos;équipe</b>
            Ajoute des collaborateurs depuis le module Équipe pour démarrer le planning.
          </div>
        ) : (
          <div className="table-wrap">
            <div className="pgrid" role="grid" aria-label={`Planning de la semaine du ${libelleSemaine(semaine)}`}>
              <div className="pg-head pg-corner">Équipe</div>
              {jours.map((j, i) => (
                <div key={j} className={`pg-head${j === aujourdhui ? " today" : ""}`}>
                  <span>{JOURS_COURTS[i]}</span>
                  <b>{depuisIso(j).getDate()}</b>
                </div>
              ))}
              <div className="pg-head">Total</div>

              {groupes.map((g) => (
                <GroupeLignes key={g.cle}>
                  <div className="pg-group">
                    <span className={`dot ${g.ton}`} />
                    {g.label}
                    <small>{g.membres.length}</small>
                  </div>
                  {g.membres.map((m) => {
                    const min = minutesPersonne(m.id);
                    const contrat = m.heures_contrat != null ? Number(m.heures_contrat) * 60 : null;
                    const ratio = contrat ? Math.min(1.25, min / contrat) : 0;
                    return (
                      <div key={m.id} className="pg-row" role="row">
                        <button className="pg-person" onClick={() => gestion && setPersonne(m)} disabled={!gestion} title={gestion ? "Modifier le poste et les heures contrat" : undefined}>
                          <span className="avatar">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
                          <span className="who">
                            <b>
                              {nomComplet(m)}
                              {m.id === compte.id ? " (moi)" : ""}
                            </b>
                            <small>{contrat != null ? `${m.heures_contrat}h / sem.` : "Heures contrat ?"}</small>
                          </span>
                        </button>
                        {jours.map((j) => {
                          const l = parCellule.get(`${m.id}|${j}`) ?? [];
                          const conge = !l.length ? congeLe(d.conges, m.id, j) : undefined;
                          const prevu = l.reduce((t, c) => t + dureeCreneau(c), 0);
                          const fait = reelParCellule?.get(`${m.id}|${j}`) ?? 0;
                          return (
                            <button
                              key={j}
                              role="gridcell"
                              className={`pg-cell${j === aujourdhui ? " today" : ""}${gestion ? " editable" : ""}`}
                              onClick={() => gestion && setCellule({ compteId: m.id, date: j })}
                              disabled={!gestion}
                              aria-label={`${nomComplet(m)}, ${depuisIso(j).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })}`}
                            >
                              <Slots l={l} />
                              {conge && (
                                <span className="slot slot-conge slot-rh" title="Congé validé dans RH & congés">
                                  {MOTIFS_ABSENCE[conge.motif ?? ""] ?? "Congé"} · RH
                                </span>
                              )}
                              {!l.length && !conge && gestion && <span className="pg-plus">+</span>}
                              {reel && (prevu > 0 || fait > 0) && (
                                <span className={`pg-reel ${Math.abs(fait - prevu) <= 15 ? "ok" : fait > prevu ? "plus" : "moins"}`}>réel {formatDuree(fait)}</span>
                              )}
                            </button>
                          );
                        })}
                        <div className="pg-total">
                          <b>{formatDuree(min)}</b>
                          {contrat != null && (
                            <>
                              <span className="bar">
                                <i style={{ width: `${(ratio / 1.25) * 100}%`, background: min > contrat ? "var(--peach-ink)" : "var(--purple)" }} />
                              </span>
                              <small style={{ color: min > contrat ? "var(--peach-ink)" : undefined }}>
                                {min === contrat ? "= contrat" : `${min > contrat ? "+" : "−"}${formatDuree(Math.abs(min - contrat))}`}
                              </small>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </GroupeLignes>
              ))}

              <div className="pg-foot pg-corner">Total du jour</div>
              {stats?.parJour.map((x, i) => (
                <div key={i} className={`pg-foot${jours[i] === aujourdhui ? " today" : ""}`}>
                  <b>{x.min ? formatDuree(x.min) : "—"}</b>
                  <small>{x.nb ? `${x.nb} pers.` : ""}</small>
                </div>
              ))}
              <div className="pg-foot">
                <b>{stats ? formatDuree(stats.total) : ""}</b>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="legend print-hide">
        <span>
          <span className="slot slot-shift">09:00 – 15:00</span> Travail
        </span>
        <span>
          <span className="slot-coupure">coupure 3h</span> Coupure entre deux services
        </span>
        <span>
          <span className="slot slot-repos">Repos</span> Repos
        </span>
        <span>
          <span className="slot slot-conge">Absence</span> Absence posée au planning
        </span>
        <span>
          <span className="slot slot-conge slot-rh">Congé · RH</span> Congé validé dans RH & congés
        </span>
      </div>

      {cellule && membreCellule && d && (
        <ModalCreneau
          etablissementId={etablissement.id}
          auteurId={compte.id}
          personne={nomComplet(membreCellule)}
          compteId={cellule.compteId}
          date={cellule.date}
          semaine={jours}
          existants={d.creneaux.filter((c) => c.compte_id === cellule.compteId)}
          frequents={frequents}
          onClose={() => setCellule(null)}
          onSaved={(msg) => {
            setCellule(null);
            setToast(msg);
            recharger();
          }}
        />
      )}

      {suggestion && d && (
        <ModalSuggestion
          etablissementId={etablissement.id}
          auteurId={compte.id}
          semaine={jours}
          membres={d.membres.map((m) => ({ id: m.id, nom: nomComplet(m), heures_contrat: m.heures_contrat }))}
          propositions={suggererSemaine({ semaine: jours, membres: d.membres, historique: d.historique, existants: d.creneaux, conges: d.conges, evenements: d.evenements })}
          existants={d.creneaux}
          evenements={d.evenements}
          onClose={() => setSuggestion(false)}
          onSaved={(msg) => {
            setSuggestion(false);
            setToast(msg);
            recharger();
          }}
        />
      )}

      {personne && (
        <ModalPersonne
          compteId={personne.id}
          nom={nomComplet(personne)}
          poste={personne.poste}
          heuresContrat={personne.heures_contrat != null ? Number(personne.heures_contrat) : null}
          onClose={() => setPersonne(null)}
          onSaved={(msg) => {
            setPersonne(null);
            setToast(msg);
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

function GroupeLignes({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Les créneaux d'une case, avec la coupure affichée entre deux services. */
function Slots({ l }: { l: Creneau[] }) {
  const { coupures } = coupuresDuJour(l);
  const shifts = l.filter((c) => c.type === "shift");
  const alertes = alertesCoupure(l);
  return (
    <>
      {l.map((c) => {
        const i = shifts.indexOf(c);
        const cp = i >= 0 ? coupures.find((x) => x.apres === i) : undefined;
        return (
          <span key={c.id} style={{ display: "contents" }}>
            <Slot c={c} />
            {cp && (
              <span className={`slot-coupure${alertes.length ? " alerte" : ""}`} title={alertes.length ? alertes.join(" · ") : "Coupure entre deux services"}>
                {alertes.length ? "⚠ " : ""}coupure {formatDuree(cp.minutes)}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

function Slot({ c }: { c: Creneau }) {
  if (c.type === "shift") {
    return (
      <span className="slot slot-shift" title={c.note ?? undefined}>
        {hm(c.heure_debut)} – {hm(c.heure_fin)}
        {c.pause_minutes ? <small> · {c.pause_minutes}′</small> : null}
        {c.note ? <small> <Icone nom="modifier" taille={11} /></small> : null}
      </span>
    );
  }
  if (c.type === "repos") return <span className="slot slot-repos">Repos</span>;
  return (
    <span className="slot slot-conge" title={c.note ?? undefined}>
      {MOTIFS_ABSENCE[c.motif ?? "autre"] ?? "Absence"}
    </span>
  );
}

/** Téléphone : le planning d'un jour à la fois, l'équipe en liste, un toucher pour modifier. */
function JourMobile(p: {
  jours: string[];
  jour: string;
  onJour: (j: string) => void;
  groupes: { cle: string; label: string; ton: string; membres: Membre[] }[];
  parCellule: Map<string, Creneau[]>;
  conges: CongeValide[];
  gestion: boolean;
  moiId: string;
  reel: Map<string, number> | null;
  onCellule: (compteId: string, date: string) => void;
}) {
  const total = p.groupes.flatMap((g) => g.membres).reduce((t, m) => t + (p.parCellule.get(`${m.id}|${p.jour}`) ?? []).reduce((s, c) => s + dureeCreneau(c), 0), 0);
  const presents = p.groupes.flatMap((g) => g.membres).filter((m) => (p.parCellule.get(`${m.id}|${p.jour}`) ?? []).some((c) => c.type === "shift")).length;
  return (
    <div className="planning-mobile">
      <div className="jours-mobile">
        {p.jours.map((j, i) => {
          const n = p.groupes.flatMap((g) => g.membres).filter((m) => (p.parCellule.get(`${m.id}|${j}`) ?? []).some((c) => c.type === "shift")).length;
          return (
            <button key={j} className={j === p.jour ? "on" : ""} onClick={() => p.onJour(j)}>
              <small>{JOURS_COURTS[i]}</small>
              <b>{depuisIso(j).getDate()}</b>
              <i>{n ? `${n} pers.` : "—"}</i>
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ margin: "10px 2px" }}>
        <b style={{ textTransform: "capitalize" }}>{depuisIso(p.jour).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</b> · {presents} personne(s) · {formatDuree(total)}
      </p>
      {p.groupes.map((g) => (
        <section key={g.cle} className="card" style={{ padding: "8px 12px", marginBottom: 10 }}>
          <div className="pg-group" style={{ border: 0, padding: "6px 0" }}>
            <span className={`dot ${g.ton}`} />
            {g.label}
          </div>
          {g.membres.map((m) => {
            const l = p.parCellule.get(`${m.id}|${p.jour}`) ?? [];
            const conge = !l.length ? congeLe(p.conges, m.id, p.jour) : undefined;
            const fait = p.reel?.get(`${m.id}|${p.jour}`) ?? 0;
            return (
              <button key={m.id} className="jour-ligne" onClick={() => p.gestion && p.onCellule(m.id, p.jour)} disabled={!p.gestion}>
                <span className="avatar">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
                <span className="jour-nom">
                  <b>
                    {nomComplet(m)}
                    {m.id === p.moiId ? " (moi)" : ""}
                  </b>
                  {p.reel && fait > 0 && <small>réel {formatDuree(fait)}</small>}
                </span>
                <span className="jour-slots">
                  <Slots l={l} />
                  {conge && <span className="slot slot-conge slot-rh">Congé · RH</span>}
                  {!l.length && !conge && <span className="hint">{p.gestion ? "+ ajouter" : "—"}</span>}
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
