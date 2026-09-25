"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { ORDRE_POSTES, POSTES } from "@/lib/planning";

type Props = {
  compteId: string;
  nom: string;
  poste: string | null;
  heuresContrat: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export default function ModalPersonne(p: Props) {
  const [poste, setPoste] = useState(p.poste ?? "");
  const [heures, setHeures] = useState(p.heuresContrat != null ? String(p.heuresContrat) : "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function enregistrer() {
    const h = heures.trim() === "" ? null : Number(heures.replace(",", "."));
    if (h !== null && (!Number.isFinite(h) || h < 0 || h > 60)) return setErreur("Heures contrat : un nombre entre 0 et 60.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!
      .from("comptes")
      .update({ poste: poste || null, heures_contrat: h })
      .eq("id", p.compteId);
    setEnvoi(false);
    if (error) return setErreur("Modification refusée. Seuls les responsables peuvent modifier l'équipe.");
    p.onSaved("Fiche mise à jour");
  }

  return (
    <Modal
      titre={p.nom}
      sousTitre="Poste et heures prévues au contrat"
      onClose={p.onClose}
      pied={
        <>
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Poste</label>
        <div className="chips">
          {ORDRE_POSTES.map((k) => (
            <button key={k} className={`chip${poste === k ? " on" : ""}`} onClick={() => setPoste(k)}>
              {POSTES[k].label}
            </button>
          ))}
          <button className={`chip${poste === "" ? " on" : ""}`} onClick={() => setPoste("")}>
            Non défini
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="heures">Heures contrat par semaine</label>
        <input id="heures" inputMode="decimal" value={heures} onChange={(e) => setHeures(e.target.value)} placeholder="35" />
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
