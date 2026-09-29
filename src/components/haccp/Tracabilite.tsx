"use client";

import { useMemo, useState } from "react";
import Camera from "@/components/Camera";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { depuisIso, iso } from "@/lib/planning";
import { joursRestants } from "@/lib/haccp";
import type { Enregistrement, TracabiliteConfig, TracePhoto } from "@/lib/haccp";
import PhotoHaccp, { envoyerPhoto } from "@/components/haccp/Photo";

type Props = {
  etablissementId: string;
  compteId: string;
  liste: Enregistrement<TracePhoto>[];
  config: TracabiliteConfig;
  onSaved: (message: string) => void;
};

const CHAMPS: [keyof TracabiliteConfig, string][] = [
  ["produit", "Article"],
  ["lot", "Lot"],
  ["dlc", "DLC"],
];

// Traçabilité (maquette p. 2) : on photographie l'étiquette du produit, puis on relève article, lot
// et DLC. Les champs obligatoires se règlent dans les paramètres.
export default function Tracabilite(p: Props) {
  const sb = getSupabaseClient()!;
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [champs, setChamps] = useState({ produit: "", lot: "", dlc: "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const aujourdhui = iso(new Date());
  const duJour = useMemo(() => p.liste.filter((e) => iso(new Date(e.created_at)) === aujourdhui).slice().reverse(), [p.liste, aujourdhui]);

  function choisir(f: File) {
    if (apercu) URL.revokeObjectURL(apercu);
    setFichier(f);
    setApercu(URL.createObjectURL(f));
    setErreur(null);
  }

  function reprendre() {
    if (apercu) URL.revokeObjectURL(apercu);
    setFichier(null);
    setApercu(null);
  }

  async function valider() {
    setErreur(null);
    if (!fichier) return setErreur("Prends d'abord la photo de l'étiquette.");
    const manquants = CHAMPS.filter(([k]) => p.config[k] && !champs[k].trim()).map(([, l]) => l);
    if (manquants.length) return setErreur(`À remplir : ${manquants.join(", ")}.`);
    setEnvoi(true);
    try {
      const photo = await envoyerPhoto(p.etablissementId, "tracabilite", fichier);
      const data: TracePhoto = { origine: "photo", produit: champs.produit.trim(), lot: champs.lot.trim(), dlc: champs.dlc, photo };
      const { error } = await sb.from("haccp_enregistrements").insert({ etablissement_id: p.etablissementId, compte_id: p.compteId, type: "tracabilite", data });
      if (error) throw error;
      if (apercu) URL.revokeObjectURL(apercu);
      setFichier(null);
      setApercu(null);
      setChamps({ produit: "", lot: "", dlc: "" });
      p.onSaved(`Traçabilité enregistrée${data.produit ? ` : ${data.produit}` : ""}`);
    } catch {
      setErreur("Envoi impossible. Vérifie ta connexion et réessaie.");
    }
    setEnvoi(false);
  }

  return (
    <div className="trace-grid">
      <section className="card trace-capture">
        {apercu ? (
          <div className="trace-apercu">
            <img src={apercu} alt="Étiquette photographiée" />
            <button className="trace-reprendre" onClick={reprendre} aria-label="Reprendre la photo" title="Reprendre la photo">
              ⟳
            </button>
          </div>
        ) : (
          <>
            <Camera inline onCapture={choisir} />
            <p className="hint" style={{ margin: 0, textAlign: "center" }}>
              Cadre l&apos;étiquette du produit reçu ou entamé : lot et DLC doivent être lisibles.
            </p>
          </>
        )}

        <div className="trace-champs">
          {CHAMPS.map(([k, l]) => (
            <div key={k} className="field">
              <label htmlFor={`trace-${k}`}>
                {l} {p.config[k] ? <span className="hint">· obligatoire</span> : <span className="hint">· facultatif</span>}
              </label>
              <input
                id={`trace-${k}`}
                type={k === "dlc" ? "date" : "text"}
                value={champs[k]}
                onChange={(e) => setChamps({ ...champs, [k]: e.target.value })}
                placeholder={k === "produit" ? "ex. Crème 35 % MG" : k === "lot" ? "ex. L24-0915" : undefined}
              />
            </div>
          ))}
        </div>
        {erreur && (
          <div className="error" role="alert">
            {erreur}
          </div>
        )}
        <button className="btn btn-primary btn-lg" onClick={valider} disabled={envoi}>
          {envoi ? "Envoi…" : "Valider"}
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Aujourd&apos;hui</h2>
          <span className="pill t-lav">{duJour.length} photo(s)</span>
        </div>
        {!duJour.length ? (
          <div className="empty">Aucune étiquette photographiée aujourd&apos;hui.</div>
        ) : (
          <div className="trace-liste">
            {duJour.map((e) => {
              const j = e.data.dlc ? joursRestants(e.data.dlc) : null;
              return (
                <div key={e.id} className="trace-item">
                  <PhotoHaccp chemin={e.data.photo} alt={e.data.produit} className="trace-vignette" />
                  <span className="main-txt">
                    <b>{e.data.produit || "Article non renseigné"}</b>
                    <small>
                      {e.data.lot ? `Lot ${e.data.lot}` : "Sans lot"} · {e.data.dlc ? `DLC ${depuisIso(e.data.dlc).toLocaleDateString("fr-FR")}` : "sans DLC"} · {e.auteur.split(" ")[0]}{" "}
                      {new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </span>
                  {j !== null && j <= 1 && <span className={`pill ${j < 0 ? "t-red" : "t-peach"}`}>{j < 0 ? "DLC dépassée" : j === 0 ? "DLC aujourd'hui" : "DLC demain"}</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function ModalTracabilite({ etablissementId, config, onClose, onSaved }: { etablissementId: string; config: TracabiliteConfig; onClose: () => void; onSaved: (m: string) => void }) {
  const [c, setC] = useState(config);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function enregistrer() {
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_config").upsert({ etablissement_id: etablissementId, cle: "tracabilite", data: c }, { onConflict: "etablissement_id,cle" });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : il faut l'accréditation « paramètres HACCP ».");
    onSaved("Paramètres de traçabilité enregistrés");
  }

  return (
    <Modal
      titre="Paramètres de la traçabilité"
      sousTitre="Ce que l'équipe doit relever avec la photo"
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
      <div className="rows">
        {CHAMPS.map(([k, l]) => (
          <label key={k} className="row" style={{ cursor: "pointer" }}>
            <span className="main-txt">
              <b>{l}</b>
              <small>{c[k] ? "Obligatoire pour valider" : "Facultatif"}</small>
            </span>
            <input type="checkbox" checked={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} aria-label={`${l} obligatoire`} />
          </label>
        ))}
      </div>
      <p className="hint">La photo de l&apos;étiquette est toujours demandée.</p>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
