"use client";

import { useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { ajouterJours, depuisIso, iso } from "@/lib/planning";
import { CRENEAUX_RELEVE, creneauReleve, EQUIPEMENTS_TYPES, estConforme, formatTemp } from "@/lib/haccp";
import type { Enregistrement, Equipement, Temperature } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  compteId: string;
  equipements: Equipement[];
  releves: Enregistrement<Temperature>[];
  /** Accréditation « historique HACCP » : peut consulter les relevés passés. */
  historique?: boolean;
  gestion: boolean;
  onConfigurer: () => void;
  onSaved: (message: string) => void;
};

export default function Temperatures(p: Props) {
  const jour = iso(new Date());
  const creneauActuel = creneauReleve(new Date());
  const [creneauChoisi, setCreneauChoisi] = useState<"matin" | "soir">(creneauActuel);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<Record<string, string>>({});
  const [modifications, setModifications] = useState<Record<string, boolean>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoiGlobal, setEnvoiGlobal] = useState(false);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [voirHistorique, setVoirHistorique] = useState(false);

  const relevesDuJour = useMemo(
    () => p.releves.filter((r) => iso(new Date(r.created_at)) === jour),
    [p.releves, jour],
  );

  const mapFaitParEquipement = useMemo(() => {
    const map = new Map<string, Enregistrement<Temperature>>();
    for (const r of relevesDuJour) {
      if (creneauReleve(r.created_at) === creneauChoisi) {
        map.set(r.data.equipement_id, r);
      }
    }
    return map;
  }, [relevesDuJour, creneauChoisi]);

  const equipementsOrdonnes = p.equipements;

  // Valeur par défaut logique selon le type d'équipement
  const defautPour = (e: Equipement) => {
    if (e.type === "negatif") return -18;
    if (e.type === "chaud") return 65;
    return Math.round(((e.min + e.max) / 2) * 10) / 10;
  };

  const getValeurAffichee = (e: Equipement): string => {
    if (valeurs[e.id] !== undefined) return valeurs[e.id];
    return "";
  };

  const ajusterValeur = (e: Equipement, delta: number) => {
    setErreurs((prev) => ({ ...prev, [e.id]: "" }));
    setErreurGlobale(null);
    const courante = getValeurAffichee(e);
    let num = Number(courante.replace(",", "."));
    if (courante === "" || !Number.isFinite(num)) {
      num = defautPour(e);
    } else {
      num = Math.round((num + delta) * 10) / 10;
    }
    setValeurs((prev) => ({ ...prev, [e.id]: String(num) }));
  };

  const changerValeur = (e: Equipement, v: string) => {
    setErreurs((prev) => ({ ...prev, [e.id]: "" }));
    setErreurGlobale(null);
    setValeurs((prev) => ({ ...prev, [e.id]: v }));
  };

  const changerAction = (id: string, a: string) => {
    setErreurs((prev) => ({ ...prev, [id]: "" }));
    setActions((prev) => ({ ...prev, [id]: a }));
  };

  const ouvrirModification = (id: string, valeurInitiale?: number) => {
    setModifications((prev) => ({ ...prev, [id]: true }));
    if (valeurInitiale !== undefined) {
      setValeurs((prev) => ({ ...prev, [id]: String(valeurInitiale) }));
    }
  };

  const annulerModification = (id: string) => {
    setModifications((prev) => ({ ...prev, [id]: false }));
    setValeurs((prev) => {
      const c = { ...prev };
      delete c[id];
      return c;
    });
    setActions((prev) => {
      const c = { ...prev };
      delete c[id];
      return c;
    });
    setErreurs((prev) => {
      const c = { ...prev };
      delete c[id];
      return c;
    });
  };

  // Enregistrement d'un équipement individuel
  async function enregistrerUn(e: Equipement) {
    const raw = (valeurs[e.id] ?? "").trim();
    const v = Number(raw.replace(",", "."));
    if (raw === "" || !Number.isFinite(v)) {
      setErreurs((prev) => ({ ...prev, [e.id]: "Indique la température" }));
      return;
    }
    if (v < -40 || v > 110) {
      setErreurs((prev) => ({ ...prev, [e.id]: "Valeur improbable (-40°C à 110°C)" }));
      return;
    }
    const horsNorme = !estConforme(v, e);
    const act = (actions[e.id] ?? "").trim();
    if (horsNorme && !act) {
      setErreurs((prev) => ({ ...prev, [e.id]: "Action corrective obligatoire" }));
      return;
    }

    const sb = getSupabaseClient()!;
    const data: Temperature = {
      equipement_id: e.id,
      equipement: e.nom,
      valeur: v,
      min: e.min,
      max: e.max,
      conforme: !horsNorme,
      ...(horsNorme ? { action: act } : {}),
    };

    const { error } = await sb.from("haccp_enregistrements").insert({
      etablissement_id: p.etablissementId,
      compte_id: p.compteId,
      type: "temperature",
      data,
    });

    if (error) {
      setErreurs((prev) => ({ ...prev, [e.id]: "Erreur lors de l'enregistrement" }));
      return;
    }

    // Réinitialiser la carte
    setModifications((prev) => ({ ...prev, [e.id]: false }));
    setValeurs((prev) => {
      const c = { ...prev };
      delete c[e.id];
      return c;
    });
    setActions((prev) => {
      const c = { ...prev };
      delete c[e.id];
      return c;
    });
    p.onSaved(`${e.nom} : ${formatTemp(v)}${horsNorme ? " (hors norme)" : ""}`);
  }

  // Validation groupée de tous les équipements renseignés (bouton VALIDER de la maquette)
  async function validerTout() {
    setErreurGlobale(null);
    const aEnregistrer: { e: Equipement; valeur: number; horsNorme: boolean; action: string }[] = [];
    const nouvellesErreurs: Record<string, string> = {};

    for (const e of equipementsOrdonnes) {
      const fait = mapFaitParEquipement.get(e.id);
      const enModif = modifications[e.id];
      const raw = (valeurs[e.id] ?? "").trim();

      // Si pas encore fait et pas saisi, on vérifie s'il y a une saisie
      if (!fait || enModif) {
        if (raw !== "") {
          const v = Number(raw.replace(",", "."));
          if (!Number.isFinite(v) || v < -40 || v > 110) {
            nouvellesErreurs[e.id] = "Valeur invalide";
            continue;
          }
          const horsNorme = !estConforme(v, e);
          const act = (actions[e.id] ?? "").trim();
          if (horsNorme && !act) {
            nouvellesErreurs[e.id] = "Action corrective obligatoire";
            continue;
          }
          aEnregistrer.push({ e, valeur: v, horsNorme, action: act });
        }
      }
    }

    if (Object.keys(nouvellesErreurs).length > 0) {
      setErreurs(nouvellesErreurs);
      setErreurGlobale("Vérifie les cartes en alerte ci-dessous avant de valider.");
      return;
    }

    if (!aEnregistrer.length) {
      setErreurGlobale("Aucune nouvelle température à valider. Utilise les boutons + / − ou saisis une valeur.");
      return;
    }

    setEnvoiGlobal(true);
    const sb = getSupabaseClient()!;
    const rows = aEnregistrer.map(({ e, valeur, horsNorme, action }) => ({
      etablissement_id: p.etablissementId,
      compte_id: p.compteId,
      type: "temperature",
      data: {
        equipement_id: e.id,
        equipement: e.nom,
        valeur,
        min: e.min,
        max: e.max,
        conforme: !horsNorme,
        ...(horsNorme ? { action } : {}),
      },
    }));

    const { error } = await sb.from("haccp_enregistrements").insert(rows);
    setEnvoiGlobal(false);

    if (error) {
      setErreurGlobale("Une erreur est survenue lors de l'enregistrement de la tournée.");
      return;
    }

    setValeurs({});
    setActions({});
    setModifications({});
    setErreurs({});
    p.onSaved(`${aEnregistrer.length} relevé(s) de température validé(s)`);
  }

  // Nombre de frigos validés pour ce créneau
  const nbFaits = equipementsOrdonnes.filter((e) => mapFaitParEquipement.has(e.id)).length;
  const nbTotal = equipementsOrdonnes.length;
  const tourneeComplete = nbTotal > 0 && nbFaits === nbTotal;

  // Décompte de ceux prêts à être validés
  const nbEnAttente = equipementsOrdonnes.filter((e) => {
    const raw = (valeurs[e.id] ?? "").trim();
    return raw !== "" && (!mapFaitParEquipement.has(e.id) || modifications[e.id]);
  }).length;

  if (!equipementsOrdonnes.length) {
    return (
      <section className="card empty">
        <b>Aucun équipement froid déclaré</b>
        <p>
          {p.gestion
            ? "Déclare tes frigos, chambres froides et tiroirs pour commencer les relevés tactiles."
            : "Un responsable doit d'abord déclarer les équipements."}
        </p>
        {p.gestion && (
          <p style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={p.onConfigurer}>
              ⚙ Déclarer les équipements
            </button>
          </p>
        )}
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Barre de contrôle du créneau & actions */}
      <section className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Relevé du service :</span>
            <div className="seg" role="tablist">
              <button
                type="button"
                className={creneauChoisi === "matin" ? "on" : ""}
                onClick={() => setCreneauChoisi("matin")}
              >
                🌅 Matin (ouverture)
              </button>
              <button
                type="button"
                className={creneauChoisi === "soir" ? "on" : ""}
                onClick={() => setCreneauChoisi("soir")}
              >
                🌙 Soir (fermeture)
              </button>
            </div>
            {creneauChoisi !== creneauActuel && (
              <span className="hint" style={{ fontSize: 11 }}>
                (Créneau actuel : {creneauActuel})
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className={`pill ${tourneeComplete ? "t-mint" : "t-lav"}`} style={{ fontSize: 12, padding: "4px 10px" }}>
              {tourneeComplete ? "✓ Tournée complète" : `${nbFaits} / ${nbTotal} relevés`}
            </span>
            {p.gestion && (
              <button className="btn btn-sm" onClick={p.onConfigurer} title="Ajouter, modifier ou réorganiser les frigos">
                ⚙ Paramètres & Ordre
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Grille tactile des frigos (style maquette) */}
      <div className="haccp-frigo-grid">
        {equipementsOrdonnes.map((e) => {
          const fait = mapFaitParEquipement.get(e.id);
          const enModif = modifications[e.id] ?? false;
          const aDejaReleve = fait && !enModif;
          const valStr = getValeurAffichee(e);
          const valNum = Number(valStr.replace(",", "."));
          const aSaisi = valStr.trim() !== "" && Number.isFinite(valNum);
          const horsNorme = aSaisi && !estConforme(valNum, e);
          const actionTxt = actions[e.id] ?? "";
          const erreurTxt = erreurs[e.id];
          const typeInfo = EQUIPEMENTS_TYPES[e.type];

          return (
            <div
              key={e.id}
              className={`haccp-frigo-tile${aDejaReleve ? (fait.data.conforme ? " fait-ok" : " fait-ko") : horsNorme ? " alerte-ko" : aSaisi ? " pret" : ""}`}
            >
              {/* En-tête de la dalle */}
              <div className="haccp-frigo-head">
                <div>
                  <h3 className="haccp-frigo-title">{e.nom}</h3>
                  <span className="haccp-frigo-sub">
                    {typeInfo.icone} {typeInfo.label} · Norme {formatTemp(e.min)} à {formatTemp(e.max)}
                  </span>
                </div>
                {aDejaReleve && (
                  <span className={`pill-sm ${fait.data.conforme ? "t-mint" : "t-red"}`}>
                    {fait.data.conforme ? "✓ Fait" : "⚠ Alerte"}
                  </span>
                )}
              </div>

              {/* Contenu principal : Relevé effectué ou Stepper tactile */}
              {aDejaReleve ? (
                <div className="haccp-frigo-done">
                  <div className="haccp-frigo-temp-big">
                    {formatTemp(fait.data.valeur)}
                  </div>
                  <div className="haccp-frigo-meta">
                    Relevé à {new Date(fait.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} par <b>{fait.auteur}</b>
                  </div>
                  {fait.data.action && (
                    <div className="haccp-frigo-action-done">
                      Action : {fait.data.action}
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => ouvrirModification(e.id, fait.data.valeur)}
                    >
                      ✏ Modifier ce relevé
                    </button>
                  </div>
                </div>
              ) : (
                <div className="haccp-frigo-body">
                  {/* Stepper tactile grande taille (- valeur +) */}
                  <div className="haccp-stepper-wrap">
                    <button
                      type="button"
                      className="haccp-stepper-btn"
                      onClick={() => ajusterValeur(e, -0.5)}
                      aria-label={`Diminuer la température de ${e.nom}`}
                    >
                      −
                    </button>

                    <div className="haccp-stepper-display">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="haccp-stepper-input"
                        placeholder={String(defautPour(e)).replace(".", ",")}
                        value={valStr}
                        onChange={(ev) => changerValeur(e, ev.target.value)}
                        aria-label={`Température pour ${e.nom}`}
                      />
                      <span className="haccp-stepper-unit">°C</span>
                    </div>

                    <button
                      type="button"
                      className="haccp-stepper-btn"
                      onClick={() => ajusterValeur(e, 0.5)}
                      aria-label={`Augmenter la température de ${e.nom}`}
                    >
                      +
                    </button>
                  </div>

                  {/* Statut de conformité en direct */}
                  {aSaisi && (
                    <div className={`haccp-conforme-badge ${horsNorme ? "ko" : "ok"}`}>
                      {horsNorme ? "⚠ HORS NORME : Action requise" : "✓ Dans la norme"}
                    </div>
                  )}

                  {/* Saisie de l'action corrective si hors norme */}
                  {horsNorme && (
                    <div className="haccp-action-box">
                      <label htmlFor={`act-${e.id}`} className="haccp-action-label">
                        Action corrective obligatoire :
                      </label>
                      <input
                        id={`act-${e.id}`}
                        className="haccp-action-input"
                        placeholder="Ex. : transfert en chambre froide, thermostat réglé..."
                        value={actionTxt}
                        onChange={(ev) => changerAction(e.id, ev.target.value)}
                      />
                    </div>
                  )}

                  {/* Message d'erreur local */}
                  {erreurTxt && <div className="haccp-frigo-err">{erreurTxt}</div>}

                  {/* Actions directes au bas de la dalle */}
                  <div className="haccp-frigo-foot">
                    {enModif && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => annulerModification(e.id)}
                      >
                        Annuler
                      </button>
                    )}
                    {aSaisi && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => enregistrerUn(e)}
                      >
                        ✓ Enregistrer seul
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barre de validation globale en bas (comme VALIDE dans la maquette) */}
      <div className="haccp-valider-bar">
        <div className="haccp-valider-info">
          <b>Tournée du {creneauChoisi}</b>
          <span>
            {nbFaits} frigo(s) déjà validé(s) · {nbEnAttente} prêt(s) à être enregistré(s)
          </span>
        </div>

        {erreurGlobale && <div className="haccp-valider-err">{erreurGlobale}</div>}

        <button
          type="button"
          className="btn btn-primary haccp-valider-btn"
          disabled={envoiGlobal || nbEnAttente === 0}
          onClick={validerTout}
        >
          {envoiGlobal ? "Enregistrement en cours…" : `VALIDER LA TOURNÉE (${nbEnAttente})`}
        </button>
      </div>

      {/* Bouton pour afficher/masquer l'historique sur demande (sur accréditation) */}
      {p.historique && <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
        <button
          type="button"
          className="btn btn-sm"
          style={{ height: 32, fontSize: 12 }}
          onClick={() => setVoirHistorique((v) => !v)}
        >
          {voirHistorique ? "▲ Masquer l’historique des relevés" : "📊 Voir l’historique des relevés (14 jours)"}
        </button>
      </div>}

      {/* Tableau d'historique des 14 derniers jours à la demande */}
      {p.historique && voirHistorique && <Historique equipements={equipementsOrdonnes} releves={p.releves} />}
    </div>
  );
}

function Historique({ equipements, releves }: { equipements: Equipement[]; releves: Enregistrement<Temperature>[] }) {
  const jours = useMemo(() => Array.from({ length: 14 }, (_, i) => ajouterJours(iso(new Date()), -i)), []);
  const index = useMemo(() => {
    const m = new Map<string, Enregistrement<Temperature>>();
    for (const r of releves) {
      m.set(`${r.data.equipement_id}|${iso(new Date(r.created_at))}|${creneauReleve(r.created_at)}`, r);
    }
    return m;
  }, [releves]);

  return (
    <section className="card" style={{ marginTop: 8, padding: "16px 12px" }}>
      <div className="card-head" style={{ padding: "0 4px 8px" }}>
        <div>
          <h2 style={{ fontSize: 16 }}>Historique des relevés (14 derniers jours)</h2>
          <p className="hint" style={{ margin: "2px 0 0" }}>
            Relevés officiels horodatés pour les contrôles d’hygiène. Case vide = aucun relevé enregistré.
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data temp-hist">
          <thead>
            <tr>
              <th style={{ minWidth: 110 }}>Jour</th>
              {equipements.map((e) => (
                <th key={e.id} colSpan={2} style={{ textAlign: "center", borderLeft: "1px solid var(--line)" }}>
                  {e.nom}
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {equipements.map((e) =>
                CRENEAUX_RELEVE.map((c) => (
                  <th key={e.id + c.cle} style={{ fontSize: 10, padding: "4px 6px" }}>
                    {c.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {jours.map((j) => (
              <tr key={j}>
                <td style={{ whiteSpace: "nowrap", textTransform: "capitalize", fontWeight: 500 }}>
                  {depuisIso(j).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </td>
                {equipements.map((e) =>
                  CRENEAUX_RELEVE.map((c) => {
                    const r = index.get(`${e.id}|${j}|${c.cle}`);
                    return (
                      <td
                        key={e.id + c.cle}
                        className={r ? (r.data.conforme ? "th-ok" : "th-ko") : "th-vide"}
                        title={r ? `${r.auteur}${r.data.action ? ` · Action: ${r.data.action}` : ""}` : "Aucun relevé"}
                        style={{ textAlign: "center", fontSize: 12 }}
                      >
                        {r ? formatTemp(r.data.valeur) : "—"}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
