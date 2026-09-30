// Import du catalogue depuis un tableur : reconnaissance des colonnes, nettoyage des valeurs,
// classement automatique et détection des produits déjà connus. Aucun accès réseau ici.
import { devinerCategorie, lireFamille, lireSousCategorie } from "@/lib/categories";
import type { Famille } from "@/lib/categories";

export type Champ = "nom" | "unite" | "famille" | "sous_categorie" | "fournisseur" | "reference_fournisseur" | "conditionnement" | "prix_unitaire" | "seuil" | "niveau_cible";

export const CHAMPS: Record<Champ, { label: string; synonymes: string[] }> = {
  nom: { label: "Nom du produit", synonymes: ["nom", "designation", "libelle", "article", "produit", "intitule", "description", "nom du produit", "nom produit"] },
  unite: { label: "Unité", synonymes: ["unite", "unites", "u", "uv", "unite de stock", "unite de vente", "unit"] },
  famille: { label: "Famille", synonymes: ["famille", "categorie", "rayon", "conservation", "type", "stockage"] },
  sous_categorie: { label: "Sous-catégorie", synonymes: ["sous-categorie", "sous categorie", "sous-famille", "sous famille", "sous-rayon", "sous rayon"] },
  fournisseur: { label: "Fournisseur", synonymes: ["fournisseur", "fournisseurs", "grossiste", "supplier", "distributeur"] },
  reference_fournisseur: { label: "Référence", synonymes: ["reference", "ref", "ref.", "code", "code article", "ean", "sku", "reference fournisseur", "code produit"] },
  conditionnement: { label: "Conditionnement", synonymes: ["conditionnement", "colisage", "colis", "format", "pack", "contenance"] },
  prix_unitaire: { label: "Prix HT", synonymes: ["prix", "prix ht", "pu", "pu ht", "tarif", "prix unitaire", "prix unitaire ht", "cout", "prix d'achat", "prix achat"] },
  seuil: { label: "Seuil d'alerte", synonymes: ["seuil", "stock mini", "stock minimum", "minimum", "alerte", "seuil d'alerte"] },
  niveau_cible: { label: "Niveau cible", synonymes: ["cible", "niveau cible", "stock maxi", "stock maximum", "maximum", "stock cible"] },
};

export const ORDRE_CHAMPS = Object.keys(CHAMPS) as Champ[];

export type Correspondance = Partial<Record<Champ, number>>;

export type LigneImport = {
  ligne: number;
  nom: string;
  unite: string;
  famille: Famille | null;
  sous_categorie: string | null;
  fournisseur: string | null;
  reference_fournisseur: string | null;
  conditionnement: string | null;
  prix_unitaire: number | null;
  seuil: number | null;
  niveau_cible: number | null;
  devine: boolean;
  existant: string | null;
  erreur: string | null;
};

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const texte = (v: unknown) => {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleDateString("fr-FR");
  return String(v).trim();
};

/** « 12,50 € » → 12.5 ; vide ou illisible → null. */
export function lireNombre(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = texte(v).replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") && t.includes(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const UNITES_CONNUES: [RegExp, string][] = [
  [/^(kg|kgs|kilo|kilos|kilogramme)s?$/, "kg"],
  [/^(g|gr|grs|gramme)s?$/, "g"],
  [/^(l|lt|litre|litres)$/, "L"],
  [/^(cl|centilitre)s?$/, "cl"],
  [/^(ml)$/, "ml"],
  [/^(p|pc|pcs|pce|pces|piece|pieces|u|un|unite|unites|unit|ut)$/, "pièce"],
  [/^(bt|btl|bouteille|bouteilles)$/, "bouteille"],
  [/^(bte|boite|boites)$/, "boîte"],
  [/^(ct|crt|carton|cartons|colis)$/, "carton"],
  [/^(sac|sachet|sachets)$/, "sachet"],
  [/^(bq|barquette|barquettes)$/, "barquette"],
  [/^(botte|bottes)$/, "botte"],
  [/^(portion|portions)$/, "portion"],
  [/^(fut|futs)$/, "fût"],
  [/^(rl|rlx|rouleau|rouleaux)$/, "rouleau"],
];

export function lireUnite(v: unknown): string {
  const t = norm(v).replace(/\.$/, "");
  if (!t) return "pièce";
  for (const [re, u] of UNITES_CONNUES) if (re.test(t)) return u;
  return texte(v);
}

