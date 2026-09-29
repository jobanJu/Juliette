// HACCP : règles, types et calculs. Module autonome : aucun lien avec le stock ni les achats.
//
// Formats stockés (colonne jsonb `data` de haccp_enregistrements) :
//   temperature     { equipement_id, equipement, valeur, min, max, conforme, action? }
//   nettoyage       { tache_id, element, zone, frequence, periode, remarque? }
//   refroidissement { produit, debut_at, temp_debut, fin_at?, temp_fin?, conforme?, action? }
//   tracabilite     { produit, lot, fabrique_le, dlc, jours, quantite?, conservation? }   (étiquette DLC)
//                   { origine: "photo", produit, lot, dlc, photo }                         (étiquette fournisseur photographiée)
//   production      voir Production ci-dessous (fiche de fabrication, complétée au fil de la journée)

import { iso } from "@/lib/planning";

export type TypeEnregistrement = "temperature" | "nettoyage" | "refroidissement" | "tracabilite" | "production" | "huile" | "cuisson";

export type Enregistrement<D = Record<string, unknown>> = {
  id: string;
  type: TypeEnregistrement;
  data: D;
  compte_id: string | null;
  auteur: string;
  created_at: string;
  updated_at: string;
};

export type Equipement = { id: string; nom: string; type: "positif" | "negatif" | "chaud"; min: number; max: number };

export type Tache = {
  id: string;
  zone: string;
  element: string;
  methode: string;
  frequence: "quotidien" | "hebdomadaire" | "mensuel";
  moment?: "ouverture" | "service" | "fermeture";
  /** Nombre de passages par période (ex. poignées de porte : 2 fois par jour). */
  fois?: number;
  /** Jours concernés (0 = dimanche … 6 = samedi) ; absent = tous les jours. */
  jours?: number[];
  /** Heure limite « HH:MM » : au-delà, la tâche non faite passe en alerte. */
  heure?: string;
};

export type Temperature = { equipement_id: string; equipement: string; valeur: number; min: number; max: number; conforme: boolean; action?: string };
export type Nettoyage = { tache_id: string; element: string; zone: string; frequence: Tache["frequence"]; periode: string; remarque?: string; non_fait?: boolean };
export type Refroidissement = { produit: string; quantite?: string; debut_at: string; temp_debut: number; fin_at?: string; temp_fin?: number; conforme?: boolean; action?: string };
export type Etiquette = { produit: string; lot: string; fabrique_le: string; dlc: string; jours: number; quantite?: string; conservation?: string; categorie?: string };

/** Traçabilité par photo : l'étiquette du produit reçu ou entamé, et ce qu'on en relève. */
export type TracePhoto = { origine: "photo"; produit: string; lot: string; dlc: string; photo: string };
export type TracabiliteConfig = { produit: boolean; lot: boolean; dlc: boolean };
export const TRACABILITE_DEFAUT: TracabiliteConfig = { produit: true, lot: true, dlc: true };

export const estTracePhoto = (d: unknown): d is TracePhoto => (d as TracePhoto)?.origine === "photo";

/** Huiles de friture : contrôles, filtrations, changements et collectes par le prestataire. */
export type Friteuse = { id: string; nom: string; capacite_l?: number };
export type Prestataire = { nom: string; contact?: string; telephone?: string; email?: string; adresse?: string; frequence?: string; note?: string };
export type HuilesConfig = { friteuses: Friteuse[]; seuil_polaires: number; prestataire: Prestataire };
export type ActionHuile = "controle" | "filtration" | "changement" | "collecte";
export type Huile = { friteuse_id?: string; friteuse?: string; action: ActionHuile; polaires?: number; temperature?: number; conforme?: boolean; litres?: number; bordereau?: string; remarque?: string };

/** Réglementation : une huile de friture est à changer dès 25 % de composés polaires. */
export const SEUIL_POLAIRES = 25;
export const TEMP_FRITURE_MAX = 180;
export const HUILES_DEFAUT: HuilesConfig = { friteuses: [], seuil_polaires: SEUIL_POLAIRES, prestataire: { nom: "" } };
export const ACTIONS_HUILE: Record<ActionHuile, { label: string; icone: string }> = {
  controle: { label: "Contrôle", icone: "🧪" },
  filtration: { label: "Filtration", icone: "⏚" },
  changement: { label: "Changement d'huile", icone: "♻" },
  collecte: { label: "Collecte prestataire", icone: "🚚" },
};

