// Catalogue des modules de Juliette : une seule source pour le menu, la recherche et les droits.
// La clé `module` est celle attendue par la fonction SQL acces_module_de(), qui décide qui voit quoi.

export type ModuleJuliette = {
  module: string;
  href: string;
  label: string;
  sub: string;
  icon: string;
  groupe: "Pilotage" | "Équipe" | "HACCP" | "Stock & achats" | "Salle" | "Établissement";
  pret: boolean;
};

export const MODULES: ModuleJuliette[] = [
  { module: "dashboard", href: "/dashboard", label: "Tableau de bord", sub: "Vue d'ensemble", icon: "⌂", groupe: "Pilotage", pret: true },
  { module: "finance", href: "/finance", label: "Finance", sub: "Ventes, pertes et estimations", icon: "€", groupe: "Pilotage", pret: false },
  { module: "evenements", href: "/evenements", label: "Événements", sub: "Concerts, matchs, marchés", icon: "✦", groupe: "Pilotage", pret: false },

  { module: "pointeuse", href: "/pointeuse", label: "Pointage", sub: "Arrivées & départs", icon: "◷", groupe: "Équipe", pret: true },
  { module: "planning", href: "/planning", label: "Planning", sub: "Horaires de la semaine", icon: "▦", groupe: "Équipe", pret: true },
  { module: "equipe", href: "/equipe", label: "Équipe", sub: "Annuaire du personnel", icon: "☺", groupe: "Équipe", pret: true },
  { module: "rh-conges", href: "/rh-conges", label: "RH & congés", sub: "Demandes & absences", icon: "✎", groupe: "Équipe", pret: true },
  { module: "messagerie", href: "/messagerie", label: "Messagerie", sub: "Fil de messages d'équipe", icon: "✉", groupe: "Équipe", pret: true },

  // HACCP : module autonome, sans lien avec le stock ni les achats (tables haccp_* dédiées).
  { module: "haccp", href: "/haccp", label: "HACCP", sub: "Températures, nettoyage, traçabilité", icon: "❄", groupe: "HACCP", pret: false },

  { module: "inventaire", href: "/inventaire", label: "Stocks", sub: "Inventaire par zone", icon: "▤", groupe: "Stock & achats", pret: false },
  { module: "perte", href: "/perte", label: "Pertes", sub: "Casse, DLC, retours", icon: "↘", groupe: "Stock & achats", pret: false },
  { module: "aide-commande", href: "/aide-commande", label: "Commandes", sub: "Quoi commander aujourd'hui", icon: "↗", groupe: "Stock & achats", pret: false },
  { module: "reception", href: "/reception", label: "Réception", sub: "Livraisons conformes à la commande", icon: "✓", groupe: "Stock & achats", pret: false },

  { module: "commandes-clients", href: "/commandes-clients", label: "Commandes clients", sub: "Tables & commandes en cours", icon: "◫", groupe: "Salle", pret: false },
  { module: "reservations", href: "/reservations", label: "Réservations", sub: "Accueil & briefing", icon: "▣", groupe: "Salle", pret: false },

  { module: "fiche-technique", href: "/fiche-technique", label: "Fiches techniques", sub: "Recettes & coûts matière", icon: "❏", groupe: "Établissement", pret: false },
  { module: "documentation", href: "/documentation", label: "Documentation", sub: "Procédures & archives", icon: "▢", groupe: "Établissement", pret: false },
  { module: "accreditations", href: "/accreditations", label: "Accréditations", sub: "Comptes & niveaux d'accès", icon: "⚿", groupe: "Établissement", pret: false },
];

export const GROUPES = ["Pilotage", "Équipe", "HACCP", "Stock & achats", "Salle", "Établissement"] as const;

export function moduleDeRoute(pathname: string): ModuleJuliette | undefined {
  return MODULES.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
}
