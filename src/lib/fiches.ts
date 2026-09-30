// Fiches techniques : types, unités, allergènes et calcul du coût matière. Aucun accès réseau ici.
//
// Format des ingrédients (compatible avec l'ancien site) :
//   { name, qty, unit, rendement?, prixManuel?, productId? }
// - prixManuel est exprimé par kg (masses), par litre (volumes) ou par unité (le reste) ;
// - productId relie l'ingrédient à un produit du stock : son prix vient alors du catalogue ;
// - rendement (%) tient compte des pertes à l'épluchage, à la cuisson… (100 % par défaut).

import type { Produit } from "@/lib/stock";

export type Ingredient = { name: string; qty: number; unit: string; rendement?: number; prixManuel?: number; productId?: string };

export type Fiche = {
  id: string;
  nom: string;
  categorie: string | null;
  format: string | null;
  ingredients: Ingredient[];
  etapes: string[];
  accompagnement: string | null;
  note: string | null;
  images: string[];
  portions: number | null;
  prix_vente_ttc: number | null;
  tva_pct: number | null;
  allergenes: string[];
  created_at: string;
  updated_at: string;
};

export const COLONNES_FICHE = "id, nom, categorie, format, ingredients, etapes, accompagnement, note, images, portions, prix_vente_ttc, tva_pct, allergenes, created_at, updated_at";

/** Les 14 allergènes à déclarer (règlement INCO). */
export const ALLERGENES: Record<string, { label: string }> = {
  gluten: { label: "Gluten" },
  crustaces: { label: "Crustacés" },
  oeufs: { label: "Œufs" },
  poissons: { label: "Poissons" },
  arachides: { label: "Arachides" },
  soja: { label: "Soja" },
  lait: { label: "Lait" },
  fruits_coque: { label: "Fruits à coque" },
  celeri: { label: "Céleri" },
  moutarde: { label: "Moutarde" },
  sesame: { label: "Sésame" },
  sulfites: { label: "Sulfites" },
  lupin: { label: "Lupin" },
  mollusques: { label: "Mollusques" },
};

export const TVA_RESTAURATION = [5.5, 10, 20];

type Famille = { famille: "masse" | "volume" | "autre"; facteur: number; base: string };