export function huileConforme(polaires: number | undefined, temperature: number | undefined, seuil: number) {
  if (polaires == null && temperature == null) return undefined;
  return (polaires == null || polaires < seuil) && (temperature == null || temperature <= TEMP_FRITURE_MAX);
}

/** Points de cuisson : température à cœur minimale par catégorie de produit (réglable). */
export type CategorieCuisson = { id: string; nom: string; seuil: number };
export type Cuisson = { produit: string; categorie: string; seuil: number; valeur: number; conforme: boolean; action?: string };
export const CUISSON_DEFAUT: CategorieCuisson[] = [
  { id: "volaille", nom: "Volaille", seuil: 74 },
  { id: "hache", nom: "Viande hachée / steak haché", seuil: 70 },
  { id: "porc", nom: "Porc", seuil: 70 },
  { id: "poisson", nom: "Poisson", seuil: 63 },
  { id: "oeufs", nom: "Préparation à base d'œufs", seuil: 70 },
  { id: "rechauffe", nom: "Plat remis en température", seuil: 63 },
];

/** Rubriques HACCP que l'établissement peut masquer (la vue du jour et le registre restent). */
export const RUBRIQUES_HACCP = [
  { cle: "temperatures", label: "Températures" },
  { cle: "tracabilite", label: "Traçabilité" },
  { cle: "etiquettes", label: "Étiquettes DLC" },
  { cle: "nettoyage", label: "Plan de nettoyage" },
  { cle: "refroidissement", label: "Refroidissement" },
  { cle: "cuisson", label: "Points de cuisson" },
  { cle: "huiles", label: "Huiles de friture" },
  { cle: "suivi-production", label: "Suivi production" },
] as const;

/** Fiche de fabrication (suivi de production). */
export type LigneProduction = { produit: string; quantite: string; lot: string; dlc: string; photo?: string };
export type Etape = { debut_at?: string; temp_debut?: number; fin_at?: string; temp_fin?: number };
export type Production = {
  fiche_id?: string;
  recette: string;
  lot: string;
  volume_cru?: number;
  volume_cuit?: number;
  unite: string;
  lignes: LigneProduction[];
  cuisson: Etape;
  refroidissement: Etape & { procede?: string };
  conservation?: string;
  conservation_detail?: Record<string, string>;
  dlc?: string;
  photo?: string;
  remarque?: string;
  cloture_at?: string;
};

export const PROCEDES_REFROIDISSEMENT = ["Cellule de refroidissement", "Bain d'eau glacée", "Chambre froide (petites portions)", "Sans refroidissement (servi chaud)"];

/** Selon le mode de conservation, la fiche demande des lignes en plus. */
export const CONSERVATIONS: Record<string, { label: string; champs: { cle: string; label: string; type: "text" | "number" | "date" }[] }> = {
  refrigere: { label: "Réfrigéré (0 / +3 °C)", champs: [] },
  sous_vide: { label: "Sous vide", champs: [{ cle: "soudure", label: "Contrôle soudure (OK / à refaire)", type: "text" }] },
  pasteurise: {
    label: "Pasteurisé",
    champs: [
      { cle: "temp_pasteurisation", label: "Température à cœur (°C)", type: "number" },
      { cle: "duree_pasteurisation", label: "Durée (min)", type: "number" },
    ],
  },
  conserve: {
    label: "Conserve / bocal stérilisé",
    champs: [
      { cle: "temp_sterilisation", label: "Température de stérilisation (°C)", type: "number" },
      { cle: "duree_sterilisation", label: "Durée (min)", type: "number" },
      { cle: "nb_bocaux", label: "Nombre de bocaux", type: "number" },
    ],
  },
  congele: { label: "Congelé (−18 °C)", champs: [{ cle: "date_congelation", label: "Date de congélation", type: "date" }] },
  chaud: { label: "Maintien au chaud (≥ 63 °C)", champs: [{ cle: "temp_maintien", label: "Température de maintien (°C)", type: "number" }] },
};

