// Salle : carte, tables, bons de commande et réservations. Aucun accès réseau ici.
//
// Un bon (ligne de commandes_salle) suit ce cycle :
//   en_cours (prise de commande) → envoyee (en cuisine : la base décompte le stock)
//   → servi_at (prêt / servi) → terminee (table encaissée) ; ou annulee (le stock est recrédité).
// Une table peut avoir plusieurs bons ouverts : entrées, puis plats, puis desserts…

import { convertir } from "@/lib/fiches";
import type { Fiche } from "@/lib/fiches";
import type { Produit } from "@/lib/stock";

export type ArticleCarte = {
  id: string;
  nom: string;
  categorie: string;
  prix_centimes: number;
  etat_stock: "disponible" | "quantite_limitee" | "rupture";
  composition: string | null;
  ordre: number;
  ingredients: IngredientBon[];
  cout_matiere_centimes: number | null;
};

export type TableSalle = { id: string; nom: string; couverts_max: number; ordre: number; active: boolean };

export type IngredientBon = { nom: string; unite: string; quantite: number; productId: string };
export type LigneBon = { produitId: string; nom: string; quantite: number; prixCentimes: number; ingredients?: IngredientBon[]; note?: string };

export type Bon = {
  id: string;
  table_id: string | null;
  table_nom: string;
  couverts: number;
  lignes: LigneBon[];
  statut: "en_cours" | "envoyee" | "terminee" | "annulee";
  note: string | null;
  cree_par_nom: string;
  created_at: string;
  updated_at: string;
  servi_at: string | null;
  type_commande: "sur_place" | "emporter" | "livraison";
  client_nom: string | null;
  client_telephone: string | null;
  adresse: string | null;
  heure_souhaitee: string | null;
  plateforme: string | null;
  en_livraison_at: string | null;
};

export type Reservation = {
  id: string;
  date: string;
  heure: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  couverts: number;
  table_id: string | null;
  statut: "confirmee" | "arrivee" | "annulee" | "no_show";
  note: string | null;
  source: "telephone" | "sur_place" | "en_ligne" | "autre";
  created_at: string;
};

export type NoteBriefing = { id: string; date: string; categorie: "rupture" | "a_pousser" | "quantite_limitee"; libelle: string; restant: number | null; note: string | null };

export const COLONNES_BON =
  "id, table_id, table_nom, couverts, lignes, statut, note, cree_par_nom, created_at, updated_at, servi_at, type_commande, client_nom, client_telephone, adresse, heure_souhaitee, plateforme, en_livraison_at";

export const PLATEFORMES = ["Direct", "Uber Eats", "Deliveroo", "Just Eat", "Téléphone"];

/** Nom court d'un bon : table, ou client pour l'emporté et la livraison. */
export function libelleBon(b: Pick<Bon, "type_commande" | "table_nom" | "client_nom">) {
  if (b.type_commande === "livraison") return `Livraison · ${b.client_nom ?? "client"}`;
  if (b.type_commande === "emporter") return `À emporter · ${b.client_nom ?? "client"}`;
  return b.table_nom === "Comptoir" ? "Comptoir" : `Table ${b.table_nom}`;
}

/** Étape de suivi d'une commande à emporter ou en livraison. */
export function etapeVente(b: Pick<Bon, "statut" | "servi_at" | "en_livraison_at" | "type_commande">) {
  if (b.statut === "en_cours") return { cle: "brouillon", label: "Brouillon", ton: "t-lav" };
  if (b.statut === "terminee") return { cle: "terminee", label: b.type_commande === "livraison" ? "Livrée" : "Retirée", ton: "t-mint" };
  if (b.statut === "annulee") return { cle: "annulee", label: "Annulée", ton: "t-blue" };
  if (b.en_livraison_at) return { cle: "route", label: "En livraison", ton: "t-blue" };
  if (b.servi_at) return { cle: "prete", label: "Prête", ton: "t-mint" };
  return { cle: "cuisine", label: "En cuisine", ton: "t-peach" };
}
export const COLONNES_RESA = "id, date, heure, nom, telephone, email, couverts, table_id, statut, note, source, created_at";

export const ORDRE_CATEGORIES = ["Entrée", "Plat", "Dessert", "Boisson"];

export const ETAT_CARTE: Record<ArticleCarte["etat_stock"], { label: string; ton: string }> = {
  disponible: { label: "Disponible", ton: "t-mint" },
  quantite_limitee: { label: "Quantité limitée", ton: "t-yellow" },
  rupture: { label: "Rupture", ton: "t-red" },
};

export const STATUT_RESA: Record<Reservation["statut"], { label: string; ton: string }> = {
  confirmee: { label: "Confirmée", ton: "t-lav" },
  arrivee: { label: "Arrivée", ton: "t-mint" },
  annulee: { label: "Annulée", ton: "t-blue" },
  no_show: { label: "Pas venue", ton: "t-red" },
};

export const BRIEFING: Record<NoteBriefing["categorie"], { label: string; ton: string }> = {
  rupture: { label: "Rupture", ton: "t-red" },
  quantite_limitee: { label: "Quantité limitée", ton: "t-yellow" },
  a_pousser: { label: "À pousser", ton: "t-mint" },
};

export const euros = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Fiche technique d'un article de la carte : même nom (accents et ponctuation ignorés). */
export function ficheDe(article: Pick<ArticleCarte, "nom">, fiches: Fiche[]) {
  const n = normaliser(article.nom);
  return fiches.find((f) => normaliser(f.nom) === n);
}

/**
 * Ingrédients décomptés du stock pour UNE portion d'un article : ceux de sa fiche technique
 * (reliés au catalogue, convertis dans l'unité du produit), sinon ceux saisis sur la carte.
 */
export function ingredientsPortion(article: ArticleCarte, fiches: Fiche[], produits: Map<string, Produit>): IngredientBon[] {
  const fiche = ficheDe(article, fiches);
  if (fiche) {
    const portions = Number(fiche.portions) > 0 ? Number(fiche.portions) : 1;
    const res: IngredientBon[] = [];
    for (const ing of fiche.ingredients ?? []) {
      const p = ing.productId ? produits.get(ing.productId) : undefined;
      if (!p) continue;
      const q = convertir(Number(ing.qty) / portions, ing.unit, p.unite);
      if (q === null || q <= 0) continue;
      res.push({ nom: p.nom, unite: p.unite, quantite: Math.round(q * 10000) / 10000, productId: p.id });
    }
    if (res.length) return res;
  }
  return (article.ingredients ?? []).filter((i) => i.productId && i.quantite > 0);
}

export const totalBon = (b: Pick<Bon, "lignes">) => (b.lignes ?? []).reduce((s, l) => s + l.quantite * l.prixCentimes, 0);

export function trierCategories(a: string, b: string) {
  const i = (c: string) => (ORDRE_CATEGORIES.indexOf(c) === -1 ? 99 : ORDRE_CATEGORIES.indexOf(c));
  return i(a) - i(b) || a.localeCompare(b);
}

export const service = (heure: string) => (heure < "16:00" ? "midi" : "soir");
