// RH & congés : types, libellés et calculs de durée. Aucun accès réseau ici.

import { ajouterJours, depuisIso } from "@/lib/planning";

export type Demande = {
  id: string;
  compte_id: string;
  type: "conge" | "acompte";
  date_debut: string;
  date_fin: string;
  motif: string | null;
  motif_detail: string | null;
  montant: number | null;
  statut: "en_attente" | "validee" | "refusee";
  decide_par: string | null;
  decide_at: string | null;
  created_at: string;
};

export const COLONNES_DEMANDE = "id, compte_id, type, date_debut, date_fin, motif, motif_detail, montant, statut, decide_par, decide_at, created_at";

export const MOTIFS: Record<string, { label: string; couleur: string }> = {
  conge_paye: { label: "Congé payé", couleur: "#e9c46a" },
  recuperation: { label: "Récupération / RTT", couleur: "#7fb7d6" },
  conge_sans_solde: { label: "Congé sans solde", couleur: "#b6a6e0" },
  maladie: { label: "Arrêt maladie", couleur: "#e58f86" },
  autre: { label: "Autre", couleur: "#b8b3c2" },
};

export const STATUT_DEMANDE: Record<Demande["statut"], { label: string; ton: string }> = {
  en_attente: { label: "En attente", ton: "t-yellow" },
  validee: { label: "Validée", ton: "t-mint" },
  refusee: { label: "Refusée", ton: "t-red" },
};

/** Délai au-delà duquel un congé sans réponse est validé automatiquement (règle appliquée par la base). */
export const DELAI_TACITE_JOURS = 5;

export function nbJours(debut: string, fin: string) {
  return Math.round((depuisIso(fin).getTime() - depuisIso(debut).getTime()) / 864e5) + 1;
}

/** Jours ouvrables (lundi → samedi), la référence habituelle des congés payés en restauration. */
export function joursOuvrables(debut: string, fin: string) {
  let n = 0;
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) if (depuisIso(j).getDay() !== 0) n++;
  return n;
}

export function joursAvantValidationTacite(d: Demande, maintenant = Date.now()) {
  if (d.statut !== "en_attente" || d.type !== "conge") return null;
  return Math.max(0, Math.ceil((new Date(d.created_at).getTime() + DELAI_TACITE_JOURS * 864e5 - maintenant) / 864e5));
}

export function chevauche(a: { date_debut: string; date_fin: string }, debut: string, fin: string) {
  return a.date_debut <= fin && a.date_fin >= debut;
}

export function periode(d: { date_debut: string; date_fin: string }) {
  const f = (s: string, annee: boolean) => depuisIso(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(annee ? { year: "numeric" } : {}) });
  if (d.date_debut === d.date_fin) return `le ${f(d.date_debut, true)}`;
  return `du ${f(d.date_debut, false)} au ${f(d.date_fin, true)}`;
}

export const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
