// Gestion du personnel : libellés et règles partagées entre l'annuaire, la fiche et l'invitation.
// Les valeurs reprennent exactement les contraintes CHECK de la table comptes.

import type { Compte } from "@/lib/session";

export type Membre = Compte & {
  telephone: string | null;
  date_naissance: string | null;
  fonction: string | null;
  type_contrat: string | null;
  nature_contrat: string | null;
  heures_contrat: number | null;
  date_embauche: string | null;
  date_depart: string | null;
  code_badgeuse: string | null;
  auth_user_id: string | null;
  created_at: string;
};

export const COLONNES_MEMBRE =
  "id, etablissement_id, auth_user_id, prenom, nom, email, role, statut, poste, avatar_url, telephone, date_naissance, fonction, type_contrat, nature_contrat, heures_contrat, date_embauche, date_depart, code_badgeuse, created_at";

export const FONCTIONS: Record<string, string> = {
  directeur: "Directeur",
  directeur_adjoint: "Directeur adjoint",
  manager: "Manager",
  chef_cuisine: "Chef de cuisine",
  second: "Second de cuisine",
  chef_de_partie: "Chef de partie",
  commis: "Commis",
  chef_de_rang: "Chef de rang",
  sommelier: "Sommelier",
  serveur: "Serveur",
  runner: "Runner",
  chef_barman: "Chef barman",
  polyvalent: "Polyvalent",
};

/** Poste de planning le plus probable pour une fonction, proposé par défaut à la création. */
export const POSTE_DE_FONCTION: Record<string, string> = {
  directeur: "management",
  directeur_adjoint: "management",
  manager: "management",
  chef_cuisine: "cuisine",
  second: "cuisine",
  chef_de_partie: "cuisine",
  commis: "cuisine",
  chef_de_rang: "salle",
  sommelier: "salle",
  serveur: "salle",
  runner: "salle",
  chef_barman: "bar",
};

export const NATURES: Record<string, string> = { cdi: "CDI", cdd: "CDD", interim: "Intérim" };

export const TYPES_CONTRAT: Record<string, { label: string; heures: number | null }> = {
  "15h": { label: "15 h", heures: 15 },
  "18h": { label: "18 h", heures: 18 },
  "24h": { label: "24 h", heures: 24 },
  "25h": { label: "25 h", heures: 25 },
  "30h": { label: "30 h", heures: 30 },
  "35h": { label: "35 h", heures: 35 },
  "39h": { label: "39 h", heures: 39 },
  cadre: { label: "Cadre (forfait)", heures: null },
  libre: { label: "Libre / extra", heures: null },
};

export const STATUTS: Record<string, { label: string; ton: string }> = {
  actif: { label: "Actif", ton: "t-mint" },
  invite: { label: "Invitation en attente", ton: "t-yellow" },
  parti: { label: "Parti", ton: "t-blue" },
};

export function anciennete(dateEmbauche: string | null) {
  if (!dateEmbauche) return null;
  const d = new Date(dateEmbauche + "T00:00");
  const mois = (new Date().getFullYear() - d.getFullYear()) * 12 + new Date().getMonth() - d.getMonth();
  if (mois < 0) return "arrive bientôt";
  if (mois < 1) return "moins d'un mois";
  if (mois < 12) return `${mois} mois`;
  const ans = Math.floor(mois / 12);
  return `${ans} an${ans > 1 ? "s" : ""}${mois % 12 ? ` et ${mois % 12} mois` : ""}`;
}

export function dateFr(iso: string | null) {
  return iso ? new Date(iso.slice(0, 10) + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