export function rendement(p: Pick<Production, "volume_cru" | "volume_cuit">) {
  if (!p.volume_cru || !p.volume_cuit) return null;
  return Math.round((p.volume_cuit / p.volume_cru) * 100);
}

/** Refroidissement d'une production : même règle que les refroidissements (≤ +10 °C en 2 h). */
export function etapeRefroidissementConforme(e: Etape) {
  if (!e.debut_at || !e.fin_at || e.temp_fin == null) return null;
  const duree = (new Date(e.fin_at).getTime() - new Date(e.debut_at).getTime()) / 60000;
  return e.temp_fin <= REFROID_TEMP_FIN && duree <= REFROID_DUREE_MAX_MIN;
}

/** Réduit une photo (JPEG, `cote` px max) avant envoi : une étiquette reste lisible à 1280 px. */
export function reduirePhoto(fichier: File, cote = 1280): Promise<Blob> {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onerror = () => ko(new Error("Image illisible"));
    img.onload = () => {
      const r = Math.min(1, cote / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? ok(b) : ko(new Error("Image illisible"))), "image/jpeg", 0.82);
    };
    img.src = url;
  });
}

export const COLONNES_ENREG = "id, type, data, compte_id, auteur, created_at, updated_at";

export const EQUIPEMENTS_TYPES: Record<Equipement["type"], { label: string; min: number; max: number; icone: string }> = {
  positif: { label: "Froid positif", min: 0, max: 4, icone: "❄" },
  negatif: { label: "Froid négatif", min: -25, max: -18, icone: "✱" },
  chaud: { label: "Maintien au chaud", min: 63, max: 90, icone: "♨" },
};

export const EQUIPEMENTS_SUGGERES: Omit<Equipement, "id">[] = [
  { nom: "Chambre froide positive", type: "positif", min: 0, max: 3 },
  { nom: "Frigo préparation", type: "positif", min: 0, max: 4 },
  { nom: "Chambre froide négative", type: "negatif", min: -25, max: -18 },
  { nom: "Vitrine réfrigérée", type: "positif", min: 0, max: 4 },
];

/** Deux relevés par jour et par équipement : à l'ouverture et avant la fermeture. */
export const CRENEAUX_RELEVE = [
  { cle: "matin", label: "Matin", avant: 15 },
  { cle: "soir", label: "Soir", avant: 24 },
] as const;

export function creneauReleve(quand: string | Date) {
  const h = new Date(quand).getHours();
  return h < 15 ? "matin" : "soir";
}

export function estConforme(valeur: number, e: Pick<Equipement, "min" | "max">) {
  return valeur >= e.min && valeur <= e.max;
}

// Refroidissement rapide : de +63 °C à moins de +10 °C à cœur en 2 h maximum.
export const REFROID_TEMP_FIN = 10;
export const REFROID_DUREE_MAX_MIN = 120;

export function refroidissementConforme(r: Refroidissement) {
  if (r.fin_at == null || r.temp_fin == null) return null;
  const duree = (new Date(r.fin_at).getTime() - new Date(r.debut_at).getTime()) / 60000;
  return r.temp_fin <= REFROID_TEMP_FIN && duree <= REFROID_DUREE_MAX_MIN;
}

/** Identifiant de la période en cours pour une fréquence : jour, semaine ISO ou mois. */
export function periodeDe(frequence: Tache["frequence"], d = new Date()) {
  if (frequence === "quotidien") return iso(d);
  if (frequence === "mensuel") return iso(d).slice(0, 7);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const an = t.getUTCFullYear();
  const semaine = Math.ceil(((t.getTime() - Date.UTC(an, 0, 1)) / 864e5 + 1) / 7);
  return `${an}-S${String(semaine).padStart(2, "0")}`;
}

export const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/** La tâche est-elle prévue ce jour-là ? (les jours ne filtrent que les tâches quotidiennes) */
export function prevueLe(t: Tache, d = new Date()) {
  return t.frequence !== "quotidien" || !t.jours?.length || t.jours.includes(d.getDay());
}