/** Ramène une unité à sa famille : facteur vers l'unité de base (kg, L) de la famille. */
export function uniteNormale(u: string): Famille {
  const x = (u ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (["g", "gr", "gramme", "grammes"].includes(x)) return { famille: "masse", facteur: 0.001, base: "kg" };
  if (["kg", "kilo", "kilos", "kilogramme"].includes(x)) return { famille: "masse", facteur: 1, base: "kg" };
  if (["mg"].includes(x)) return { famille: "masse", facteur: 0.000001, base: "kg" };
  if (["l", "litre", "litres"].includes(x)) return { famille: "volume", facteur: 1, base: "L" };
  if (["cl"].includes(x)) return { famille: "volume", facteur: 0.01, base: "L" };
  if (["dl"].includes(x)) return { famille: "volume", facteur: 0.1, base: "L" };
  if (["ml"].includes(x)) return { famille: "volume", facteur: 0.001, base: "L" };
  if (["piece", "pièce", "pieces", "pièces", "pc", "pcs", "u", "unité", "unite"].includes(x)) return { famille: "autre", facteur: 1, base: "pièce" };
  return { famille: "autre", facteur: 1, base: x || "unité" };
}

/** Convertit une quantité d'une unité vers une autre de la même famille ; null si incompatibles. */
export function convertir(qty: number, de: string, vers: string) {
  const a = uniteNormale(de);
  const b = uniteNormale(vers);
  if (a.famille !== b.famille || (a.famille === "autre" && a.base !== b.base)) return null;
  return (qty * a.facteur) / b.facteur;
}

export type CoutIngredient = { cout: number | null; source: "stock" | "manuel" | "aucun"; probleme?: string };

export function coutIngredient(ing: Ingredient, produits: Map<string, Produit>): CoutIngredient {
  const rendement = ing.rendement && ing.rendement > 0 ? ing.rendement / 100 : 1;
  const p = ing.productId ? produits.get(ing.productId) : undefined;
  if (p && p.prix_unitaire != null) {
    const q = convertir(Number(ing.qty) || 0, ing.unit, p.unite);
    if (q === null) return { cout: null, source: "stock", probleme: `unité « ${ing.unit} » incompatible avec « ${p.unite} » du stock` };
    return { cout: (q * Number(p.prix_unitaire)) / rendement, source: "stock" };
  }
  if (ing.prixManuel != null && ing.prixManuel !== 0) {
    const f = uniteNormale(ing.unit);
    return { cout: ((Number(ing.qty) || 0) * f.facteur * Number(ing.prixManuel)) / rendement, source: "manuel" };
  }
  if (ing.prixManuel === 0) return { cout: 0, source: "manuel" };
  return { cout: null, source: "aucun", probleme: p ? "produit du stock sans prix" : "prix non renseigné" };
}

export type Couts = { total: number; parPortion: number; complet: boolean; prixHT: number | null; ratio: number | null; marge: number | null; coefficient: number | null };

export function coutsFiche(f: Pick<Fiche, "ingredients" | "portions" | "prix_vente_ttc" | "tva_pct">, produits: Map<string, Produit>): Couts {
  let total = 0;
  let complet = true;
  for (const ing of f.ingredients ?? []) {
    const c = coutIngredient(ing, produits);
    if (c.cout === null) complet = false;
    else total += c.cout;
  }
  const portions = f.portions && f.portions > 0 ? Number(f.portions) : 1;
  const parPortion = total / portions;
  const prixHT = f.prix_vente_ttc ? Number(f.prix_vente_ttc) / (1 + Number(f.tva_pct ?? 10) / 100) : null;
  return {
    total,
    parPortion,
    complet,
    prixHT,
    ratio: prixHT ? (parPortion / prixHT) * 100 : null,
    marge: prixHT !== null ? prixHT - parPortion : null,
    coefficient: prixHT && parPortion > 0 ? prixHT / parPortion : null,
  };
}

/** Repères usuels en restauration : ratio matière visé autour de 25–30 %. */
export function tonRatio(r: number | null) {
  if (r === null) return "t-lav";
  return r <= 28 ? "t-mint" : r <= 35 ? "t-yellow" : "t-red";
}

export const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const qte = (n: number) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/**
 * Calculateur « avec ce qu'il me reste » : pour chaque ingrédient dont on indique la quantité
 * disponible, combien de recettes il permet ; le plus rare fixe le maximum faisable.
 * `dispo` : quantité disponible exprimée dans l'unité `unite` (convertie vers celle de la recette).
 */
export function analyserRestes(
  ingredients: Ingredient[],
  dispo: Record<number, { valeur: number; unite: string } | undefined>,
  portionsBase: number,
  portionsEntieres: boolean,
) {
  const lignes = ingredients.map((ing, k) => {
    const d = dispo[k];
    const q = Number(ing.qty);
    const enUniteRecette = d && Number.isFinite(d.valeur) && q > 0 ? convertir(d.valeur, d.unite, ing.unit) : null;
    return { ing, k, dispoRecette: enUniteRecette, recettes: enUniteRecette !== null ? enUniteRecette / q : null };
  });
  const renseignes = lignes.filter((l) => l.recettes !== null);
  const limitant = renseignes.length ? renseignes.reduce((a, b) => (b.recettes! < a.recettes! ? b : a)) : null;
  let maxRecettes = limitant ? limitant.recettes! : null;
  if (maxRecettes !== null && portionsEntieres) maxRecettes = Math.floor(maxRecettes * portionsBase + 1e-9) / portionsBase;
  return { lignes, renseignes, limitant, maxRecettes };
}

/** Ce qui manque pour appliquer un facteur donné, vu les quantités disponibles. */
export function manquesPour(lignes: ReturnType<typeof analyserRestes>["lignes"], facteur: number) {
  return lignes
    .filter((l) => l.dispoRecette !== null && Number(l.ing.qty) * facteur > l.dispoRecette + 1e-9)
    .map((l) => ({ ing: l.ing, manque: Number(l.ing.qty) * facteur - l.dispoRecette! }));
}
