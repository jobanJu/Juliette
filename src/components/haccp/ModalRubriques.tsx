"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { RUBRIQUES_HACCP } from "@/lib/haccp";

// Chaque établissement choisit les rubriques HACCP qu'il utilise ; les autres disparaissent des
// onglets (les données déjà saisies restent dans le registre).
export default function ModalRubriques({ etablissementId, masquees, onClose, onSaved }: { etablissementId: string; masquees: string[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [caches, setCaches] = useState(() => new Set(masquees));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function enregistrer() {
    if (caches.size >= RUBRIQUES_HACCP.length) return setErreur("Garde au moins une rubrique.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_config").upsert({ etablissement_id: etablissementId, cle: "rubriques", data: [...caches] }, { onConflict: "etablissement_id,cle" });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : il faut l'accréditation « paramètres HACCP ».");
    onSaved("Rubriques HACCP mises à jour");
  }

  return (
    <Modal
      titre="Rubriques HACCP affichées"
      sousTitre="Coche ce que ton établissement utilise"
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
        {RUBRIQUES_HACCP.map((r) => {
          const visible = !caches.has(r.cle);
          return (
            <label key={r.cle} className="row" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={visible}
                onChange={() =>
                  setCaches((c) => {
                    const n = new Set(c);
                    if (visible) n.add(r.cle);
                    else n.delete(r.cle);
                    return n;
                  })
                }
                style={{ width: 20, height: 20, accentColor: "var(--purple)" }}
              />
              <span className="main-txt">
                <b>{r.label}</b>
                <small>{visible ? "Affichée" : "Masquée"}</small>
              </span>
            </label>
          );
        })}
      </div>
      <p className="hint">La vue du jour et le registre restent toujours disponibles. Masquer une rubrique n&apos;efface rien.</p>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
