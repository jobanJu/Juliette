"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, useConnecte } from "@/lib/session";
import { ajouterJours, iso } from "@/lib/planning";
import { COLONNES_ENREG, creneauReleve, estTracePhoto, joursRestants, passages, PRODUITS_DLC_DEFAUT, REFROID_DUREE_MAX_MIN, TRACABILITE_DEFAUT } from "@/lib/haccp";
import type { Enregistrement, Equipement, Etiquette, Nettoyage as Fait, Production as FicheProduction, ProduitDlcConfig, Refroidissement, Tache, Temperature, TracabiliteConfig, TracePhoto, TypeEnregistrement } from "@/lib/haccp";
import Temperatures from "@/components/haccp/Temperatures";
import ModalEquipements from "@/components/haccp/ModalEquipements";
import ModalProduitsDlc from "@/components/haccp/ModalProduitsDlc";
import Nettoyage, { ModalPlan } from "@/components/haccp/Nettoyage";
import Tracabilite, { ModalTracabilite } from "@/components/haccp/Tracabilite";
import Production from "@/components/haccp/Production";
import Refroidissements from "@/components/haccp/Refroidissements";
import Etiquettes from "@/components/haccp/Etiquettes";
import Registre from "@/components/haccp/Registre";

type Onglet = "temperatures" | "tracabilite" | "etiquettes" | "nettoyage" | "refroidissement" | "suivi-production" | "registre" | "jour";
const JOURS_CHARGES = 90;

type Donnees = { equipements: Equipement[]; plan: Tache[]; enregs: Enregistrement[]; produitsDlc: ProduitDlcConfig[]; tracabilite: TracabiliteConfig };
type Reglage = "equipements" | "dlc" | "tracabilite" | "nettoyage" | null;

/** Rubrique du registre qui correspond à l'onglet ouvert (bouton « Historique »). */
const TYPE_ONGLET: Partial<Record<Onglet, TypeEnregistrement>> = { temperatures: "temperature", tracabilite: "tracabilite", etiquettes: "tracabilite", nettoyage: "nettoyage", refroidissement: "refroidissement", "suivi-production": "production" };

