"use client";

import { useMemo, useState } from "react";
import { ETAT_CARTE, euros, trierCategories } from "@/lib/salle";
import type { ArticleCarte } from "@/lib/salle";
import Icone from "@/components/Icone";

/** Sélection d'articles de la carte, par catégorie ou par recherche. */
export default function CartePicker({ carte, onAjouter }: { carte: ArticleCarte[]; onAjouter: (a: ArticleCarte) => void }) {
  const [categorie, setCategorie] = useState("");
  const [recherche, setRecherche] = useState("");
  const categories = useMemo(() => [...new Set(carte.map((a) => a.categorie))].sort(trierCategories), [carte]);
  const catActive = categorie || categories[0] || "";
  const articles = recherche.trim() ? carte.filter((a) => a.nom.toLowerCase().includes(recherche.trim().toLowerCase())) : carte.filter((a) => a.categorie === catActive);

  return (
    <section className="pos-carte">
      <label className="search" style={{ background: "var(--card)" }}>
        <Icone nom="recherche" taille={15} />
        <input placeholder="Chercher un article" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </label>
      {!recherche && (
        <div className="chips">
          {categories.map((c) => (
            <button key={c} className={`chip${c === catActive ? " on" : ""}`} onClick={() => setCategorie(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="pos-grid">
        {articles.map((a) => (
          <button key={a.id} className={`pos-item${a.etat_stock !== "disponible" ? ` pos-${a.etat_stock}` : ""}`} onClick={() => onAjouter(a)} disabled={a.etat_stock === "rupture"}>
            <b>{a.nom}</b>
            <span>{euros(a.prix_centimes)}</span>
            {a.etat_stock !== "disponible" && <small className={`pill ${ETAT_CARTE[a.etat_stock].ton}`}>{ETAT_CARTE[a.etat_stock].label}</small>}
          </button>
        ))}
        {!articles.length && <p className="hint">Aucun article.</p>}
      </div>
    </section>
  );
}

/** Ajoute un article à une liste de lignes (regroupe les articles identiques). */
export function ajouterLigne<L extends { produitId: string; nom: string; quantite: number; prixCentimes: number; note?: string }>(ls: L[], a: ArticleCarte): L[] {
  if (a.etat_stock === "rupture") return ls;
  const i = ls.findIndex((l) => l.produitId === a.id && !l.note);
  if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, quantite: l.quantite + 1 } : l));
  return [...ls, { produitId: a.id, nom: a.nom, quantite: 1, prixCentimes: a.prix_centimes } as L];
}
