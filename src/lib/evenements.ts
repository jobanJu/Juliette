// Événements autour de l'établissement : types, impact et repères calculés (jours fériés…).

import { ajouterJours, iso } from "@/lib/planning";
import type { NomIcone } from "@/components/Icone";

export type Evenement = {
  id: string;
  nom: string;
  date: string;
  date_fin: string | null;
  lieu: string | null;
  type: string | null;
  sens: "hausse" | "baisse";
  impact: "faible" | "moyen" | "fort" | "exceptionnel";
  note: string | null;
};

export const COLONNES_EVT = "id, nom, date, date_fin, lieu, type, sens, impact, note";

export const TYPES_EVT: Record<string, NomIcone> = {
  Concert: "micro",
  Match: "trophee",
  Marché: "marche",
  Salon: "institution",
  Exposition: "image",
  Festival: "festival",
  Braderie: "emporter",
  "Jour férié": "calendrier",
  Vacances: "vacances",
  Travaux: "travaux",
  Météo: "meteo",
  Privatisation: "vin",
  Autre: "evenement",
};

export const IMPACTS: Record<Evenement["impact"], { label: string; poids: number }> = {
  faible: { label: "Faible", poids: 1 },
  moyen: { label: "Moyen", poids: 2 },
  fort: { label: "Fort", poids: 3 },
  exceptionnel: { label: "Exceptionnel", poids: 4 },
};

/** Estimation indicative de la variation d'affluence, utilisée en Finance. */
export const VARIATION_AFFLUENCE: Record<Evenement["impact"], number> = { faible: 0.05, moyen: 0.15, fort: 0.3, exceptionnel: 0.6 };

/** Dimanche de Pâques (algorithme de Meeus / Jones / Butcher). */
export function paques(annee: number) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(annee, mois - 1, jour));
}

export type Repere = { date: string; date_fin?: string; nom: string; type: string; sens: "hausse" | "baisse"; impact: Evenement["impact"] };

/** Jours fériés français et grands rendez-vous lillois d'une année (non enregistrés : recalculés). */
export function reperes(annee: number): Repere[] {
  const p = paques(annee);
  const f = (date: string, nom: string, impact: Evenement["impact"] = "moyen", sens: "hausse" | "baisse" = "hausse"): Repere => ({ date, nom, type: "Jour férié", sens, impact });
  const d = (m: number, j: number) => iso(new Date(annee, m - 1, j));
  // Braderie de Lille : premier week-end de septembre.
  const sept = new Date(annee, 8, 1);
  const samedi = iso(new Date(annee, 8, 1 + ((6 - sept.getDay() + 7) % 7)));
  const liste: Repere[] = [
    f(d(1, 1), "Jour de l'an", "moyen", "baisse"),
    f(ajouterJours(p, 1), "Lundi de Pâques"),
    f(d(5, 1), "Fête du Travail", "moyen", "baisse"),
    f(d(5, 8), "Victoire 1945"),
    f(ajouterJours(p, 39), "Ascension"),
    f(ajouterJours(p, 50), "Lundi de Pentecôte"),
    f(d(7, 14), "Fête nationale", "fort"),
    f(d(8, 15), "Assomption", "moyen", "baisse"),
    f(d(11, 1), "Toussaint"),
    f(d(11, 11), "Armistice"),
    f(d(12, 25), "Noël", "fort", "baisse"),
    { date: d(2, 14), nom: "Saint-Valentin", type: "Autre", sens: "hausse", impact: "fort" },
    { date: d(12, 31), nom: "Réveillon du Nouvel An", type: "Autre", sens: "hausse", impact: "exceptionnel" },
    { date: samedi, date_fin: ajouterJours(samedi, 1), nom: "Braderie de Lille", type: "Braderie", sens: "hausse", impact: "exceptionnel" },
  ];
  return liste.sort((a, b) => a.date.localeCompare(b.date));
}

export const couvre = (e: { date: string; date_fin?: string | null }, jour: string) => e.date <= jour && (e.date_fin ?? e.date) >= jour;