/** Trouve la ligne d'en-tête (dans les 10 premières) et associe chaque champ à une colonne. */
export function detecterColonnes(lignes: unknown[][]): { entete: number; correspondance: Correspondance } {
  let meilleure = { entete: 0, correspondance: {} as Correspondance, score: -1 };
  for (let i = 0; i < Math.min(10, lignes.length); i++) {
    const cellules = (lignes[i] ?? []).map(norm);
    const c: Correspondance = {};
    let score = 0;
    for (const champ of ORDRE_CHAMPS) {
      const syn = CHAMPS[champ].synonymes;
      // Égalité exacte d'abord, puis début de libellé (« Prix HT € » → prix).
      let idx = cellules.findIndex((x, k) => syn.includes(x) && !Object.values(c).includes(k));
      if (idx < 0) idx = cellules.findIndex((x, k) => x && syn.some((s) => s.length > 2 && x.startsWith(s)) && !Object.values(c).includes(k));
      if (idx >= 0) {
        c[champ] = idx;
        score += champ === "nom" ? 3 : 1;
      }
    }
    if (score > meilleure.score) meilleure = { entete: i, correspondance: c, score };
  }
  // Sans en-tête reconnu : la première colonne remplie sert de nom.
  if (meilleure.correspondance.nom === undefined) return { entete: -1, correspondance: { nom: 0 } };
  return { entete: meilleure.entete, correspondance: meilleure.correspondance };
}

export const cleNom = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");

/** Transforme les lignes du tableur en produits prêts à importer. */
export function preparerLignes(lignes: unknown[][], entete: number, c: Correspondance, existants: { id: string; nom: string }[]): LigneImport[] {
  const parNom = new Map(existants.map((p) => [cleNom(p.nom), p.id]));
  const vus = new Set<string>();
  const val = (row: unknown[], champ: Champ) => (c[champ] === undefined ? undefined : row[c[champ]!]);
  const res: LigneImport[] = [];
  lignes.forEach((row, i) => {
    if (i <= entete) return;
    if (!row || row.every((x) => texte(x) === "")) return;
    const nom = texte(val(row, "nom"));
    const familleTexte = texte(val(row, "famille"));
    const sousTexte = texte(val(row, "sous_categorie"));
    let famille = lireFamille(familleTexte);
    let sous: string | null = null;
    let devine = false;
    if (famille) sous = lireSousCategorie(famille, sousTexte);
    if (nom && (!famille || !sous)) {
      const g = devinerCategorie(nom, familleTexte);
      if (!famille && g.famille) {
        famille = g.famille;
        devine = true;
      }
      if (!sous && g.sous_categorie && g.famille === famille) {
        sous = g.sous_categorie;
        devine = true;
      }
    }
    const cle = cleNom(nom);
    const doublon = cle && vus.has(cle);
    if (cle) vus.add(cle);
    const n = (champ: Champ) => {
      const x = lireNombre(val(row, champ));
      return x != null && x >= 0 ? x : null;
    };
    res.push({
      ligne: i + 1,
      nom,
      unite: c.unite === undefined ? "pièce" : lireUnite(val(row, "unite")),
      famille,
      sous_categorie: sous,
      fournisseur: texte(val(row, "fournisseur")) || null,
      reference_fournisseur: texte(val(row, "reference_fournisseur")) || null,
      conditionnement: texte(val(row, "conditionnement")) || null,
      prix_unitaire: n("prix_unitaire"),
      seuil: n("seuil"),
      niveau_cible: n("niveau_cible"),
      devine,
      existant: cle ? (parNom.get(cle) ?? null) : null,
      erreur: !nom ? "Nom manquant" : doublon ? "En double dans le fichier" : null,
    });
  });
  return res;
}

/** Lecture d'un CSV (séparateur « ; », « , » ou tabulation, guillemets gérés). */
export function lireCsv(contenu: string): string[][] {
  const t = contenu.replace(/^﻿/, "");
  const premiere = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, premiere.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (guillemets) {
      if (ch === '"' && t[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (ch === '"') guillemets = false;
      else cellule += ch;
    } else if (ch === '"') guillemets = true;
    else if (ch === sep) {
      ligne.push(cellule);
      cellule = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = "";
    } else cellule += ch;
  }
  if (cellule || ligne.length) {
    ligne.push(cellule);
    lignes.push(ligne);
  }
  return lignes;
}

/** Modèle à remplir, au format CSV lisible par Excel (séparateur « ; », UTF-8 avec BOM). */
export function modeleCsv(): string {
  const lignes = [
    ["Nom", "Unité", "Famille", "Sous-catégorie", "Fournisseur", "Référence", "Conditionnement", "Prix HT", "Seuil d'alerte", "Niveau cible"],
    ["Comté 18 mois", "kg", "Frais", "Fromages", "Fromagerie Martin", "CT18", "Meule 5 kg", "18,90", "2", "6"],
    ["Frites 9 mm", "kg", "Surgelé", "Frites & pommes de terre", "Transgourmet", "FR9", "Carton 4 x 2,5 kg", "1,85", "20", "60"],
    ["Coca-Cola 33 cl", "pièce", "Boissons", "Softs & jus", "Boissons du Nord", "", "Pack de 24", "0,52", "48", "144"],
  ];
  return "﻿" + lignes.map((l) => l.map((x) => (/[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(";")).join("\r\n");
}
