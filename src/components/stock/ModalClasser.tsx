"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { FAMILLES } from "@/lib/categories";
import type { Famille } from "@/lib/categories";
import type { Produit } from "@/lib/stock";

type Proposition = { p: Produit; g: { famille: Famille | null; sous_categorie: string | null } };

// Classement en masse des produits sans catégorie, d'après leur nom. Chaque ligne peut être décochée.
export default function ModalClasser({ propositions, onClose, onSaved }: { propositions: Proposition[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [retenus, setRetenus] = useState<Set<string>>(() => new Set(propositions.map((x) => x.p.id)));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    const sb = getSupabaseClient()!;
    const choisis = propositions.filter((x) => retenus.has(x.p.id));
    setEnvoi(true);
    let echecs = 0;
    for (let i = 0; i < choisis.length; i += 20) {
      const r = await Promise.all(
        choisis.slice(i, i + 20).map(({ p, g }) =>
          sb
            .from("produits")
            .update({ famille: p.famille ?? g.famille, sous_categorie: p.sous_categorie ?? g.sous_categorie })
            .eq("id", p.id),
        ),
      );
      echecs += r.filter((x) => x.error).length;
    }
    setEnvoi(false);
    if (echecs === choisis.length) return setErreur("Modification refusée : réservée aux directeurs et responsables.");
    onSaved(`${choisis.length - echecs} produit(s) classé(s)`);
  }

  return (
    <Modal
      titre="Classer automatiquement"
      sousTitre={`${retenus.size} produit(s) sur ${propositions.length}, classés d'après leur nom`}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={valider} disabled={envoi || !retenus.size}>
            {envoi ? "Classement…" : `Classer ${retenus.size} produit(s)`}
          </button>
        </>
      }
    >
      <p className="hint">Décoche ce qui ne convient pas. Tu pourras toujours corriger un produit depuis sa fiche.</p>
      <div className="pick-list" style={{ maxHeight: 420 }}>
        {propositions.map(({ p, g }) => {
          const f = p.famille ?? g.famille;
          return (
            <label key={p.id} className="pick">
              <input
                type="checkbox"
                checked={retenus.has(p.id)}
                onChange={() => {
                  const s = new Set(retenus);
                  if (s.has(p.id)) s.delete(p.id);
                  else s.add(p.id);
                  setRetenus(s);
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>{p.nom}</span>
              {f && <span className={`pill ${FAMILLES[f].ton}`}>{FAMILLES[f].label}</span>}
              <small className="hint">{p.sous_categorie ?? g.sous_categorie ?? ""}</small>
            </label>
          );
        })}
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
