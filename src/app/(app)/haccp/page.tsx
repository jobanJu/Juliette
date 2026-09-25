"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, useConnecte } from "@/lib/session";
import { ajouterJours, iso } from "@/lib/planning";
import { COLONNES_ENREG, creneauReleve, joursRestants, periodeDe, REFROID_DUREE_MAX_MIN } from "@/lib/haccp";
import type { Enregistrement, Equipement, Etiquette, Nettoyage as Fait, Refroidissement, Tache, Temperature } from "@/lib/haccp";
import Temperatures from "@/components/haccp/Temperatures";
import ModalEquipements from "@/components/haccp/ModalEquipements";
import Nettoyage from "@/components/haccp/Nettoyage";
import Refroidissements from "@/components/haccp/Refroidissements";
import Etiquettes from "@/components/haccp/Etiquettes";
import Registre from "@/components/haccp/Registre";

type Onglet = "jour" | "temperatures" | "nettoyage" | "refroidissement" | "etiquettes" | "registre";
const JOURS_CHARGES = 90;

type Donnees = { equipements: Equipement[]; plan: Tache[]; enregs: Enregistrement[] };

export default function Haccp() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;
  const [onglet, setOnglet] = useState<Onglet>("jour");
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [version, setVersion] = useState(0);
  const [equip, setEquip] = useState(false);
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
    ]).then(([c, e, r]) => {
      if (!vivant) return;
      if (c.error || e.error) return setErreur(true);
      const conf = new Map((c.data ?? []).map((x) => [x.cle, x.data]));
      setD({
        equipements: (conf.get("equipements") as Equipement[]) ?? [],
        plan: (conf.get("plan_nettoyage") as Tache[]) ?? [],
        enregs: [...((r.data ?? []) as Enregistrement[]), ...((e.data ?? []) as Enregistrement[])],
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
      tracabilite: e.filter((x) => x.type === "tracabilite") as Enregistrement<Etiquette>[],
    };
  }, [d]);

  const resume = useMemo(() => {
    if (!d) return null;
    const jour = iso(new Date(maintenant));
    const creneau = creneauReleve(new Date(maintenant));
    const relevesJour = parType.temperature.filter((r) => iso(new Date(r.created_at)) === jour);
    const faitsCreneau = new Set(relevesJour.filter((r) => creneauReleve(r.created_at) === creneau).map((r) => r.data.equipement_id));
    const nonConformes = relevesJour.filter((r) => !r.data.conforme).length;
    const quotidien = d.plan.filter((t) => t.frequence === "quotidien");
    const faitsQuot = quotidien.filter((t) => parType.nettoyage.some((f) => f.data.tache_id === t.id && f.data.periode === periodeDe("quotidien", new Date(maintenant)))).length;
    const autres = d.plan.filter((t) => t.frequence !== "quotidien");
    const restentAutres = autres.filter((t) => !parType.nettoyage.some((f) => f.data.tache_id === t.id && f.data.periode === periodeDe(t.frequence, new Date(maintenant)))).length;
    const enCours = parType.refroidissement.filter((r) => !r.data.fin_at);
    const depasses = enCours.filter((r) => (maintenant - new Date(r.data.debut_at).getTime()) / 60000 > REFROID_DUREE_MAX_MIN).length;
    const dlc = parType.tracabilite.map((e) => joursRestants(e.data.dlc, jour));
    return {
      creneau,
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

  const onglets: [Onglet, string][] = [
    ["jour", "Aujourd'hui"],
    ["temperatures", "Températures"],
    ["nettoyage", "Nettoyage"],
    ["refroidissement", "Refroidissement"],
    ["etiquettes", "Étiquettes DLC"],
    ["registre", "Registre"],
  ];

  const communs = { etablissementId: etablissement.id, compteId: compte.id, onSaved: sauve };

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">HACCP</p>
          <h1>Hygiène & sécurité alimentaire</h1>
          <p>Températures, nettoyage, refroidissements et traçabilité : ton plan de maîtrise sanitaire, à jour et prêt pour un contrôle.</p>
        </div>
      </div>

      <div className="tabs-scroll print-hide">
        <div className="seg seg-inline" role="tablist">
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
          <Temperatures {...communs} equipements={d.equipements} releves={parType.temperature} gestion={gestion} onConfigurer={() => setEquip(true)} />
          {parType.refroidissement.some((r) => !r.data.fin_at) && <Refroidissements {...communs} liste={parType.refroidissement} enCoursSeulement />}
          <Nettoyage {...communs} gestion={gestion} plan={d.plan} faits={parType.nettoyage} duJour />
        </div>
      ) : onglet === "temperatures" ? (
        <Temperatures {...communs} equipements={d.equipements} releves={parType.temperature} gestion={gestion} historique onConfigurer={() => setEquip(true)} />
      ) : onglet === "nettoyage" ? (
        <Nettoyage {...communs} gestion={gestion} plan={d.plan} faits={parType.nettoyage} />
      ) : onglet === "refroidissement" ? (
        <Refroidissements {...communs} liste={parType.refroidissement} />
      ) : onglet === "etiquettes" ? (
        <Etiquettes {...communs} etablissementNom={etablissement.nom} initiales={initiales(compte)} liste={parType.tracabilite} />
      ) : (
        <Registre liste={d.enregs} gestion={gestion} etablissementCode={etablissement.code} onSaved={sauve} />
      )}

      {onglet === "registre" && <p className="hint print-hide" style={{ marginTop: 10 }}>Le registre affiche les {JOURS_CHARGES} derniers jours (depuis le {new Date(ajouterJours(iso(new Date()), -JOURS_CHARGES)).toLocaleDateString("fr-FR")}).</p>}

      {equip && d && (
        <ModalEquipements
          etablissementId={etablissement.id}
          equipements={d.equipements}
          onClose={() => setEquip(false)}
          onSaved={(m) => {
            setEquip(false);
            sauve(m);
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
