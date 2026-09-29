"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { ajouterJours, depuisIso, iso } from "@/lib/planning";
import { minutesService, services } from "@/lib/pointage";
import type { PointageBrut } from "@/lib/pointage";
import type { Evenement } from "@/lib/evenements";
import { caisse } from "@/lib/caisses";
import { caParJour, coutMatiere, eur, pct, prevision, topVentes, totalTTC, TVA_SUR_PLACE } from "@/lib/finance";
import type { BonVendu } from "@/lib/finance";

type Periode = "7j" | "30j" | "mois" | "mois-1";

function bornes(p: Periode, auj: string) {
  const d = depuisIso(auj);
  if (p === "7j") return { debut: ajouterJours(auj, -6), fin: auj, label: "7 derniers jours" };
  if (p === "30j") return { debut: ajouterJours(auj, -29), fin: auj, label: "30 derniers jours" };
  if (p === "mois") return { debut: iso(new Date(d.getFullYear(), d.getMonth(), 1)), fin: auj, label: "ce mois-ci" };
  return { debut: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), fin: iso(new Date(d.getFullYear(), d.getMonth(), 0)), label: "le mois dernier" };
}

type Donnees = {
  bons: BonVendu[];
  historique: BonVendu[];
  prix: Map<string, number>;
  coutCarte: Map<string, number>;
  pertes: { valeur: number; produit_id: string; motif: string }[] | null;
  achats: { lignes: { quantite: number; prixUnitaireHT?: number }[] }[] | null;
  pointages: PointageBrut[] | null;
  taux: Map<string, number> | null;
  evenements: Evenement[];
  resas: { date: string; couverts: number }[];
};

