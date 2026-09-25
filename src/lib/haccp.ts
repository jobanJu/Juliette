// HACCP : règles, types et calculs. Module autonome : aucun lien avec le stock ni les achats.
//
// Formats stockés (colonne jsonb `data` de haccp_enregistrements) :
//   temperature     { equipement_id, equipement, valeur, min, max, conforme, action? }
//   nettoyage       { tache_id, element, zone, frequence, periode, remarque? }
//   refroidissement { produit, debut_at, temp_debut, fin_at?, temp_fin?, conforme?, action? }
//   tracabilite     { produit, lot, fabrique_le, dlc, jours, quantite?, conservation? }

import { iso } from "@/lib/planning";

export type TypeEnregistrement = "temperature" | "nettoyage" | "refroidissement" | "tracabilite";

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

export type Tache = { id: string; zone: string; element: string; methode: string; frequence: "quotidien" | "hebdomadaire" | "mensuel"; moment?: "ouverture" | "service" | "fermeture" };

export type Temperature = { equipement_id: string; equipement: string; valeur: number; min: number; max: number; conforme: boolean; action?: string };
export type Nettoyage = { tache_id: string; element: string; zone: string; frequence: Tache["frequence"]; periode: string; remarque?: string };
export type Refroidissement = { produit: string; debut_at: string; temp_debut: number; fin_at?: string; temp_fin?: number; conforme?: boolean; action?: string };
export type Etiquette = { produit: string; lot: string; fabrique_le: string; dlc: string; jours: number; quantite?: string; conservation?: string };

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
