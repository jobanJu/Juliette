"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, useConnecte } from "@/lib/session";
import type { Compte } from "@/lib/session";
import { ajouterJours, depuisIso, dureeCreneau, formatDuree, hm, iso, JOURS_COURTS, joursDeLaSemaine, libelleSemaine, lundi, POSTES } from "@/lib/planning";
import type { Creneau } from "@/lib/planning";
import { csv, ecartMinutes, etatService, heure, minutesPause, minutesService, services, servicesDuJour, TOLERANCE_MIN } from "@/lib/pointage";
import type { PointageBrut, Service } from "@/lib/pointage";
import MonPointage from "@/components/pointage/MonPointage";
import ModalCorrection from "@/components/pointage/ModalCorrection";

type Membre = Compte & { heures_contrat: number | null };
type Onglet = "jour" | "semaine";

type Donnees = {
  membres: Membre[];
  pointages: PointageBrut[];
  creneaux: Creneau[];
  pauseActive: boolean;
};

export default function Pointeuse() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;

  const [onglet, setOnglet] = useState<Onglet>(gestion ? "jour" : "semaine");
  const [semaine, setSemaine] = useState(() => lundi(new Date()));
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);
  const [toutLeMonde, setToutLeMonde] = useState(false);
  const [correction, setCorrection] = useState<{ compteId: string; jour: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const jour = iso(new Date(maintenant));
  const jours = useMemo(() => joursDeLaSemaine(semaine), [semaine]);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let actif = true;
    const debut = [semaine, ajouterJours(jour, -1)].sort()[0];
    const fin = [ajouterJours(semaine, 7), ajouterJours(jour, 1)].sort()[1];
    Promise.all([
      sb.from("comptes").select("id, etablissement_id, prenom, nom, email, role, statut, poste, avatar_url, heures_contrat").eq("etablissement_id", etablissement.id).eq("statut", "actif"),
      sb
        .from("pointages")
        .select("id, compte_id, type, horodatage, manuel, justificatif, responsable_id")
        .eq("etablissement_id", etablissement.id)
        .gte("horodatage", depuisIso(debut).toISOString())
        .lt("horodatage", depuisIso(fin).toISOString())
        .order("horodatage")
        .limit(5000),
      sb.from("planning_creneaux").select("id, compte_id, date, type, heure_debut, heure_fin, pause_minutes, motif, note").eq("etablissement_id", etablissement.id).gte("date", debut).lt("date", fin),
      sb.from("etablissements").select("pause_pointage_active").eq("id", etablissement.id).single(),
    ]).then(([m, p, c, e]) => {
      if (!actif) return;
      if (m.error || p.error) return setErreur(true);
      setErreur(false);
      setD({
        membres: (m.data ?? []) as Membre[],
        pointages: (p.data ?? []) as PointageBrut[],
        creneaux: (c.data ?? []) as Creneau[],
        pauseActive: e.data?.pause_pointage_active === true,
      });
    });
    return () => {
      actif = false;
    };
  }, [sb, etablissement.id, semaine, jour, version]);

  // Horloge pour les durées en cours, et rafraîchissement régulier de la vue équipe.
  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (!gestion || onglet !== "jour") return;
    const i = setInterval(recharger, 60000);
    return () => clearInterval(i);
  }, [gestion, onglet, recharger]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const tous = useMemo(() => (d ? services(d.pointages) : []), [d]);
  const duJour = useMemo(() => servicesDuJour(tous, jour, maintenant), [tous, jour, maintenant]);
  const creneauxDe = useCallback((compteId: string, date: string) => (d?.creneaux ?? []).filter((c) => c.compte_id === compteId && c.date === date), [d]);

  const monService = duJour.filter((s) => s.compteId === compte.id).at(-1);

  async function basculerPause() {
    if (!d) return;
    const { error } = await sb.from("etablissements").update({ pause_pointage_active: !d.pauseActive }).eq("id", etablissement.id);
    if (error) return setToast("Réglage refusé : réservé au directeur");
    setToast(!d.pauseActive ? "Les pauses se pointent désormais" : "Les pauses ne se pointent plus");
    recharger();
  }

  const lignesJour = useMemo(() => {
    if (!d) return [];
    return d.membres
      .map((m) => {
        const servs = duJour.filter((s) => s.compteId === m.id);
        const prevus = creneauxDe(m.id, jour);
        return { m, servs, prevus };
      })
      .filter((l) => toutLeMonde || l.servs.length || l.prevus.some((c) => c.type === "shift"))
      .sort((a, b) => {
        const debut = (l: typeof a) => l.servs[0]?.arrivee.horodatage.slice(11, 16) ?? l.prevus.find((c) => c.type === "shift")?.heure_debut ?? "99";
        return debut(a).localeCompare(debut(b));
      });
  }, [d, duJour, creneauxDe, jour, toutLeMonde]);

  const resumeJour = useMemo(() => {
    let presents = 0;
    let retards = 0;
    let absents = 0;
    const nowIso = new Date(maintenant).toISOString();
    for (const l of lignesJour) {
      const etat = etatService(l.servs.at(-1));
      if (etat === "service" || etat === "pause") presents++;
      const premier = l.prevus.filter((c) => c.type === "shift").sort((a, b) => a.heure_debut!.localeCompare(b.heure_debut!))[0];
      if (premier && l.servs[0] && ecartMinutes(l.servs[0].arrivee.horodatage, premier.heure_debut!, jour) > TOLERANCE_MIN) retards++;
      if (premier && !l.servs.length && ecartMinutes(nowIso, premier.heure_debut!, jour) > TOLERANCE_MIN) absents++;
    }
    return { presents, retards, absents };
  }, [lignesJour, maintenant, jour]);

  const membresSemaine = useMemo(() => (d ? (gestion ? d.membres : d.membres.filter((m) => m.id === compte.id)) : []), [d, gestion, compte.id]);

  const reelSemaine = useCallback(
    (compteId: string, date: string) => tous.filter((s) => s.compteId === compteId && s.date === date).reduce((t, s) => t + minutesService(s, maintenant), 0),
    [tous, maintenant],
  );
  const prevuSemaine = useCallback((compteId: string, date: string) => creneauxDe(compteId, date).reduce((t, c) => t + dureeCreneau(c), 0), [creneauxDe]);

  function exporter() {
    if (!d) return;
    const lignes: (string | number)[][] = [["Collaborateur", "Date", "Arrivée", "Départ", "Pauses (min)", "Travaillé (h)", "Prévu (h)", "Corrigé", "Motif"]];
    for (const m of membresSemaine) {
      for (const j of jours) {
        for (const s of tous.filter((x) => x.compteId === m.id && x.date === j)) {
          lignes.push([
            nomComplet(m),
            depuisIso(j).toLocaleDateString("fr-FR"),
            heure(s.arrivee.horodatage),
            s.depart ? heure(s.depart.horodatage) : "en cours",
            Math.round(minutesPause(s)),
            (minutesService(s) / 60).toFixed(2).replace(".", ","),
            (prevuSemaine(m.id, j) / 60).toFixed(2).replace(".", ","),
            s.evenements.some((e) => e.manuel) ? "oui" : "",
            s.evenements.map((e) => e.justificatif).filter(Boolean).join(" · "),
          ]);
        }
      }
    }
    const blob = new Blob(["﻿" + csv(lignes)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pointages-${etablissement.code}-${semaine}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const membreCorrection = correction && d?.membres.find((m) => m.id === correction.compteId);
  const evenementsCorrection = correction
    ? tous.filter((s) => s.compteId === correction.compteId && (s.date === correction.jour || (correction.jour === jour && !s.depart))).flatMap((s) => s.evenements)
    : [];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Équipe</p>
          <h1>Pointage</h1>
          <p>{gestion ? "Qui est là, qui est en retard, et les heures réelles de la semaine." : "Pointe ton arrivée et ton départ, et retrouve tes heures."}</p>
        </div>
        {compte.role === "directeur" && d && (
          <label className="switch" title="Demander aux salariés de pointer le début et la fin de leurs pauses">
            <input type="checkbox" checked={d.pauseActive} onChange={basculerPause} />
            <span className="switch-track" />
            Pointer les pauses
          </label>
        )}
      </div>

      {erreur && <div className="error" style={{ marginBottom: 14 }}>Impossible de charger les pointages. Vérifie ta connexion puis recharge la page.</div>}

      {!d ? (
        <div className="skeleton" style={{ height: 190, borderRadius: 14 }} />
      ) : (
        <MonPointage
          etablissementId={etablissement.id}
          compteId={compte.id}
          prenom={compte.prenom ?? ""}
          jour={jour}
          service={monService}
          creneaux={creneauxDe(compte.id, jour)}
          pauseActive={d.pauseActive}
          onPointe={(msg) => {
            setToast(msg);
            recharger();
          }}
        />
      )}

      <div className="week-nav" style={{ marginTop: 22 }}>
        <div className="seg seg-inline" role="tablist">
          {gestion && (
            <button role="tab" aria-selected={onglet === "jour"} className={onglet === "jour" ? "on" : ""} onClick={() => setOnglet("jour")}>
              Aujourd&apos;hui
            </button>
          )}
          <button role="tab" aria-selected={onglet === "semaine"} className={onglet === "semaine" ? "on" : ""} onClick={() => setOnglet("semaine")}>
            {gestion ? "Semaine" : "Mes heures"}
          </button>
        </div>
        {onglet === "jour" ? (
          <label style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={toutLeMonde} onChange={(e) => setToutLeMonde(e.target.checked)} /> Afficher aussi les personnes non prévues
          </label>
        ) : (
          <div className="week-arrows">
            <button className="btn" onClick={() => setSemaine(ajouterJours(semaine, -7))} aria-label="Semaine précédente">
              ←
            </button>
            <div className="week-label">
              <b>{libelleSemaine(semaine)}</b>
              <small>{semaine === lundi(new Date()) ? "Cette semaine" : ""}</small>
            </div>
            <button className="btn" onClick={() => setSemaine(ajouterJours(semaine, 7))} aria-label="Semaine suivante">
              →
            </button>
            <button className="btn" onClick={exporter} disabled={!d} title="Fichier CSV pour la paie (Excel, Numbers…)">
              ⤓ Exporter
            </button>
          </div>
        )}
      </div>

      {onglet === "jour" && gestion && d && (
        <>
          <div className="grid-stats" style={{ marginBottom: 14 }}>
            <div className="card stat">
              <div className="stat-top">Présents maintenant</div>
              <div className="stat-value">{resumeJour.presents}</div>
              <div className="stat-foot">en service ou en pause</div>
            </div>
            <div className="card stat">
              <div className="stat-top">Retards</div>
              <div className="stat-value" style={{ color: resumeJour.retards ? "var(--peach-ink)" : undefined }}>
                {resumeJour.retards}
              </div>
              <div className="stat-foot">plus de {TOLERANCE_MIN} min après l&apos;heure prévue</div>
            </div>
            <div className="card stat">
              <div className="stat-top">Pas encore arrivés</div>
              <div className="stat-value" style={{ color: resumeJour.absents ? "var(--red-ink)" : undefined }}>
                {resumeJour.absents}
              </div>
              <div className="stat-foot">alors que leur créneau a commencé</div>
            </div>
            <div className="card stat">
              <div className="stat-top">Heures pointées</div>
              <div className="stat-value">{formatDuree(duJour.reduce((t, s) => t + minutesService(s, maintenant), 0))}</div>
              <div className="stat-foot">aujourd&apos;hui, toute l&apos;équipe</div>
            </div>
          </div>

          <section className="card" style={{ padding: "16px 6px 6px" }}>
            {!lignesJour.length ? (
              <div className="empty">
                <b>Personne n&apos;est prévu ni n&apos;a pointé aujourd&apos;hui</b>
                Coche « Afficher aussi les personnes non prévues » pour ajouter un pointage oublié.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Collaborateur</th>
                      <th>Prévu</th>
                      <th>Arrivée</th>
                      <th>Départ</th>
                      <th>Pause</th>
                      <th>Travaillé</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lignesJour.map(({ m, servs, prevus }) => (
                      <LigneJour
                        key={m.id}
                        m={m}
                        servs={servs}
                        prevus={prevus}
                        jour={jour}
                        maintenant={maintenant}
                        onCorriger={() => setCorrection({ compteId: m.id, jour })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {onglet === "semaine" && d && (
        <section className="card" style={{ padding: "16px 6px 6px" }}>
          <div className="table-wrap">
            <table className="data week-table">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  {jours.map((j, i) => (
                    <th key={j} className={j === jour ? "today" : ""}>
                      {JOURS_COURTS[i]} {depuisIso(j).getDate()}
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {membresSemaine.map((m) => {
                  const totalReel = jours.reduce((t, j) => t + reelSemaine(m.id, j), 0);
                  const totalPrevu = jours.reduce((t, j) => t + prevuSemaine(m.id, j), 0);
                  return (
                    <tr key={m.id}>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span className="avatar">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
                          <b style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{nomComplet(m)}</b>
                        </span>
                      </td>
                      {jours.map((j) => {
                        const r = reelSemaine(m.id, j);
                        const p = prevuSemaine(m.id, j);
                        const corrige = tous.some((s) => s.compteId === m.id && s.date === j && s.evenements.some((e) => e.manuel));
                        const contenu = (
                          <>
                            <b className={!r && !p ? "muted" : ""}>{r ? formatDuree(r) : p ? "0h" : "—"}</b>
                            {p > 0 && <small>prévu {formatDuree(p)}</small>}
                            {corrige && <small className="tag-corrige">corrigé</small>}
                          </>
                        );
                        return (
                          <td key={j} className={`wk-cell ${r && p ? (Math.abs(r - p) <= 15 ? "ok" : r > p ? "plus" : "moins") : p && j < jour ? "moins" : ""}${j === jour ? " today" : ""}`}>
                            {gestion ? (
                              <button className="wk-btn" onClick={() => setCorrection({ compteId: m.id, jour: j })} title="Voir / corriger les pointages">
                                {contenu}
                              </button>
                            ) : (
                              contenu
                            )}
                          </td>
                        );
                      })}
                      <td className="wk-cell">
                        <b>{formatDuree(totalReel)}</b>
                        <small>
                          prévu {formatDuree(totalPrevu)}
                          {m.heures_contrat != null ? ` · contrat ${Number(m.heures_contrat)}h` : ""}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ padding: "10px 12px" }}>
            En vert : conforme au planning (± 15 min). En orange : plus que prévu. En rouge : moins que prévu ou absent.
            {gestion ? " Clique sur une case pour voir ou corriger les pointages." : ""}
          </p>
        </section>
      )}

      {correction && membreCorrection && (
        <ModalCorrection
          etablissementId={etablissement.id}
          responsableId={compte.id}
          compteId={correction.compteId}
          personne={nomComplet(membreCorrection)}
          jour={correction.jour}
          evenements={evenementsCorrection}
          onClose={() => setCorrection(null)}
          onSaved={(msg) => {
            setCorrection(null);
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

function LigneJour({ m, servs, prevus, jour, maintenant, onCorriger }: { m: Membre; servs: Service[]; prevus: Creneau[]; jour: string; maintenant: number; onCorriger: () => void }) {
  const shifts = prevus.filter((c) => c.type === "shift").sort((a, b) => a.heure_debut!.localeCompare(b.heure_debut!));
  const absence = prevus.find((c) => c.type !== "shift");
  const dernier = servs.at(-1);
  const etat = etatService(dernier);
  const premier = servs[0];
  const retard = premier && shifts[0] ? ecartMinutes(premier.arrivee.horodatage, shifts[0].heure_debut!, jour) : 0;
  const travaille = servs.reduce((t, s) => t + minutesService(s, maintenant), 0);
  const pause = servs.reduce((t, s) => t + minutesPause(s, maintenant), 0);
  const attendu = !servs.length && shifts[0] ? ecartMinutes(new Date(maintenant).toISOString(), shifts[0].heure_debut!, jour) : null;
  const justifs = servs.flatMap((s) => s.evenements).filter((e) => e.justificatif);

  const statut =
    etat === "service"
      ? ["En service", "t-mint"]
      : etat === "pause"
        ? ["En pause", "t-yellow"]
        : etat === "termine"
          ? ["Parti", "t-blue"]
          : attendu !== null
            ? attendu > TOLERANCE_MIN
              ? [`Absent · ${formatDuree(attendu)}`, "t-red"]
              : [`Attendu à ${hm(shifts[0].heure_debut)}`, "t-lav"]
            : absence
              ? [absence.type === "repos" ? "Repos" : "Absence", "t-lav"]
              : ["Non prévu", "t-lav"];

  return (
    <tr>
      <td>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="avatar">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
          <span style={{ display: "grid", gap: 1 }}>
            <b style={{ fontWeight: 600 }}>{nomComplet(m)}</b>
            <small style={{ color: "var(--muted)" }}>{m.poste ? POSTES[m.poste]?.label : ""}</small>
          </span>
        </span>
      </td>
      <td>{shifts.length ? shifts.map((c) => `${hm(c.heure_debut)}–${hm(c.heure_fin)}`).join(" · ") : <span className="muted">—</span>}</td>
      <td>
        {premier ? (
          <span style={{ display: "grid", gap: 2 }}>
            <span>
              {heure(premier.arrivee.horodatage)}
              {premier.arrivee.manuel && <small className="tag-corrige"> corrigé</small>}
            </span>
            {retard > TOLERANCE_MIN && <span className="pill t-peach" style={{ width: "fit-content" }}>+{formatDuree(retard)}</span>}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>{dernier?.depart ? heure(dernier.depart.horodatage) : <span className="muted">—</span>}</td>
      <td>{pause ? formatDuree(pause) : <span className="muted">—</span>}</td>
      <td>
        <b>{servs.length ? formatDuree(travaille) : "—"}</b>
      </td>
      <td>
        <span className={`pill ${statut[1]}`}>{statut[0]}</span>
        {justifs.length > 0 && (
          <small className="justif" title={justifs.map((e) => e.justificatif).join("\n")}>
            💬 {justifs[justifs.length - 1].justificatif}
          </small>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        <button className="btn" style={{ height: 32 }} onClick={onCorriger}>
          Corriger
        </button>
      </td>
    </tr>
  );
}
