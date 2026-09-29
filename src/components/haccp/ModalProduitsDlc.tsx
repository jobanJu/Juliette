"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { CATEGORIES_DLC, nouvelId } from "@/lib/haccp";
import type { CategorieDlcId, ProduitDlcConfig } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  catalogue: ProduitDlcConfig[];
  onClose: () => void;
  onSaved: (m: string) => void;
};

export default function ModalProduitsDlc({ etablissementId, catalogue, onClose, onSaved }: Props) {
  const [liste, setListe] = useState<ProduitDlcConfig[]>(catalogue);
  const [catFiltre, setCatFiltre] = useState<CategorieDlcId>("decongele");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const maj = (id: string, champ: Partial<ProduitDlcConfig>) =>
    setListe((l) => l.map((p) => (p.id === id ? { ...p, ...champ } : p)));

  const ajouter = () => {
    const cat = CATEGORIES_DLC.find((c) => c.id === catFiltre)!;
    setListe((l) => [
      ...l,
      {
        id: nouvelId(),
        categorieId: catFiltre,
        nom: "",
        dlcJours: cat.dlcDefautJours,
        conservation: cat.conservation,
      },
    ]);
  };

  async function enregistrer() {
    setErreur(null);
    const propres = liste
      .filter((p) => p.nom.trim())
      .map((p) => ({
        ...p,
        nom: p.nom.trim(),
        dlcJours: Math.max(0, Number(p.dlcJours) || 1),
        conservation: p.conservation.trim() || "0 / +4 °C",
      }));

    if (!propres.length) {
      return setErreur("Ajoute au moins un produit dans le catalogue.");
    }

    setEnvoi(true);
    const sb = getSupabaseClient()!;
    const { error } = await sb.from("haccp_config").upsert(
      {
        etablissement_id: etablissementId,
        cle: "produits_dlc",
        data: propres,
      },
      { onConflict: "etablissement_id,cle" },
    );
    setEnvoi(false);

    if (error) {
      return setErreur("Enregistrement refusé : réservé aux responsables.");
    }

    onClose();
    onSaved("Catalogue des produits et DLC enregistré");
  }

  const produitsFiltres = liste.filter((p) => p.categorieId === catFiltre);

  return (
    <Modal
      titre="Paramètres des produits & DLC"
      sousTitre="Configure la liste des produits par catégorie et leur durée de conservation légale"
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </>
      }
    >
      {/* Onglets de catégories pour filtrer la liste */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
        {CATEGORIES_DLC.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip ${catFiltre === c.id ? "on" : ""}`}
            style={{ fontSize: 11, whiteSpace: "nowrap" }}
            onClick={() => setCatFiltre(c.id)}
          >
            {c.icone} {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="hint" style={{ fontSize: 12 }}>
          {produitsFiltres.length} produit(s) dans cette catégorie
        </span>
        <button type="button" className="btn btn-sm" onClick={ajouter}>
          + Ajouter un produit
        </button>
      </div>

      <div className="equip-list" style={{ maxHeight: "45vh" }}>
        {produitsFiltres.map((p) => (
          <div key={p.id} className="dlc-config-row">
            <input
              value={p.nom}
              onChange={(e) => maj(p.id, { nom: e.target.value })}
              placeholder="Nom du produit"
              aria-label="Nom du produit"
              style={{ flex: "1 1 180px", height: 36, borderRadius: 8, border: "1px solid var(--line)", padding: "0 8px" }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="hint" style={{ fontSize: 11, whiteSpace: "nowrap" }}>DLC : J+</span>
              <input
                type="number"
                min={0}
                max={365}
                value={p.dlcJours}
                onChange={(e) => maj(p.id, { dlcJours: Number(e.target.value) })}
                style={{ width: 50, height: 36, textAlign: "center", borderRadius: 8, border: "1px solid var(--line)" }}
                title="Nombre de jours avant péremption"
              />
            </div>

            <input
              value={p.conservation}
              onChange={(e) => maj(p.id, { conservation: e.target.value })}
              placeholder="Conservation (ex: 0 / +4 °C)"
              aria-label="Condition de conservation"
              style={{ width: 110, height: 36, borderRadius: 8, border: "1px solid var(--line)", padding: "0 6px", fontSize: 12 }}
            />

            <button
              type="button"
              className="icon-btn"
              onClick={() => setListe((l) => l.filter((x) => x.id !== p.id))}
              aria-label="Supprimer ce produit"
              title="Supprimer"
            >
              ✕
            </button>
          </div>
        ))}
        {!produitsFiltres.length && (
          <div className="empty" style={{ padding: 18, textAlign: "center" }}>
            Aucun produit dans cette catégorie. Clique sur &quot;+ Ajouter un produit&quot; pour en créer.
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 12 }}>
        💡 <b>Règle HACCP :</b> la durée de DLC paramétrée ici sert de plafond légal. En cuisine, l’opérateur ne peut modifier la date qu’à la baisse (date plus courte).
      </p>

      {erreur && (
        <div className="error" role="alert" style={{ marginTop: 10 }}>
          {erreur}
        </div>
      )}
    </Modal>
  );
}