export default function Finance() {
  const { compte, etablissement } = useConnecte();
  const directeur = compte.role === "directeur";
  const gestion = directeur || compte.role === "responsable";
  const sb = getSupabaseClient()!;
  const [aujourdhui] = useState(() => iso(new Date()));
  const [periode, setPeriode] = useState<Periode>("30j");
  const [d, setD] = useState<Donnees | null>(null);
  const { debut, fin, label } = bornes(periode, aujourdhui);

  useEffect(() => {
    let vivant = true;
    const e = etablissement.id;
    const histoDebut = ajouterJours(aujourdhui, -56);
    const deb = new Date(debut + "T00:00").toISOString();
    const finTs = new Date(ajouterJours(fin, 1) + "T00:00").toISOString();
    const minDeb = new Date([debut, histoDebut].sort()[0] + "T00:00").toISOString();
    Promise.all([
      sb.from("commandes_salle").select("id, updated_at, lignes, type_commande, couverts").eq("etablissement_id", e).eq("statut", "terminee").gte("updated_at", minDeb).lt("updated_at", finTs).limit(10000),
      gestion ? sb.from("produits").select("id, prix_unitaire").eq("etablissement_id", e) : null,
      sb.from("menu_salle").select("id, cout_matiere_centimes").eq("etablissement_id", e),
      sb.from("pertes").select("valeur, produit_id, motif").eq("etablissement_id", e).gte("date", debut).lte("date", fin),
      gestion ? sb.from("commandes_envoyees").select("lignes").eq("etablissement_id", e).gte("envoyee_at", deb).lt("envoyee_at", finTs) : null,
      gestion ? sb.from("pointages").select("id, compte_id, type, horodatage, manuel, justificatif, responsable_id").eq("etablissement_id", e).gte("horodatage", deb).lt("horodatage", finTs).order("horodatage").limit(20000) : null,
      directeur ? sb.from("comptes_remuneration").select("compte_id, taux_brut").eq("etablissement_id", e) : null,
      sb.from("evenements").select("id, nom, date, date_fin, lieu, type, sens, impact, note").eq("etablissement_id", e).lte("date", ajouterJours(aujourdhui, 7)).gte("date", ajouterJours(aujourdhui, -30)),
      sb.from("reservations").select("date, couverts, statut").eq("etablissement_id", e).gte("date", aujourdhui).lte("date", ajouterJours(aujourdhui, 6)).in("statut", ["confirmee", "arrivee"]),
      // Encaissements importés d'une caisse externe (SumUp, Square…) : un « bon » par encaissement.
      sb.from("ventes_caisse").select("id, vendu_at, montant_centimes, source").eq("etablissement_id", e).gte("vendu_at", minDeb).lt("vendu_at", finTs).limit(20000),
    ]).then(([b, pr, mc, pe, ac, po, tx, ev, rs, vc]) => {
      if (!vivant) return;
      const externes: BonVendu[] = ((vc.data ?? []) as { id: string; vendu_at: string; montant_centimes: number; source: string }[]).map((v) => ({
        id: v.id,
        updated_at: v.vendu_at,
        type_commande: "caisse",
        couverts: 0,
        lignes: [{ produitId: `caisse:${v.source}`, nom: `Encaissement ${caisse(v.source)?.nom ?? v.source}`, quantite: 1, prixCentimes: v.montant_centimes }],
      }));
      const tous = [...((b.data ?? []) as BonVendu[]), ...externes];
      setD({
        bons: tous.filter((x) => x.updated_at >= deb),
        historique: tous,
        prix: new Map(((pr?.data ?? []) as { id: string; prix_unitaire: number | null }[]).filter((p) => p.prix_unitaire != null).map((p) => [p.id, Number(p.prix_unitaire)])),
        coutCarte: new Map(((mc.data ?? []) as { id: string; cout_matiere_centimes: number | null }[]).filter((m) => m.cout_matiere_centimes != null).map((m) => [m.id, Number(m.cout_matiere_centimes)])),
        pertes: pe.error ? null : (pe.data as Donnees["pertes"]),
        achats: ac && !ac.error ? (ac.data as Donnees["achats"]) : null,
        pointages: po && !po.error ? (po.data as PointageBrut[]) : null,
        taux: tx && !tx.error ? new Map((tx.data ?? []).map((t) => [t.compte_id, Number(t.taux_brut)])) : null,
        evenements: (ev.data ?? []) as Evenement[],
        resas: (rs.data ?? []) as { date: string; couverts: number }[],
      });
    });
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, debut, fin, aujourdhui, gestion, directeur]);

  const jours = useMemo(() => {
    const n = Math.round((depuisIso(fin).getTime() - depuisIso(debut).getTime()) / 864e5) + 1;
    return Array.from({ length: n }, (_, i) => ajouterJours(debut, i));
  }, [debut, fin]);

  const k = useMemo(() => {
    if (!d) return null;
    const ttc = d.bons.reduce((s, b) => s + totalTTC(b), 0) / 100;
    const ht = ttc / (1 + TVA_SUR_PLACE);
    let matiere = 0;
    let matiereComplet = true;
    for (const b of d.bons) {
      const c = coutMatiere(b, d.prix, d.coutCarte);
      matiere += c.total;
      if (!c.complet) matiereComplet = false;
    }
    const pertes = d.pertes && d.prix.size ? d.pertes.reduce((s, p) => s + Number(p.valeur) * (d.prix.get(p.produit_id) ?? 0), 0) : null;
    const achats = d.achats ? d.achats.reduce((s, c) => s + (c.lignes ?? []).reduce((t, l) => t + Number(l.quantite) * Number(l.prixUnitaireHT ?? 0), 0), 0) : null;
    let salaires: number | null = null;
    let heures: number | null = null;
    if (d.pointages) {
      const serv = services(d.pointages).filter((s) => s.depart);
      heures = serv.reduce((t, s) => t + minutesService(s), 0) / 60;
      if (d.taux) salaires = serv.reduce((t, s) => t + (minutesService(s) / 60) * (d.taux!.get(s.compteId) ?? 0), 0);
    }
    const couverts = d.bons.filter((b) => (b.type_commande ?? "sur_place") === "sur_place").reduce((s, b) => s + Number(b.couverts ?? 0), 0);
    const nbVentes = d.bons.length;
    const margeBrute = ht - matiere - (pertes ?? 0);
    return { ttc, ht, matiere, matiereComplet, pertes, achats, salaires, heures, couverts, nbVentes, margeBrute, panier: nbVentes ? ttc / nbVentes : null };
  }, [d]);

  const serie = useMemo(() => (d ? caParJour(d.bons, jours).map((x) => ({ ...x, ht: x.ttc / (1 + TVA_SUR_PLACE) })) : []), [d, jours]);
  // Les encaissements de caisse externe n'ont pas de détail produit : exclus du classement.
  const top = useMemo(() => (d ? topVentes(d.bons.filter((b) => b.type_commande !== "caisse")).slice(0, 8) : []), [d]);
  const prev = useMemo(() => {
    if (!d) return [];
    const histo = caParJour(d.historique, Array.from({ length: 56 }, (_, i) => ajouterJours(aujourdhui, -56 + i)));
    return prevision(histo, d.evenements, aujourdhui, 7);
  }, [d, aujourdhui]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Pilotage</p>
          <h1>Finance</h1>
          <p>Ventes, coût matière, pertes et masse salariale — calculés à partir de ce qui est saisi dans Juliette.</p>
        </div>
        <div className="seg seg-inline">
          {(
            [
              ["7j", "7 jours"],
              ["30j", "30 jours"],
              ["mois", "Ce mois"],
              ["mois-1", "Mois dernier"],
            ] as const
          ).map(([p, l]) => (
            <button key={p} className={periode === p ? "on" : ""} onClick={() => setPeriode(p)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {!d || !k ? (
        <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <section className="card hero-ca">
            <div>
              <span className="hint">Chiffre d&apos;affaires encaissé · {label}</span>
              <b className="hero-num">{eur(k.ttc)}</b>
              <span className="hint">
                {eur(k.ht)} HT estimé · {k.nbVentes} vente(s) · panier moyen {k.panier ? eur(k.panier, 2) : "—"}
                {k.couverts ? ` · ${k.couverts} couverts en salle` : ""}
              </span>
            </div>
            {gestion && (
              <div className="hero-side">
                <span className="hint">Marge brute estimée</span>
                <b>{eur(k.margeBrute)}</b>
                <span className="hint">CA HT − matière − pertes</span>
              </div>
            )}
          </section>

          {gestion && (
            <div className="grid-stats">
              <Tuile titre="Coût matière" valeur={eur(k.matiere)} ratio={k.ht ? (k.matiere / k.ht) * 100 : null} cible="visé : 25–30 % du CA HT" alerte={k.ht ? (k.matiere / k.ht) * 100 > 35 : false} note={k.matiereComplet ? undefined : "certains articles sans fiche : sous-estimé"} />
              <Tuile titre="Pertes" valeur={k.pertes !== null ? eur(k.pertes) : "—"} ratio={k.pertes !== null && k.ht ? (k.pertes / k.ht) * 100 : null} cible="visé : moins de 2 % du CA HT" alerte={k.pertes !== null && k.ht ? (k.pertes / k.ht) * 100 > 3 : false} />
              <Tuile
                titre="Masse salariale (brut)"
                valeur={k.salaires !== null ? eur(k.salaires) : k.heures !== null ? `${Math.round(k.heures)} h` : "—"}
                ratio={k.salaires !== null && k.ht ? (k.salaires / k.ht) * 100 : null}
                cible={k.salaires !== null ? "heures pointées × taux horaire, hors charges" : directeur ? "renseigne les taux horaires (Équipe)" : "montants visibles par le directeur"}
                alerte={k.salaires !== null && k.ht ? (k.salaires / k.ht) * 100 > 40 : false}
              />
              <Tuile titre="Achats fournisseurs" valeur={k.achats !== null ? eur(k.achats) : "—"} ratio={k.achats !== null && k.ht ? (k.achats / k.ht) * 100 : null} cible="commandes envoyées, HT" />
            </div>
          )}

          <section className="card">
            <div className="card-head">
              <h2>Chiffre d&apos;affaires TTC par jour</h2>
              <span className="hint">survole une colonne pour le détail</span>
            </div>
            {k.ttc > 0 ? <Colonnes serie={serie} evenements={d.evenements} aujourdhui={aujourdhui} /> : <div className="empty">Aucune vente encaissée sur la période. Les tables et livraisons encaissées dans « Commandes clients » apparaîtront ici.</div>}
          </section>

          <div className="grid-2" style={{ marginTop: 0 }}>
            <section className="card">
              <div className="card-head">
                <h2>Meilleures ventes</h2>
              </div>
              {!top.length ? (
                <div className="empty">Aucune vente.</div>
              ) : (
                <div className="barlist">
                  {top.map((t) => (
                    <div key={t.nom} className="barlist-row" title={`${t.quantite} vendu(s) · ${eur(t.ttc, 2)} TTC`}>
                      <span className="barlist-label">{t.nom}</span>
                      <span className="barlist-track">
                        <i style={{ width: `${(t.ttc / top[0].ttc) * 100}%` }} />
                      </span>
                      <span className="barlist-val">
                        {eur(t.ttc)} <small className="hint">× {t.quantite}</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Prévision des 7 prochains jours</h2>
              </div>
              <div className="rows">
                {prev.map((p) => {
                  const resa = d.resas.filter((r) => r.date === p.jour).reduce((s, r) => s + r.couverts, 0);
                  return (
                    <div key={p.jour} className="row">
                      <span className="main-txt">
                        <b style={{ textTransform: "capitalize" }}>{depuisIso(p.jour).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })}</b>
                        <small>
                          {p.evenements.length ? `${p.evenements.join(", ")} (${p.facteur >= 1 ? "+" : ""}${Math.round((p.facteur - 1) * 100)} %)` : p.echantillon ? `moyenne de ${p.echantillon} ${new Date(p.jour + "T00:00").toLocaleDateString("fr-FR", { weekday: "long" })}(s)` : "pas encore d'historique"}
                          {resa ? ` · ${resa} couverts réservés` : ""}
                        </small>
                      </span>
                      <span className="right">
                        <b>{p.estimation !== null ? eur(p.estimation) : "—"}</b>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="hint" style={{ margin: "10px 0 0" }}>Estimation indicative : moyenne des 8 dernières semaines pour le même jour, ajustée par les événements du calendrier.</p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function Tuile({ titre, valeur, ratio, cible, alerte, note }: { titre: string; valeur: string; ratio: number | null; cible: string; alerte?: boolean; note?: string }) {
  return (
    <div className="card stat">
      <div className="stat-top">{titre}</div>
      <div className="stat-value">{valeur}</div>
      <div className="stat-foot">
        {ratio !== null && (
          <span className={`pill ${alerte ? "t-red" : "t-lav"}`} style={{ marginRight: 6 }}>
            {alerte ? "▲ " : ""}
            {pct(ratio)} du CA
          </span>
        )}
        {cible}
        {note && <span style={{ display: "block", color: "var(--yellow-ink)" }}>{note}</span>}
      </div>
    </div>
  );
}

/** Colonnes du CA par jour : une seule série, une seule teinte, axe recessif, infobulle au survol. */
function Colonnes({ serie, evenements, aujourdhui }: { serie: { jour: string; ttc: number; ht: number }[]; evenements: Evenement[]; aujourdhui: string }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(...serie.map((s) => s.ttc), 1);
  const pas = Math.pow(10, Math.floor(Math.log10(max)));
  const plafond = Math.ceil(max / pas) * pas;
  const graduations = [0, 0.5, 1].map((f) => plafond * f);
  const tous = serie.length <= 14;
  const moyenne = serie.filter((s) => s.ttc > 0).reduce((t, s, _, a) => t + s.ttc / a.length, 0);

  return (
    <div className="colchart" role="img" aria-label={`Chiffre d'affaires par jour, maximum ${eur(max)}`}>
      <div className="colchart-grid">
        {graduations.map((g) => (
          <div key={g} className="colchart-line" style={{ bottom: `${(g / plafond) * 100}%` }}>
            <span>{g >= 1000 ? `${(g / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€` : `${Math.round(g)} €`}</span>
          </div>
        ))}
        {moyenne > 0 && (
          <div className="colchart-moy" style={{ bottom: `${(moyenne / plafond) * 100}%` }}>
            <span>moyenne {eur(moyenne)}</span>
          </div>
        )}
      </div>
      <div className="colchart-cols">
        {serie.map((s, i) => {
          const evts = evenements.filter((e) => e.date <= s.jour && (e.date_fin ?? e.date) >= s.jour);
          const d = new Date(s.jour + "T00:00");
          return (
            <div key={s.jour} className={`colchart-col${survol === i ? " on" : ""}${s.jour === aujourdhui ? " today" : ""}`} onMouseEnter={() => setSurvol(i)} onMouseLeave={() => setSurvol(null)} onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)} tabIndex={0}>
              <span className="colchart-bar" style={{ height: `${(s.ttc / plafond) * 100}%` }} />
              {evts.length > 0 && <span className="colchart-evt" title={evts.map((e) => e.nom).join(", ")} />}
              <span className="colchart-x">{tous || d.getDate() % 5 === 1 ? d.getDate() : ""}</span>
              {survol === i && (
                <span className={`colchart-tip${i > serie.length / 2 ? " gauche" : ""}`}>
                  <b style={{ textTransform: "capitalize" }}>{d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</b>
                  <span>{eur(s.ttc, 2)} TTC</span>
                  <span className="hint">{eur(s.ht, 2)} HT</span>
                  {evts.map((e) => (
                    <span key={e.id} className="hint">
                      ✦ {e.nom}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
