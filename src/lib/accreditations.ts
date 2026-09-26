// Accréditations : qui voit quel module. Reproduit exactement la fonction SQL acces_module_de(),
// qui reste la seule autorité (l'écran ne fait qu'afficher et modifier ses réglages).
//   1. directeur : tout ;
//   2. réglage de la personne (compte_id) ;
//   3. réglage de son poste ;
//   4. valeur par défaut de son rôle.

import type { Role } from "@/lib/session";

export type Regle = { module: string; autorise: boolean; poste: string | null; compte_id: string | null };

export const MODULES_ACCES: { cle: string; label: string; groupe: string; sensible?: boolean }[] = [
  { cle: "dashboard", label: "Tableau de bord", groupe: "Pilotage" },
  { cle: "finance", label: "Finance", groupe: "Pilotage", sensible: true },
  { cle: "evenements", label: "Événements", groupe: "Pilotage" },
  { cle: "pointeuse", label: "Pointage", groupe: "Équipe" },
  { cle: "planning", label: "Planning", groupe: "Équipe" },
  { cle: "equipe", label: "Équipe (annuaire)", groupe: "Équipe" },
  { cle: "rh-conges", label: "RH & congés", groupe: "Équipe" },
  { cle: "messagerie", label: "Messagerie", groupe: "Équipe" },
  { cle: "haccp", label: "HACCP", groupe: "HACCP" },
  { cle: "inventaire", label: "Stocks", groupe: "Stock & achats" },
  { cle: "perte", label: "Pertes", groupe: "Stock & achats" },
  { cle: "aide-commande", label: "Commandes fournisseurs", groupe: "Stock & achats", sensible: true },
  { cle: "reception", label: "Réception", groupe: "Stock & achats" },
  { cle: "commandes-caisse", label: "Commandes clients", groupe: "Salle" },
  { cle: "configuration-commandes", label: "Configuration de la carte", groupe: "Salle" },
  { cle: "reservations", label: "Réservations", groupe: "Salle" },
  { cle: "fiche-technique", label: "Fiches techniques", groupe: "Établissement" },
  { cle: "documentation", label: "Documentation", groupe: "Établissement" },
  { cle: "accreditations", label: "Accréditations", groupe: "Établissement", sensible: true },
];

const DEFAUT_RESPONSABLE = ["dashboard", "commandes-caisse", "configuration-commandes", "inventaire", "perte", "aide-commande", "reception", "evenements", "fiche-technique", "pointeuse", "planning", "messagerie", "equipe", "rh-conges", "reservations", "haccp"];
const DEFAUT_SALARIE = ["dashboard", "commandes-caisse", "fiche-technique", "pointeuse", "planning", "messagerie", "equipe", "rh-conges", "reservations", "haccp"];

export function parDefaut(role: Role, module: string) {
  if (role === "directeur") return true;
  return (role === "responsable" ? DEFAUT_RESPONSABLE : DEFAUT_SALARIE).includes(module);
}

export type Source = "directeur" | "personne" | "poste" | "defaut";

export function accesEffectif(p: { id: string; role: Role; poste: string | null }, module: string, regles: Regle[]): { autorise: boolean; source: Source } {
  if (p.role === "directeur") return { autorise: true, source: "directeur" };
  const perso = regles.find((r) => r.module === module && r.compte_id === p.id);
  if (perso) return { autorise: perso.autorise, source: "personne" };
  if (p.poste) {
    const poste = regles.find((r) => r.module === module && r.poste === p.poste && !r.compte_id);
    if (poste) return { autorise: poste.autorise, source: "poste" };
  }
  return { autorise: parDefaut(p.role, module), source: "defaut" };
}

export const LIBELLE_SOURCE: Record<Source, string> = { directeur: "directeur", personne: "réglé pour la personne", poste: "réglé pour le poste", defaut: "par défaut" };