/** Périodes à cocher pour une tâche : une par passage (« 2026-09-29 », « 2026-09-29#2 »…). */
export function passages(t: Tache, d = new Date()) {
  if (!prevueLe(t, d)) return [];
  const base = periodeDe(t.frequence, d);
  return Array.from({ length: Math.max(1, t.fois ?? 1) }, (_, i) => (i === 0 ? base : `${base}#${i + 1}`));
}

/** Heure limite dépassée sans que tout soit fait (seulement pour les tâches du jour). */
export function enRetard(t: Tache, restants: number, d = new Date()) {
  if (!t.heure || !restants || t.frequence !== "quotidien") return false;
  const [h, m] = t.heure.split(":").map(Number);
  return d.getHours() * 60 + d.getMinutes() > h * 60 + m;
}

export function libelleRythme(t: Tache) {
  const fois = (t.fois ?? 1) > 1 ? `${t.fois} fois ` : "";
  const periode = { quotidien: "par jour", hebdomadaire: "par semaine", mensuel: "par mois" }[t.frequence];
  const jours = t.frequence === "quotidien" && t.jours?.length && t.jours.length < 7 ? ` · ${t.jours.map((j) => JOURS_COURTS[j]).join(", ")}` : "";
  return `${fois || "1 fois "}${periode}${jours}${t.heure ? ` · avant ${t.heure.replace(":", "h")}` : ""}`;
}

export const FREQUENCES: Record<Tache["frequence"], { label: string; periode: string }> = {
  quotidien: { label: "Chaque jour", periode: "aujourd'hui" },
  hebdomadaire: { label: "Chaque semaine", periode: "cette semaine" },
  mensuel: { label: "Chaque mois", periode: "ce mois-ci" },
};

export const MOMENTS: Record<string, string> = { ouverture: "Ouverture", service: "Après le service", fermeture: "Fermeture" };

