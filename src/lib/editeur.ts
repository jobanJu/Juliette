// Identité de l'éditeur de Juliette, reprise dans les pages légales.
// Un champ laissé à null s'affiche « à compléter » sur le site : à remplir avant l'ouverture de la vente.

export const EDITEUR = {
  /** Dénomination sociale, ou prénom et nom suivis de « EI » pour une entreprise individuelle. */
  denomination: null as string | null,
  /** SAS, SASU, SARL, EURL, EI (micro-entreprise)… */
  formeJuridique: null as string | null,
  /** Capital social, pour une société (ex. « 1 000 € »). Laisser null pour une entreprise individuelle. */
  capital: null as string | null,
  adresse: null as string | null,
  /** SIREN, ou numéro RCS complet (ex. « RCS Lille Métropole 123 456 789 »). */
  immatriculation: null as string | null,
  numeroTva: null as string | null,
  /** Personne responsable du contenu du site. */
  directeurPublication: null as string | null,
  email: null as string | null,
  telephone: null as string | null,
  /** Ville du siège, dont les juridictions sont compétentes pour les litiges entre professionnels. */
  tribunal: null as string | null,
};

/** Version des conditions en vigueur : à changer à chaque modification, les clients acceptent une version datée. */
export const VERSION_CONDITIONS = "2026-09-30";
export const DATE_CONDITIONS = "30 septembre 2026";

export const HEBERGEURS = {
  site: { nom: "Vercel Inc.", adresse: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis", lieu: "fonctions serveur exécutées à Paris (France)", site: "vercel.com" },
  donnees: { nom: "Supabase Inc.", adresse: "970 Toa Payoh North #07-04, Singapour 318992", lieu: "base de données et fichiers hébergés en Irlande (Union européenne)", site: "supabase.com" },
};

/** Sous-traitants ultérieurs (article 28 du RGPD). */
export const SOUS_TRAITANTS: { nom: string; role: string; lieu: string; garanties: string }[] = [
  { nom: "Supabase Inc.", role: "Base de données, authentification et stockage des fichiers", lieu: "Irlande (Union européenne)", garanties: "Données stockées dans l'Union européenne ; clauses contractuelles types pour l'accès du support" },
  { nom: "Vercel Inc.", role: "Hébergement de l'application et exécution des traitements serveur", lieu: "France (Paris) ; société établie aux États-Unis", garanties: "Data Privacy Framework UE–États-Unis et clauses contractuelles types" },
  { nom: "Stripe Payments Europe Ltd", role: "Paiement et facturation de l'abonnement (clients abonnés uniquement)", lieu: "Irlande (Union européenne)", garanties: "Établissement dans l'Union européenne ; clauses contractuelles types" },
  { nom: "Prestataire d'envoi d'e-mails (Resend ou Mailjet)", role: "Envoi des bons de commande fournisseurs et des e-mails de service, réception des réponses", lieu: "Union européenne ou États-Unis selon le prestataire retenu", garanties: "Data Privacy Framework ou clauses contractuelles types" },
];
