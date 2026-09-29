// Catalogue des modules de Juliette : une seule source pour le menu, la recherche et les droits.
// La clé `module` est celle attendue par la fonction SQL acces_module_de(), qui décide qui voit quoi.

export type ModuleJuliette = {
  module: string;
  href: string;
  label: string;
  sub: string;
  icon: string;
  groupe: (typeof GROUPES)[number];
  pret: boolean;
  /** Rubrique regroupée : une seule entrée dans le menu, les pages sœurs en onglets. */
  section?: SectionCle;
  /** Hors menu latéral (accès direct depuis la barre du haut). */
  horsMenu?: boolean;
};

export type SectionCle = "equipe" | "stock" | "salle";

export const SECTIONS: Record<SectionCle, { label: string; icon: string; sub: string }> = {
  equipe: { label: "Équipe", icon: "☺", sub: "Pointage, personnel, RH & congés" },
  stock: { label: "Stock & commandes", icon: "▤", sub: "Stocks, pertes, commandes, réception" },
  salle: { label: "Salle", icon: "◫", sub: "Commandes clients & réservations" },
};

export const MODULES: ModuleJuliette[] = [
  { module: "dashboard", href: "/dashboard", label: "Tableau de bord", sub: "Vue d'ensemble", icon: "⌂", groupe: "Pilotage", pret: true },
  { module: "finance", href: "/finance", label: "Finance", sub: "Ventes, pertes et estimations", icon: "€", groupe: "Pilotage", pret: true },
  { module: "evenements", href: "/evenements", label: "Événements", sub: "Concerts, matchs, marchés", icon: "✦", groupe: "Pilotage", pret: true },

  { module: "pointeuse", href: "/pointeuse", label: "Gestion pointage", sub: "Arrivées & départs", icon: "◷", groupe: "Équipe", pret: true, section: "equipe" },
  { module: "planning", href: "/planning", label: "Planning", sub: "Horaires de la semaine", icon: "▦", groupe: "Équipe", pret: true },
  { module: "equipe", href: "/equipe", label: "Équipe", sub: "Annuaire du personnel", icon: "☺", groupe: "Équipe", pret: true, section: "equipe" },
  { module: "rh-conges", href: "/rh-conges", label: "RH & congés", sub: "Demandes & absences", icon: "✎", groupe: "Équipe", pret: true, section: "equipe" },
  { module: "messagerie", href: "/messagerie", label: "Messagerie", sub: "Fil de messages d'équipe", icon: "✉", groupe: "Équipe", pret: true, horsMenu: true },

  // HACCP : module autonome, sans lien avec le stock ni les achats (tables haccp_* dédiées).
  { module: "haccp", href: "/haccp", label: "HACCP", sub: "Températures, nettoyage, traçabilité", icon: "❄", groupe: "Opérations", pret: true },

  { module: "inventaire", href: "/inventaire", label: "Stocks", sub: "Inventaire par zone", icon: "▤", groupe: "Opérations", pret: true, section: "stock" },
  { module: "perte", href: "/perte", label: "Pertes", sub: "Casse, DLC, retours", icon: "↘", groupe: "Opérations", pret: true, section: "stock" },
  { module: "aide-commande", href: "/aide-commande", label: "Commandes", sub: "Quoi commander aujourd'hui", icon: "↗", groupe: "Opérations", pret: true, section: "stock" },
  { module: "reception", href: "/reception", label: "Réception", sub: "Livraisons conformes à la commande", icon: "✓", groupe: "Opérations", pret: true, section: "stock" },

  { module: "commandes-caisse", href: "/commandes-clients", label: "Commandes clients", sub: "Tables & commandes en cours", icon: "◫", groupe: "Opérations", pret: true, section: "salle" },
  { module: "reservations", href: "/reservations", label: "Réservations", sub: "Accueil & briefing", icon: "▣", groupe: "Opérations", pret: true, section: "salle" },

  { module: "fiche-technique", href: "/fiche-technique", label: "Fiches techniques", sub: "Recettes & coûts matière", icon: "❏", groupe: "Établissement", pret: true },
  { module: "documentation", href: "/documentation", label: "Documentation", sub: "Procédures & archives", icon: "▢", groupe: "Établissement", pret: true },
  { module: "outils", href: "/outils", label: "Outils externes", sub: "URSSAF, banque, mutuelle, paie, caisse…", icon: "⧉", groupe: "Établissement", pret: true },
  { module: "parametres", href: "/parametres", label: "Paramètres", sub: "Mon compte, établissement & accréditations", icon: "⚙", groupe: "Établissement", pret: true },
  { module: "accreditations", href: "/accreditations", label: "Accréditations", sub: "Comptes & niveaux d'accès", icon: "⚿", groupe: "Établissement", pret: true, horsMenu: true },
];

export const GROUPES = ["Pilotage", "Équipe", "Opérations", "Établissement"] as const;

/** Pages sœurs d'une rubrique regroupée, dans l'ordre du catalogue. */
export function pagesDeSection(section: SectionCle, autorises: Set<string>) {
  return MODULES.filter((m) => m.section === section && autorises.has(m.module));
}

export function moduleDeRoute(pathname: string): ModuleJuliette | undefined {
  return MODULES.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
}
