"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, useConnecte } from "@/lib/session";
import type { Compte } from "@/lib/session";
import { ajouterJours, depuisIso, iso } from "@/lib/planning";
import {
  chevauche,
  COLONNES_DEMANDE,
  DELAI_TACITE_JOURS,
  euros,
  joursAvantValidationTacite,
  joursOuvrables,
  MOTIFS,
  nbJours,
  periode,
  STATUT_DEMANDE,
} from "@/lib/conges";
import type { Demande } from "@/lib/conges";
import ModalDemande from "@/components/conges/ModalDemande";

type Onglet = "traiter" | "calendrier" | "historique" | "miennes";

export default function RhConges() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;

  const [onglet, setOnglet] = useState<Onglet>(gestion ? "traiter" : "miennes");
  const [demandes, setDemandes] = useState<Demande[] | null>(null);
  const [membres, setMembres] = useState<Compte[]>([]);
  const [creneaux, setCreneaux] = useState<{ compte_id: string; date: string }[]>([]);
  const [version, setVersion] = useState(0);
  const [nouvelle, setNouvelle] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [mois, setMois] = useState(() => iso(new Date()).slice(0, 7));
  const [filtre, setFiltre] = useState<"tout" | "conge" | "acompte">("tout");
  const [maintenant] = useState(() => Date.now());

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let actif = true;
    (async () => {
      // La base applique d'abord la validation tacite des congés restés sans réponse.
      const { data: tacites } = await sb.rpc("auto_valider_conges", { p_etablissement_id: etablissement.id });
      const [d, m, c] = await Promise.all([
        sb.from("conges").select(COLONNES_DEMANDE).eq("etablissement_id", etablissement.id).order("created_at", { ascending: false }).limit(1000),
        sb.from("comptes").select("id, etablissement_id, prenom, nom, email, role, statut, poste, avatar_url").eq("etablissement_id", etablissement.id),
        gestion
          ? sb.from("planning_creneaux").select("compte_id, date").eq("etablissement_id", etablissement.id).eq("type", "shift").gte("date", iso(new Date())).lte("date", ajouterJours(iso(new Date()), 120))
          : null,
      ]);
      if (!actif) return;
      setDemandes((d.data ?? []) as Demande[]);
      setMembres((m.data ?? []) as Compte[]);
      setCreneaux(c?.data ?? []);
      if (typeof tacites === "number" && tacites > 0) setToast(`${tacites} congé(s) validé(s) automatiquement (sans réponse sous ${DELAI_TACITE_JOURS} jours)`);
    })();
    return () => {
      actif = false;
    };
  }, [sb, etablissement.id, gestion, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const parId = useMemo(() => new Map(membres.map((m) => [m.id, m])), [membres]);
  const nom = useCallback((id: string | null) => (id && parId.get(id) ? nomComplet(parId.get(id)!) : "—"), [parId]);

  const aTraiter = useMemo(() => (demandes ?? []).filter((d) => d.statut === "en_attente").sort((a, b) => a.created_at.localeCompare(b.created_at)), [demandes]);
  const miennes = useMemo(() => (demandes ?? []).filter((d) => d.compte_id === compte.id), [demandes, compte.id]);

  async function decider(d: Demande, statut: "validee" | "refusee") {
    setEnvoi(d.id);
    const { error } = await sb.from("conges").update({ statut }).eq("id", d.id);
    setEnvoi(null);
    if (error) return setToast("Décision refusée : réservée aux responsables");
    setToast(`${d.type === "conge" ? "Congé" : "Acompte"} de ${nom(d.compte_id)} ${statut === "validee" ? "validé" : "refusé"}`);
    recharger();
  }

  async function annuler(d: Demande) {
    setEnvoi(d.id);
    const { error } = await sb.from("conges").delete().eq("id", d.id);
    setEnvoi(null);
    if (error) return setToast("Annulation impossible : la demande a peut-être déjà été traitée");
    setToast("Demande annulée");
    recharger();
  }

  const onglets: [Onglet, string, number | null][] = gestion
    ? [
        ["traiter", "À traiter", aTraiter.length],
        ["calendrier", "Calendrier", null],
        ["historique", "Historique", null],
        ["miennes", "Mes demandes", miennes.length],
      ]
    : [
        ["miennes", "Mes demandes", miennes.length],
        ["calendrier", "Mon calendrier", null],
      ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Équipe</p>
          <h1>RH & congés</h1>
          <p>{gestion ? "Demandes de congés et d'acomptes, et absences de l'équipe." : "Pose tes congés, demande un acompte et suis leurs réponses."}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNouvelle(true)}>
          + Nouvelle demande
        </button>
      </div>

      <div className="week-nav">
        <div className="seg seg-inline" role="tablist">
          {onglets.map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={onglet === k} className={onglet === k ? "on" : ""} onClick={() => setOnglet(k)}>
              {l}
              {n !== null && <span className={`seg-count${k === "traiter" && n ? " seg-alert" : ""}`}>{n}</span>}
            </button>
          ))}
        </div>
        {onglet === "calendrier" && (
          <div className="week-arrows">
            <button className="btn" onClick={() => setMois(decalerMois(mois, -1))} aria-label="Mois précédent">
              ←
            </button>
            <div className="week-label">
              <b style={{ textTransform: "capitalize" }}>{depuisIso(mois + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b>
              <small />
            </div>
            <button className="btn" onClick={() => setMois(decalerMois(mois, 1))} aria-label="Mois suivant">
              →
            </button>
          </div>
        )}
        {onglet === "historique" && (
          <select className="select-sm" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)} aria-label="Type de demande">
            <option value="tout">Toutes les demandes</option>
            <option value="conge">Congés et absences</option>
            <option value="acompte">Acomptes</option>
          </select>
        )}
      </div>

      {!demandes ? (
        <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
      ) : onglet === "traiter" ? (
        !aTraiter.length ? (
          <div className="card empty">
            <b>Aucune demande en attente</b>
            Les nouvelles demandes de l&apos;équipe apparaîtront ici.
          </div>
        ) : (
          <div className="requests">
            {aTraiter.map((d) => (
              <CarteDemande
                key={d.id}
                d={d}
                nom={nom}
                personne={parId.get(d.compte_id)}
                autresAbsents={
                  d.type === "conge"
                    ? [...new Set((demandes ?? []).filter((x) => x.id !== d.id && x.compte_id !== d.compte_id && x.type === "conge" && x.statut !== "refusee" && chevauche(x, d.date_debut, d.date_fin)).map((x) => nom(x.compte_id)))]
                    : []
                }
                creneauxImpactes={d.type === "conge" ? creneaux.filter((c) => c.compte_id === d.compte_id && c.date >= d.date_debut && c.date <= d.date_fin).length : 0}
                envoi={envoi === d.id}
                maintenant={maintenant}
                onDecider={(s) => decider(d, s)}
              />
            ))}
          </div>
        )
      ) : onglet === "calendrier" ? (
        <Calendrier mois={mois} membres={gestion ? membres.filter((m) => m.statut !== "parti") : membres.filter((m) => m.id === compte.id)} demandes={demandes} />
      ) : onglet === "historique" ? (
        <Historique demandes={demandes.filter((d) => filtre === "tout" || d.type === filtre)} nom={nom} />
      ) : !miennes.length ? (
        <div className="card empty">
          <b>Tu n&apos;as encore fait aucune demande</b>
          Clique sur « Nouvelle demande » pour poser un congé ou demander un acompte.
        </div>
      ) : (
        <div className="requests">
          {miennes.map((d) => {
            const tacite = joursAvantValidationTacite(d, maintenant);
            return (
              <section key={d.id} className="card request">
                <div className="request-head">
                  <span className="request-type" style={{ background: d.type === "acompte" ? "var(--blue)" : MOTIFS[d.motif ?? "autre"]?.couleur + "33" }}>
                    {d.type === "acompte" ? "€" : "✈"}
                  </span>
                  <span className="main-txt" style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                    <b>{d.type === "acompte" ? `Acompte de ${euros(Number(d.montant))}` : (MOTIFS[d.motif ?? "autre"]?.label ?? "Congé")}</b>
                    <small className="hint">
                      {d.type === "acompte" ? `souhaité ${periode(d)}` : `${periode(d)} · ${nbJours(d.date_debut, d.date_fin)} j (${joursOuvrables(d.date_debut, d.date_fin)} ouvrables)`}
                    </small>
                  </span>
                  <span className={`pill ${STATUT_DEMANDE[d.statut].ton}`}>{STATUT_DEMANDE[d.statut].label}</span>
                </div>
                {d.motif_detail && <p className="request-note">« {d.motif_detail} »</p>}
                <div className="request-foot">
                  <span className="hint">
                    {d.statut === "en_attente"
                      ? tacite !== null
                        ? `Envoyée le ${new Date(d.created_at).toLocaleDateString("fr-FR")} · validée automatiquement dans ${tacite} j sans réponse`
                        : `Envoyée le ${new Date(d.created_at).toLocaleDateString("fr-FR")}`
                      : d.decide_par
                        ? `${d.statut === "validee" ? "Validée" : "Refusée"} par ${nom(d.decide_par)} le ${new Date(d.decide_at!).toLocaleDateString("fr-FR")}`
                        : `Validée automatiquement le ${d.decide_at ? new Date(d.decide_at).toLocaleDateString("fr-FR") : "?"}`}
                  </span>
                  {d.statut === "en_attente" && (
                    <button className="btn btn-danger-ghost" style={{ height: 32 }} onClick={() => annuler(d)} disabled={envoi === d.id}>
                      Annuler la demande
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {nouvelle && (
        <ModalDemande
          etablissementId={etablissement.id}
          compteId={compte.id}
          onClose={() => setNouvelle(false)}
          onEnvoyee={(msg) => {
            setNouvelle(false);
            setToast(msg);
            setOnglet("miennes");
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

function decalerMois(mois: string, n: number) {
  const d = depuisIso(mois + "-01");
  d.setMonth(d.getMonth() + n);
  return iso(d).slice(0, 7);
}

function CarteDemande(p: {
  d: Demande;
  nom: (id: string | null) => string;
  personne: Compte | undefined;
  autresAbsents: string[];
  creneauxImpactes: number;
  envoi: boolean;
  maintenant: number;
  onDecider: (s: "validee" | "refusee") => void;
}) {
  const { d } = p;
  const tacite = joursAvantValidationTacite(d, p.maintenant);
  const depuis = Math.floor((p.maintenant - new Date(d.created_at).getTime()) / 864e5);
  return (
    <section className="card request">
      <div className="request-head">
        <span className="avatar avatar-lg">{p.personne?.avatar_url ? <img src={p.personne.avatar_url} alt="" /> : p.personne ? initiales(p.personne) : "?"}</span>
        <span style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>{p.nom(d.compte_id)}</b>
          <span className="hint">
            {d.type === "acompte" ? (
              <>
                Acompte de <b>{euros(Number(d.montant))}</b> souhaité {periode(d)}
              </>
            ) : (
              <>
                <span className="dot" style={{ background: MOTIFS[d.motif ?? "autre"]?.couleur, marginRight: 6 }} />
                {MOTIFS[d.motif ?? "autre"]?.label} {periode(d)} ·{" "}
                <b>
                  {nbJours(d.date_debut, d.date_fin)} j ({joursOuvrables(d.date_debut, d.date_fin)} ouvrables)
                </b>
              </>
            )}
          </span>
        </span>
        {tacite !== null && (
          <span className={`pill ${tacite <= 1 ? "t-red" : "t-yellow"}`} title={`Sans réponse, la base valide la demande ${DELAI_TACITE_JOURS} jours après son envoi`}>
            {tacite === 0 ? "Validation auto aujourd'hui" : `Validation auto dans ${tacite} j`}
          </span>
        )}
      </div>
      {d.motif_detail && <p className="request-note">« {d.motif_detail} »</p>}
      {d.type === "conge" && (p.autresAbsents.length > 0 || p.creneauxImpactes > 0) && (
        <div className="request-impact">
          {p.creneauxImpactes > 0 && (
            <span>
              ▦ {p.creneauxImpactes} créneau{p.creneauxImpactes > 1 ? "x" : ""} au planning à réaffecter
            </span>
          )}
          {p.autresAbsents.length > 0 && <span>☺ Aussi absent(s) sur la période : {p.autresAbsents.join(", ")}</span>}
        </div>
      )}
      <div className="request-foot">
        <span className="hint">Envoyée {depuis === 0 ? "aujourd'hui" : depuis === 1 ? "hier" : `il y a ${depuis} jours`}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-danger-ghost" onClick={() => p.onDecider("refusee")} disabled={p.envoi}>
            Refuser
          </button>
          <button className="btn btn-primary" onClick={() => p.onDecider("validee")} disabled={p.envoi}>
            Valider
          </button>
        </span>
      </div>
    </section>
  );
}

function Calendrier({ mois, membres, demandes }: { mois: string; membres: Compte[]; demandes: Demande[] }) {
  const debut = mois + "-01";
  const nb = new Date(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0).getDate();
  const jours = Array.from({ length: nb }, (_, i) => ajouterJours(debut, i));
  const aujourdhui = iso(new Date());
  const conges = demandes.filter((d) => d.type === "conge" && d.statut !== "refusee" && chevauche(d, debut, jours[nb - 1]));
  const absentsParJour = jours.map((j) => new Set(conges.filter((d) => d.statut === "validee" && chevauche(d, j, j)).map((d) => d.compte_id)).size);

  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="table-wrap">
        <div className="cal" style={{ gridTemplateColumns: `180px repeat(${nb}, minmax(26px, 1fr))` }}>
          <div className="cal-head cal-name">Équipe</div>
          {jours.map((j) => {
            const d = depuisIso(j);
            return (
              <div key={j} className={`cal-head${d.getDay() === 0 ? " cal-we" : ""}${j === aujourdhui ? " cal-today" : ""}`}>
                <small>{"dlmmjvs"[d.getDay()]}</small>
                <b>{d.getDate()}</b>
              </div>
            );
          })}
          {membres.map((m) => (
            <div key={m.id} className="cal-row">
              <div className="cal-name">
                <span className="avatar">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
                <span>{nomComplet(m)}</span>
              </div>
              {jours.map((j) => {
                const c = conges.find((d) => d.compte_id === m.id && chevauche(d, j, j));
                const couleur = c ? MOTIFS[c.motif ?? "autre"]?.couleur : undefined;
                return (
                  <div
                    key={j}
                    className={`cal-cell${depuisIso(j).getDay() === 0 ? " cal-we" : ""}${j === aujourdhui ? " cal-today" : ""}${c ? (c.statut === "validee" ? " cal-on" : " cal-pending") : ""}`}
                    style={c ? ({ "--c": couleur } as CSSProperties) : undefined}
                    title={c ? `${nomComplet(m)} · ${MOTIFS[c.motif ?? "autre"]?.label} ${periode(c)} · ${STATUT_DEMANDE[c.statut].label}` : undefined}
                  />
                );
              })}
            </div>
          ))}
          <div className="cal-foot cal-name">Absents</div>
          {absentsParJour.map((n, i) => (
            <div key={i} className={`cal-foot${n >= 2 ? " cal-warn" : ""}`}>
              {n || ""}
            </div>
          ))}
        </div>
      </div>
      <div className="legend" style={{ padding: "10px 16px 14px", margin: 0 }}>
        {Object.entries(MOTIFS).map(([k, v]) => (
          <span key={k}>
            <span className="dot" style={{ background: v.couleur }} /> {v.label}
          </span>
        ))}
        <span>
          <span className="cal-legend-pending" /> En attente
        </span>
      </div>
    </section>
  );
}

function Historique({ demandes, nom }: { demandes: Demande[]; nom: (id: string | null) => string }) {
  const moisCourant = iso(new Date()).slice(0, 7);
  const acomptesMois = demandes.filter((d) => d.type === "acompte" && d.statut === "validee" && d.date_debut.startsWith(moisCourant)).reduce((s, d) => s + Number(d.montant ?? 0), 0);
  const joursValides = demandes.filter((d) => d.type === "conge" && d.statut === "validee" && d.date_debut.startsWith(moisCourant)).reduce((s, d) => s + joursOuvrables(d.date_debut, d.date_fin), 0);

  return (
    <>
      <div className="grid-stats" style={{ marginBottom: 14 }}>
        <div className="card stat">
          <div className="stat-top">Acomptes validés ce mois</div>
          <div className="stat-value">{euros(acomptesMois)}</div>
          <div className="stat-foot">à déduire des salaires</div>
        </div>
        <div className="card stat">
          <div className="stat-top">Jours de congé ce mois</div>
          <div className="stat-value">{joursValides}</div>
          <div className="stat-foot">jours ouvrables validés</div>
        </div>
      </div>
      <section className="card" style={{ padding: "16px 6px 6px" }}>
        {!demandes.length ? (
          <div className="empty">Aucune demande.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Demande</th>
                  <th>Période</th>
                  <th>Statut</th>
                  <th>Décision</th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <b style={{ fontWeight: 600 }}>{nom(d.compte_id)}</b>
                    </td>
                    <td>
                      {d.type === "acompte" ? `Acompte ${euros(Number(d.montant))}` : MOTIFS[d.motif ?? "autre"]?.label}
                      {d.motif_detail && <small className="justif">{d.motif_detail}</small>}
                    </td>
                    <td>
                      {periode(d)}
                      {d.type === "conge" && <small className="justif">{joursOuvrables(d.date_debut, d.date_fin)} j ouvrables</small>}
                    </td>
                    <td>
                      <span className={`pill ${STATUT_DEMANDE[d.statut].ton}`}>{STATUT_DEMANDE[d.statut].label}</span>
                    </td>
                    <td className="hint">
                      {d.statut === "en_attente"
                        ? `envoyée le ${new Date(d.created_at).toLocaleDateString("fr-FR")}`
                        : d.decide_par
                          ? `${nom(d.decide_par)}, le ${new Date(d.decide_at!).toLocaleDateString("fr-FR")}`
                          : "automatique (sans réponse)"}
                    </td>
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
