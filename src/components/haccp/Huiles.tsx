"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { ACTIONS_HUILE, huileConforme, nouvelId, TEMP_FRITURE_MAX } from "@/lib/haccp";
import type { ActionHuile, Enregistrement, Friteuse, Huile, HuilesConfig, Prestataire } from "@/lib/haccp";
import Icone from "@/components/Icone";

type Props = {
  etablissementId: string;
  compteId: string;
  config: HuilesConfig;
  liste: Enregistrement<Huile>[];
  parametres: boolean;
  onConfigurer: () => void;
  onSaved: (message: string) => void;
};

const nombre = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
const jours = (at: string) => Math.floor((Date.now() - new Date(at).getTime()) / 864e5);

// Huiles de friture : contrôle des composés polaires et de la température, filtrations,
// changements d'huile, et collecte de l'huile usagée par le prestataire.
export default function Huiles(p: Props) {
  const [saisie, setSaisie] = useState<{ friteuse: Friteuse | null; action: ActionHuile } | null>(null);

  const dernier = (f: Friteuse, actions: ActionHuile[]) => [...p.liste].reverse().find((e) => e.data.friteuse_id === f.id && actions.includes(e.data.action));
  const collectes = p.liste.filter((e) => e.data.action === "collecte").slice().reverse();
  const pr = p.config.prestataire;

  if (!p.config.friteuses.length) {
    return (
      <section className="card empty">
        <b>Aucune friteuse déclarée</b>
        {p.parametres ? "Déclare tes friteuses et le prestataire qui collecte l'huile usagée." : "Un responsable doit d'abord déclarer les friteuses."}
        {p.parametres && (
          <p style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={p.onConfigurer}>
              <Icone nom="reglages" /> Déclarer les friteuses
            </button>
          </p>
        )}
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="huile-grid">
        {p.config.friteuses.map((f) => {
          const ctrl = dernier(f, ["controle"]);
          const chg = dernier(f, ["changement"]);
          const filt = dernier(f, ["filtration", "changement"]);
          const alerte = ctrl?.data.conforme === false && (!chg || chg.created_at < ctrl.created_at);
          return (
            <section key={f.id} className={`huile-card${alerte ? " alerte" : ""}`}>
              <div className="huile-tete">
                <b>{f.nom}</b>
                {f.capacite_l ? <small>{f.capacite_l} L</small> : null}
              </div>
              <div className="huile-etat">
                <span>
                  <small>Dernier contrôle</small>
                  <b>{ctrl ? `${ctrl.data.polaires != null ? `${ctrl.data.polaires} %` : "—"} · ${jours(ctrl.created_at) === 0 ? "aujourd'hui" : `il y a ${jours(ctrl.created_at)} j`}` : "jamais"}</b>
                </span>
                <span>
                  <small>Huile changée</small>
                  <b>{chg ? (jours(chg.created_at) === 0 ? "aujourd'hui" : `il y a ${jours(chg.created_at)} j`) : "—"}</b>
                </span>
                <span>
                  <small>Filtrée</small>
                  <b>{filt ? (jours(filt.created_at) === 0 ? "aujourd'hui" : `il y a ${jours(filt.created_at)} j`) : "—"}</b>
                </span>
              </div>
              {alerte && <div className="huile-alerte">⚠ Huile hors norme : à changer</div>}
              <div className="huile-actions">
                {(["controle", "filtration", "changement"] as const).map((a) => (
                  <button key={a} className={`btn${a === "controle" ? " btn-primary" : ""}`} onClick={() => setSaisie({ friteuse: f, action: a })}>
                    <Icone nom={ACTIONS_HUILE[a].icone} /> {ACTIONS_HUILE[a].label}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="card">
        <div className="card-head">
          <h2><Icone nom="camion" taille={18} /> Collecte des huiles usagées</h2>
          <span style={{ display: "flex", gap: 8 }}>
            {p.parametres && (
              <button className="btn" onClick={p.onConfigurer}>
                <Icone nom="reglages" /> Prestataire
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setSaisie({ friteuse: null, action: "collecte" })}>
              + Noter une collecte
            </button>
          </span>
        </div>
        {pr.nom ? (
          <div className="presta">
            <div>
              <b>{pr.nom}</b>
              {pr.contact && <small>{pr.contact}</small>}
              {pr.frequence && <small>Passage : {pr.frequence}</small>}
            </div>
            <div className="presta-liens">
              {pr.telephone && (
                <a className="btn" href={`tel:${pr.telephone.replace(/\s/g, "")}`}>
                  <Icone nom="telephone" taille={14} /> {pr.telephone}
                </a>
              )}
              {pr.email && (
                <a className="btn" href={`mailto:${pr.email}?subject=${encodeURIComponent("Demande de collecte d'huile usagée")}`}>
                  ✉ {pr.email}
                </a>
              )}
            </div>
            {pr.adresse && <small className="hint">{pr.adresse}</small>}
            {pr.note && <small className="hint">{pr.note}</small>}
          </div>
        ) : (
          <p className="hint">Aucun prestataire renseigné.{p.parametres ? " Ajoute ses coordonnées avec le bouton Prestataire." : ""}</p>
        )}
        {collectes.length > 0 && (
          <div className="rows" style={{ marginTop: 10 }}>
            {collectes.slice(0, 6).map((c) => (
              <div key={c.id} className="row">
                <span className="main-txt">
                  <b>
                    {new Date(c.created_at).toLocaleDateString("fr-FR")} · {c.data.litres != null ? `${c.data.litres} L` : "quantité non notée"}
                  </b>
                  <small>
                    {c.data.bordereau ? `Bordereau ${c.data.bordereau} · ` : ""}
                    {c.auteur}
                    {c.data.remarque ? ` · ${c.data.remarque}` : ""}
                  </small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {saisie && <ModalSaisie {...p} friteuse={saisie.friteuse} action={saisie.action} onClose={() => setSaisie(null)} />}
    </div>
  );
}

function ModalSaisie({ etablissementId, compteId, config, friteuse, action, onClose, onSaved }: Props & { friteuse: Friteuse | null; action: ActionHuile; onClose: () => void }) {
  const [polaires, setPolaires] = useState("");
  const [temperature, setTemperature] = useState("");
  const [litres, setLitres] = useState(action === "changement" && friteuse?.capacite_l ? String(friteuse.capacite_l) : "");
  const [bordereau, setBordereau] = useState("");
  const [remarque, setRemarque] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const vPol = nombre(polaires);
  const vTemp = nombre(temperature);
  const conforme = action === "controle" ? huileConforme(vPol, vTemp, config.seuil_polaires) : undefined;

  async function enregistrer() {
    setErreur(null);
    if (action === "controle" && vPol == null && vTemp == null) return setErreur("Note au moins le taux de composés polaires ou la température.");
    if (conforme === false && !remarque.trim()) return setErreur("Hors norme : note l'action corrective (ex. huile changée).");
    const data: Huile = {
      action,
      ...(friteuse ? { friteuse_id: friteuse.id, friteuse: friteuse.nom } : {}),
      ...(vPol != null ? { polaires: vPol } : {}),
      ...(vTemp != null ? { temperature: vTemp } : {}),
      ...(conforme !== undefined ? { conforme } : {}),
      ...(nombre(litres) != null ? { litres: nombre(litres) } : {}),
      ...(bordereau.trim() ? { bordereau: bordereau.trim() } : {}),
      ...(remarque.trim() ? { remarque: remarque.trim() } : {}),
    };
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_enregistrements").insert({ etablissement_id: etablissementId, compte_id: compteId, type: "huile", data });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé.");
    onClose();
    onSaved(`${ACTIONS_HUILE[action].label} enregistré${friteuse ? ` · ${friteuse.nom}` : ""}`);
  }

  return (
    <Modal
      titre={ACTIONS_HUILE[action].label}
      sousTitre={friteuse?.nom ?? config.prestataire.nom ?? undefined}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      {action === "controle" && (
        <>
          <div className="form-2">
            <div className="field">
              <label htmlFor="h-pol">Composés polaires (%)</label>
              <input id="h-pol" inputMode="decimal" value={polaires} onChange={(e) => setPolaires(e.target.value)} placeholder={`< ${config.seuil_polaires}`} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="h-temp">Température du bain (°C)</label>
              <input id="h-temp" inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder={`≤ ${TEMP_FRITURE_MAX}`} />
            </div>
          </div>
          {conforme !== undefined && <span className={`pill ${conforme ? "t-mint" : "t-red"}`} style={{ justifySelf: "start" }}>{conforme ? "Conforme" : "Hors norme : huile à changer"}</span>}
          <p className="hint" style={{ margin: 0 }}>
            Réglementation : huile à changer à partir de {config.seuil_polaires} % de composés polaires ; ne pas dépasser {TEMP_FRITURE_MAX} °C.
          </p>
        </>
      )}
      {(action === "changement" || action === "collecte") && (
        <div className="form-2">
          <div className="field">
            <label htmlFor="h-l">{action === "collecte" ? "Quantité collectée (L)" : "Huile neuve (L)"}</label>
            <input id="h-l" inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} />
          </div>
          {action === "collecte" && (
            <div className="field">
              <label htmlFor="h-b">N° de bordereau</label>
              <input id="h-b" value={bordereau} onChange={(e) => setBordereau(e.target.value)} />
            </div>
          )}
        </div>
      )}
      <div className="field">
        <label htmlFor="h-r">{conforme === false ? "Action corrective (obligatoire)" : "Remarque (facultatif)"}</label>
        <input id="h-r" value={remarque} onChange={(e) => setRemarque(e.target.value)} />
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}

export function ModalHuiles({ etablissementId, config, onClose, onSaved }: { etablissementId: string; config: HuilesConfig; onClose: () => void; onSaved: (m: string) => void }) {
  const [friteuses, setFriteuses] = useState<Friteuse[]>(config.friteuses);
  const [seuil, setSeuil] = useState(String(config.seuil_polaires));
  const [pr, setPr] = useState<Prestataire>(config.prestataire);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (id: string, c: Partial<Friteuse>) => setFriteuses((l) => l.map((f) => (f.id === id ? { ...f, ...c } : f)));

  async function enregistrer() {
    const data: HuilesConfig = {
      friteuses: friteuses.filter((f) => f.nom.trim()).map((f) => ({ ...f, nom: f.nom.trim() })),
      seuil_polaires: Math.min(30, Math.max(10, Number(seuil.replace(",", ".")) || 25)),
      prestataire: Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as Prestataire,
    };
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_config").upsert({ etablissement_id: etablissementId, cle: "huiles", data }, { onConflict: "etablissement_id,cle" });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : il faut l'accréditation « paramètres HACCP ».");
    onSaved("Paramètres des huiles enregistrés");
  }

  const champ = (k: keyof Prestataire, label: string, type = "text") => (
    <div className="field">
      <label htmlFor={`pr-${k}`}>{label}</label>
      <input id={`pr-${k}`} type={type} value={pr[k] ?? ""} onChange={(e) => setPr({ ...pr, [k]: e.target.value })} />
    </div>
  );

  return (
    <Modal
      titre="Paramètres des huiles de friture"
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Friteuses</label>
        <div className="plan-list">
          {friteuses.map((f) => (
            <div key={f.id} className="plan-row" style={{ gridTemplateColumns: "1fr 110px 32px" }}>
              <input value={f.nom} onChange={(e) => maj(f.id, { nom: e.target.value })} placeholder="ex. Friteuse 1 (frites)" aria-label="Nom" />
              <input inputMode="decimal" value={f.capacite_l ?? ""} onChange={(e) => maj(f.id, { capacite_l: nombre(e.target.value) })} placeholder="Litres" aria-label="Capacité en litres" />
              <button className="icon-btn" onClick={() => setFriteuses((l) => l.filter((x) => x.id !== f.id))} aria-label="Retirer">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn" style={{ justifySelf: "start" }} onClick={() => setFriteuses((l) => [...l, { id: nouvelId(), nom: "" }])}>
          + Ajouter une friteuse
        </button>
      </div>
      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor="h-seuil">Seuil composés polaires (%)</label>
        <input id="h-seuil" inputMode="decimal" value={seuil} onChange={(e) => setSeuil(e.target.value)} />
      </div>
      <div className="nav-label" style={{ padding: 0, marginTop: 6 }}>
        Prestataire de collecte
      </div>
      <div className="form-2">
        {champ("nom", "Société")}
        {champ("contact", "Interlocuteur")}
      </div>
      <div className="form-2">
        {champ("telephone", "Téléphone", "tel")}
        {champ("email", "E-mail", "email")}
      </div>
      {champ("adresse", "Adresse")}
      <div className="form-2">
        {champ("frequence", "Fréquence de passage (ex. tous les 15 jours)")}
        {champ("note", "Note (n° client, contrat…)")}
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