/** Numéro de lot lisible : date + heure + initiales, unique en pratique pour une cuisine. */
export function numeroLot(initiales: string, d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${initiales.toUpperCase()}`;
}

export const DLC_RAPIDES = [1, 2, 3, 5, 7];

export function joursRestants(dlc: string, aujourdhui = iso(new Date())) {
  const [a, b] = [aujourdhui, dlc].map((s) => new Date(s + "T00:00").getTime());
  return Math.round((b - a) / 864e5);
}

export const nouvelId = () => Math.random().toString(36).slice(2, 10);

export const formatTemp = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} °C`;

export const CATEGORIES_DLC = [
  { id: "surgele", label: "PRODUIT SURGELÉ", icone: "🧊", dlcDefautJours: 30, conservation: "−18 °C" },
  { id: "decongele", label: "PRODUIT DÉCONGELÉ", icone: "🐟", dlcDefautJours: 1, conservation: "0 / +3 °C" },
  { id: "sec_entame", label: "PRODUIT SEC ENTAMÉ", icone: "🌾", dlcDefautJours: 30, conservation: "Ambiant" },
  { id: "legume_decontamine", label: "LÉGUME DÉCONTAMINÉ", icone: "🥗", dlcDefautJours: 1, conservation: "0 / +4 °C" },
  { id: "frais_ouvert", label: "PRODUIT FRAIS OUVERT", icone: "🥛", dlcDefautJours: 3, conservation: "0 / +4 °C" },
  { id: "viande_sous_vide", label: "VIANDE SOUS VIDE OUVERTE", icone: "🥩", dlcDefautJours: 2, conservation: "0 / +2 °C" },
] as const;

export type CategorieDlcId = (typeof CATEGORIES_DLC)[number]["id"];

export type ProduitDlcConfig = {
  id: string;
  categorieId: CategorieDlcId;
  nom: string;
  dlcJours: number;
  conservation: string;
};

export const PRODUITS_DLC_DEFAUT: ProduitDlcConfig[] = [
  // Surgelés
  { id: "s-1", categorieId: "surgele", nom: "Pain / Viennoiseries surgelées", dlcJours: 30, conservation: "−18 °C" },
  { id: "s-2", categorieId: "surgele", nom: "Légumes portionnés surgelés", dlcJours: 30, conservation: "−18 °C" },
  { id: "s-3", categorieId: "surgele", nom: "Frites & Pommes de terre", dlcJours: 30, conservation: "−18 °C" },
  { id: "s-4", categorieId: "surgele", nom: "Glace / Sorbet entamé", dlcJours: 14, conservation: "−18 °C" },
  // Décongelés
  { id: "d-1", categorieId: "decongele", nom: "Poisson blanc décongelé", dlcJours: 1, conservation: "0 / +2 °C" },
  { id: "d-2", categorieId: "decongele", nom: "Saumon décongelé", dlcJours: 1, conservation: "0 / +2 °C" },
  { id: "d-3", categorieId: "decongele", nom: "Pièce de viande décongelée", dlcJours: 1, conservation: "0 / +2 °C" },
  { id: "d-4", categorieId: "decongele", nom: "Pâtisserie / Dessert décongelé", dlcJours: 1, conservation: "0 / +4 °C" },
  { id: "d-5", categorieId: "decongele", nom: "Pain décongelé", dlcJours: 1, conservation: "Ambiant" },
  // Secs entamés
  { id: "se-1", categorieId: "sec_entame", nom: "Farine entamée", dlcJours: 60, conservation: "Ambiant" },
  { id: "se-2", categorieId: "sec_entame", nom: "Riz / Pâtes entamé", dlcJours: 60, conservation: "Ambiant" },
  { id: "se-3", categorieId: "sec_entame", nom: "Épices & aromates entamés", dlcJours: 90, conservation: "Ambiant" },
  { id: "se-4", categorieId: "sec_entame", nom: "Fruits secs / Graines", dlcJours: 30, conservation: "Ambiant" },
  { id: "se-5", categorieId: "sec_entame", nom: "Sucre / Chocolat", dlcJours: 90, conservation: "Ambiant" },
  // Légumes décontaminés
  { id: "ld-1", categorieId: "legume_decontamine", nom: "Salade lavée & décontaminée", dlcJours: 1, conservation: "0 / +4 °C" },
  { id: "ld-2", categorieId: "legume_decontamine", nom: "Tomates lavées & coupées", dlcJours: 1, conservation: "0 / +4 °C" },
  { id: "ld-3", categorieId: "legume_decontamine", nom: "Oignons émincés", dlcJours: 1, conservation: "0 / +4 °C" },
  { id: "ld-4", categorieId: "legume_decontamine", nom: "Herbes fraîches lavées", dlcJours: 2, conservation: "0 / +4 °C" },
  { id: "ld-5", categorieId: "legume_decontamine", nom: "Carottes / Concombres râpés", dlcJours: 1, conservation: "0 / +4 °C" },
  // Frais ouverts
  { id: "fo-1", categorieId: "frais_ouvert", nom: "Crème fraîche ouverte", dlcJours: 3, conservation: "0 / +4 °C" },
  { id: "fo-2", categorieId: "frais_ouvert", nom: "Lait ouvert", dlcJours: 3, conservation: "0 / +4 °C" },
  { id: "fo-3", categorieId: "frais_ouvert", nom: "Fromage râpé ouvert", dlcJours: 3, conservation: "0 / +4 °C" },
  { id: "fo-4", categorieId: "frais_ouvert", nom: "Sauce maison / vinaigrette", dlcJours: 3, conservation: "0 / +4 °C" },
  { id: "fo-5", categorieId: "frais_ouvert", nom: "Beurre / Matière grasse", dlcJours: 7, conservation: "0 / +4 °C" },
  // Viandes sous vide ouvertes
  { id: "v-1", categorieId: "viande_sous_vide", nom: "Pièce de bœuf ouverte", dlcJours: 2, conservation: "0 / +2 °C" },
  { id: "v-2", categorieId: "viande_sous_vide", nom: "Filet de poulet ouvert", dlcJours: 1, conservation: "0 / +2 °C" },
  { id: "v-3", categorieId: "viande_sous_vide", nom: "Magret de canard ouvert", dlcJours: 2, conservation: "0 / +2 °C" },
  { id: "v-4", categorieId: "viande_sous_vide", nom: "Viande hachée préparée", dlcJours: 1, conservation: "0 / +2 °C" },
  { id: "v-5", categorieId: "viande_sous_vide", nom: "Charcuterie découpe", dlcJours: 2, conservation: "0 / +3 °C" },
];