export default function Haccp() {
  const { compte, etablissement, modules } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  // Paramètres et historique : sur accréditation (Paramètres → Accréditations).
  const parametres = modules.has("haccp-parametres");
  const historique = modules.has("haccp-historique");
  const sb = getSupabaseClient()!;
  const [onglet, setOnglet] = useState<Onglet>("temperatures");
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);
  const [reglage, setReglage] = useState<Reglage>(null);
  const [typeRegistre, setTypeRegistre] = useState<TypeEnregistrement | "tout">("tout");
  const [toast, setToast] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  const sauve = useCallback(
    (m: string) => {
      setToast(m);
      recharger();
    },
    [recharger],
  );

  useEffect(() => {
    let vivant = true;
    const depuis = new Date(Date.now() - JOURS_CHARGES * 864e5).toISOString();
    Promise.all([
      sb.from("haccp_config").select("cle, data").eq("etablissement_id", etablissement.id),
      sb.from("haccp_enregistrements").select(COLONNES_ENREG).eq("etablissement_id", etablissement.id).gte("created_at", depuis).order("created_at").limit(5000),
      // Refroidissements jamais clôturés, même anciens : ils doivent rester visibles.
      sb.from("haccp_enregistrements").select(COLONNES_ENREG).eq("etablissement_id", etablissement.id).eq("type", "refroidissement").is("data->>fin_at", null).lt("created_at", depuis),
      sb.from("haccp_enregistrements").select(COLONNES_ENREG).eq("etablissement_id", etablissement.id).eq("type", "production").is("data->>cloture_at", null).lt("created_at", depuis),
    ]).then(([c, e, r, pr]) => {
      if (!vivant) return;
      if (c.error || e.error) return setErreur(true);
      const conf = new Map((c.data ?? []).map((x) => [x.cle, x.data]));
      setD({
        equipements: (conf.get("equipements") as Equipement[]) ?? [],
        plan: (conf.get("plan_nettoyage") as Tache[]) ?? [],
        enregs: [...((r.data ?? []) as Enregistrement[]), ...((pr.data ?? []) as Enregistrement[]), ...((e.data ?? []) as Enregistrement[])],
        produitsDlc: (conf.get("produits_dlc") as ProduitDlcConfig[]) ?? PRODUITS_DLC_DEFAUT,
        tracabilite: { ...TRACABILITE_DEFAUT, ...((conf.get("tracabilite") as Partial<TracabiliteConfig>) ?? {}) },
      });
      setErreur(false);
      setMaintenant(Date.now());
    });
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const parType = useMemo(() => {
    const e = d?.enregs ?? [];
    return {
      temperature: e.filter((x) => x.type === "temperature") as Enregistrement<Temperature>[],
      nettoyage: e.filter((x) => x.type === "nettoyage") as Enregistrement<Fait>[],
      refroidissement: (e.filter((x) => x.type === "refroidissement") as Enregistrement<Refroidissement>[]).slice().reverse(),
      tracabilite: e.filter((x) => x.type === "tracabilite" && !estTracePhoto(x.data)) as Enregistrement<Etiquette>[],
      photos: e.filter((x) => x.type === "tracabilite" && estTracePhoto(x.data)) as Enregistrement<TracePhoto>[],
      production: e.filter((x) => x.type === "production") as Enregistrement<FicheProduction>[],
    };
  }, [d]);

  const resume = useMemo(() => {
    if (!d) return null;
    const jour = iso(new Date(maintenant));
    const creneau = creneauReleve(new Date(maintenant));
    const relevesJour = parType.temperature.filter((r) => iso(new Date(r.created_at)) === jour);
    const faitsCreneau = new Set(relevesJour.filter((r) => creneauReleve(r.created_at) === creneau).map((r) => r.data.equipement_id));
    const nonConformes = relevesJour.filter((r) => !r.data.conforme).length;
    const fait = (t: Tache, per: string) => parType.nettoyage.some((f) => f.data.tache_id === t.id && f.data.periode === per && !f.data.non_fait);
    const quot = d.plan.filter((t) => t.frequence === "quotidien").flatMap((t) => passages(t, new Date(maintenant)).map((per) => fait(t, per)));
    const quotidien = { length: quot.length };
    const faitsQuot = quot.filter(Boolean).length;
    const autres = d.plan.filter((t) => t.frequence !== "quotidien");
    const restentAutres = autres.filter((t) => passages(t, new Date(maintenant)).some((per) => !fait(t, per))).length;
    const enCours = parType.refroidissement.filter((r) => !r.data.fin_at);
    const depasses = enCours.filter((r) => (maintenant - new Date(r.data.debut_at).getTime()) / 60000 > REFROID_DUREE_MAX_MIN).length;
    const dlc = parType.tracabilite.map((e) => joursRestants(e.data.dlc, jour));
    return {
      creneau,
      temperaturesFaites: d.equipements.filter((e) => faitsCreneau.has(e.id)).length,
      temperaturesTotal: d.equipements.length,
      nettoyagesFaits: faitsQuot,
      nettoyagesTotal: quotidien.length,
      releves: `${d.equipements.filter((e) => faitsCreneau.has(e.id)).length} / ${d.equipements.length}`,
      relevesOk: d.equipements.length > 0 && d.equipements.every((e) => faitsCreneau.has(e.id)),
      nonConformes,
      nettoyage: `${faitsQuot} / ${quotidien.length}`,
      nettoyageOk: faitsQuot === quotidien.length,
      restentAutres,
      enCours: enCours.length,
      depasses,
      dlcAujourdhui: dlc.filter((x) => x === 0).length,
      dlcDepassees: dlc.filter((x) => x < 0 && x >= -3).length,
    };
  }, [d, parType, maintenant]);

  // Navigation calquée sur la maquette HACCP ; l'aperçu du jour reste accessible en dernier.
  const onglets: [Onglet, string][] = [
    ["temperatures", "Températures"],
    ["tracabilite", "Traçabilité"],
    ["etiquettes", "Étiquettes DLC"],
    ["nettoyage", "Plan de nettoyage"],
    ["refroidissement", "Refroidissement"],
    ["suivi-production", "Suivi production"],
    ...(historique ? [["registre", "Registre"] as [Onglet, string]] : []),
    ["jour", "Vue du jour"],
  ];

  const communs = { etablissementId: etablissement.id, compteId: compte.id, onSaved: sauve };
  const reglageOnglet: Reglage = onglet === "temperatures" || onglet === "jour" ? "equipements" : onglet === "etiquettes" ? "dlc" : onglet === "tracabilite" ? "tracabilite" : onglet === "nettoyage" ? "nettoyage" : null;
  const fermerReglage = (m: string) => {
    setReglage(null);
    sauve(m);
  };

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">HACCP</p>
          <h1>Hygiène & sécurité alimentaire</h1>
          <p>Températures, nettoyage, refroidissements et traçabilité : ton plan de maîtrise sanitaire, à jour et prêt pour un contrôle.</p>
        </div>
        <div className="haccp-page-actions">
          {historique && onglet !== "registre" && onglet !== "suivi-production" && (
            <button
              className="btn"
              onClick={() => {
                setTypeRegistre(TYPE_ONGLET[onglet] ?? "tout");
                setOnglet("registre");
              }}
            >
              📊 Historique & export
            </button>
          )}
          {parametres && reglageOnglet && (
            <button className="btn" onClick={() => setReglage(reglageOnglet)} title="Paramètres de la rubrique">
              ⚙ Paramètres
            </button>
          )}
        </div>
      </div>

      <div className="tabs-scroll print-hide">
        <div className="haccp-tabs" role="tablist" aria-label="Rubriques HACCP">
          {onglets.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={onglet === k} className={onglet === k ? "on" : ""} onClick={() => setOnglet(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {erreur && <div className="error">Impossible de charger le HACCP. Vérifie ta connexion puis recharge la page.</div>}

      {!d || !resume ? (
        !erreur && <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />
      ) : onglet === "jour" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <section className="haccp-mission" aria-label="Progression HACCP du jour">
            <div className="haccp-mission-main">
              <div className="haccp-mission-kicker"><span>✦</span> LE PETIT RITUEL DU JOUR</div>
              <h2>{resume.temperaturesTotal + resume.nettoyagesTotal === 0 ? "On prépare le service ?" : resume.temperaturesFaites === resume.temperaturesTotal && resume.nettoyagesFaits === resume.nettoyagesTotal ? "Tournée du jour terminée !" : "À toi de jouer !"}</h2>
              <p>{resume.temperaturesTotal + resume.nettoyagesTotal === 0 ? "Configure tes équipements froids et ton plan de nettoyage pour lancer ta première tournée." : "Deux petites étapes pour démarrer la journée du bon pied."}</p>
              {resume.temperaturesTotal + resume.nettoyagesTotal > 0 && <div className="haccp-progress-wrap"><div className="haccp-progress-track"><i style={{ width: `${Math.round(((resume.temperaturesFaites + resume.nettoyagesFaits) / (resume.temperaturesTotal + resume.nettoyagesTotal)) * 100)}%` }} /></div><b>{resume.temperaturesFaites + resume.nettoyagesFaits}<span> / {resume.temperaturesTotal + resume.nettoyagesTotal} gestes</span></b></div>}
            </div>
            <div className="haccp-mission-steps">
              <button className={`haccp-step${resume.temperaturesTotal > 0 && resume.temperaturesFaites === resume.temperaturesTotal ? resume.nonConformes ? " attention" : " done" : ""}`} onClick={() => setOnglet("temperatures")}>
                <span className="haccp-step-icon">🌡️</span><span><small>ÉTAPE 1</small><b>Tour des frigos</b><em>{resume.temperaturesTotal ? `${resume.temperaturesFaites}/${resume.temperaturesTotal} relevés${resume.nonConformes ? ` · ${resume.nonConformes} hors norme` : ""}` : "À configurer"}</em></span><strong>{resume.nonConformes ? "!" : resume.temperaturesTotal > 0 && resume.temperaturesFaites === resume.temperaturesTotal ? "✓" : "→"}</strong>
              </button>
              <button className={`haccp-step${resume.nettoyagesTotal > 0 && resume.nettoyagesFaits === resume.nettoyagesTotal ? " done" : ""}`} onClick={() => setOnglet("nettoyage")}>
                <span className="haccp-step-icon">🧽</span><span><small>ÉTAPE 2</small><b>Propreté des postes</b><em>{resume.nettoyagesTotal ? `${resume.nettoyagesFaits}/${resume.nettoyagesTotal} tâches` : "À configurer"}</em></span><strong>{resume.nettoyagesTotal > 0 && resume.nettoyagesFaits === resume.nettoyagesTotal ? "✓" : "→"}</strong>
              </button>
              <div className="haccp-mission-note"><span>{resume.nonConformes ? "⚠" : "⏱"}</span> {resume.nonConformes ? `${resume.nonConformes} relevé${resume.nonConformes > 1 ? "s" : ""} hors norme à vérifier` : resume.enCours ? `${resume.enCours} refroidissement${resume.enCours > 1 ? "s" : ""} à surveiller` : "Tout est prêt pour le service"}</div>
            </div>
          </section>
          <div className="grid-stats">
            <button className="card stat" onClick={() => setOnglet("temperatures")}>
              <div className="stat-top">
                Relevés du {resume.creneau}
                <span className={`chip-ic ${resume.relevesOk ? "t-mint" : "t-blue"}`}>❄</span>
              </div>
              <div className="stat-value">{d.equipements.length ? resume.releves : "—"}</div>
              <div className="stat-foot" style={{ color: resume.nonConformes ? "var(--red-ink)" : undefined }}>
                {!d.equipements.length ? "Aucun équipement déclaré" : resume.nonConformes ? `⚠ ${resume.nonConformes} hors norme aujourd'hui` : "Tout est dans les normes"}
              </div>
            </button>
            <button className="card stat" onClick={() => setOnglet("nettoyage")}>
              <div className="stat-top">
                Nettoyage du jour
                <span className={`chip-ic ${resume.nettoyageOk ? "t-mint" : "t-lav"}`}>✓</span>
              </div>
              <div className="stat-value">{d.plan.length ? resume.nettoyage : "—"}</div>
              <div className="stat-foot">{resume.restentAutres ? `+ ${resume.restentAutres} tâche(s) de la semaine ou du mois` : "Semaine et mois à jour"}</div>
            </button>
            <button className="card stat" onClick={() => setOnglet("refroidissement")}>
              <div className="stat-top">
                Refroidissements
                <span className={`chip-ic ${resume.depasses ? "t-red" : "t-peach"}`}>⏱</span>
              </div>
              <div className="stat-value">{resume.enCours}</div>
              <div className="stat-foot" style={{ color: resume.depasses ? "var(--red-ink)" : undefined }}>
                {resume.depasses ? `⚠ ${resume.depasses} au-delà de 2 h` : "en cours"}
              </div>
            </button>
            <button className="card stat" onClick={() => setOnglet("etiquettes")}>
              <div className="stat-top">
                DLC
                <span className={`chip-ic ${resume.dlcDepassees ? "t-red" : "t-yellow"}`}>⌛</span>
              </div>
              <div className="stat-value">{resume.dlcAujourdhui}</div>
              <div className="stat-foot" style={{ color: resume.dlcDepassees ? "var(--red-ink)" : undefined }}>
                {resume.dlcDepassees ? `⚠ ${resume.dlcDepassees} dépassée(s) : à jeter` : "expire(nt) aujourd'hui"}
              </div>
            </button>
          </div>
          <Temperatures {...communs} equipements={d.equipements} releves={parType.temperature} gestion={parametres} onConfigurer={() => setReglage("equipements")} />
          {parType.refroidissement.some((r) => !r.data.fin_at) && <Refroidissements {...communs} liste={parType.refroidissement} enCoursSeulement />}
          <Nettoyage {...communs} parametres={parametres} plan={d.plan} faits={parType.nettoyage} duJour onConfigurer={() => setReglage("nettoyage")} />
        </div>
      ) : onglet === "temperatures" ? (
        <Temperatures {...communs} equipements={d.equipements} releves={parType.temperature} gestion={parametres} historique={historique} onConfigurer={() => setReglage("equipements")} />
      ) : onglet === "tracabilite" ? (
        <Tracabilite {...communs} liste={parType.photos} config={d.tracabilite} />
      ) : onglet === "etiquettes" ? (
        <Etiquettes
          {...communs}
          etablissementNom={etablissement.nom}
          initiales={initiales(compte)}
          liste={parType.tracabilite}
          catalogue={d.produitsDlc}
          gestion={parametres}
          onConfigurer={() => setReglage("dlc")}
        />
      ) : onglet === "nettoyage" ? (
        <Nettoyage {...communs} parametres={parametres} plan={d.plan} faits={parType.nettoyage} onConfigurer={() => setReglage("nettoyage")} />
      ) : onglet === "refroidissement" ? (
        <Refroidissements {...communs} liste={parType.refroidissement} />
      ) : onglet === "suivi-production" ? (
        <Production {...communs} initiales={initiales(compte)} etablissementNom={etablissement.nom} liste={parType.production} historique={historique} />
      ) : (
        <Registre key={typeRegistre} liste={d.enregs} gestion={gestion} etablissementCode={etablissement.code} typeInitial={typeRegistre} onSaved={sauve} />
      )}

      {onglet === "registre" && <p className="hint print-hide" style={{ marginTop: 10 }}>Le registre affiche les {JOURS_CHARGES} derniers jours (depuis le {new Date(ajouterJours(iso(new Date()), -JOURS_CHARGES)).toLocaleDateString("fr-FR")}).</p>}

      {d && reglage === "equipements" && <ModalEquipements etablissementId={etablissement.id} equipements={d.equipements} onClose={() => setReglage(null)} onSaved={fermerReglage} />}
      {d && reglage === "dlc" && <ModalProduitsDlc etablissementId={etablissement.id} catalogue={d.produitsDlc} onClose={() => setReglage(null)} onSaved={fermerReglage} />}
      {d && reglage === "tracabilite" && <ModalTracabilite etablissementId={etablissement.id} config={d.tracabilite} onClose={() => setReglage(null)} onSaved={fermerReglage} />}
      {d && reglage === "nettoyage" && <ModalPlan etablissementId={etablissement.id} plan={d.plan} onClose={() => setReglage(null)} onSaved={fermerReglage} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
