// Outils externes : catalogue des services courants autour d'un restaurant, en France et en
// Belgique. L'établissement choisit ceux qu'il utilise (table outils_externes) ; il peut aussi en
// ajouter à la main. Les adresses mènent à l'espace professionnel quand il existe.

export type Pays = "FR" | "BE";

export type OutilCatalogue = { cle: string; nom: string; categorie: Categorie; url: string; pays: Pays[]; description: string };

export type OutilEtablissement = {
  id: string;
  cle: string;
  nom: string | null;
  categorie: string | null;
  url: string | null;
  identifiant: string | null;
  contact: string | null;
  note: string | null;
  ordre: number;
};

export const CATEGORIES = {
  administratif: { label: "Social & administratif", icone: "🏛" },
  banque: { label: "Banque & paiement", icone: "🏦" },
  assurance: { label: "Mutuelle & assurance", icone: "🛡" },
  paie: { label: "Paie & RH", icone: "🧾" },
  compta: { label: "Comptabilité & gestion", icone: "📊" },
  caisse: { label: "Logiciel de caisse", icone: "🖥" },
  vente: { label: "Livraison & réservation", icone: "🛵" },
  metier: { label: "Formation & syndicats", icone: "🤝" },
  autre: { label: "Autres", icone: "⧉" },
} as const;
export type Categorie = keyof typeof CATEGORIES;

export const CATALOGUE: OutilCatalogue[] = [
  // Social & administratif
  { cle: "urssaf", nom: "URSSAF", categorie: "administratif", url: "https://www.urssaf.fr", pays: ["FR"], description: "Cotisations sociales, attestations de vigilance" },
  { cle: "net-entreprises", nom: "net-entreprises.fr", categorie: "administratif", url: "https://www.net-entreprises.fr", pays: ["FR"], description: "DSN et déclarations sociales" },
  { cle: "impots-pro", nom: "impots.gouv.fr (espace pro)", categorie: "administratif", url: "https://www.impots.gouv.fr/professionnel", pays: ["FR"], description: "TVA, CFE, impôt sur les sociétés" },
  { cle: "onss", nom: "ONSS", categorie: "administratif", url: "https://www.socialsecurity.be", pays: ["BE"], description: "Sécurité sociale, Dimona, DmfA" },
  { cle: "myminfin", nom: "SPF Finances (MyMinfin)", categorie: "administratif", url: "https://finances.belgium.be", pays: ["BE"], description: "TVA, impôts, Intervat" },
  { cle: "afsca", nom: "AFSCA", categorie: "administratif", url: "https://www.favv-afsca.be", pays: ["BE"], description: "Sécurité alimentaire, autorisations et contrôles" },
  { cle: "bce", nom: "Banque-Carrefour des Entreprises", categorie: "administratif", url: "https://kbopub.economie.fgov.be", pays: ["BE"], description: "Numéro d'entreprise, données officielles" },
  { cle: "caisse-enregistreuse-be", nom: "Système de caisse enregistreuse (SCE)", categorie: "administratif", url: "https://www.systemedecaisseenregistreuse.be", pays: ["BE"], description: "Obligation « boîte noire » horeca" },
  // Banque & paiement
  { cle: "qonto", nom: "Qonto", categorie: "banque", url: "https://qonto.com", pays: ["FR", "BE"], description: "Compte pro, cartes, justificatifs" },
  { cle: "shine", nom: "Shine", categorie: "banque", url: "https://www.shine.fr", pays: ["FR"], description: "Compte pro en ligne" },
  { cle: "swile", nom: "Swile", categorie: "banque", url: "https://www.swile.co", pays: ["FR", "BE"], description: "Titres-restaurant, avantages salariés" },
  // Mutuelle & assurance
  { cle: "alan", nom: "Alan", categorie: "assurance", url: "https://alan.com", pays: ["FR", "BE"], description: "Mutuelle et prévoyance des salariés" },
  { cle: "hiscox", nom: "Hiscox", categorie: "assurance", url: "https://www.hiscox.fr", pays: ["FR"], description: "Assurance responsabilité civile pro" },
  // Paie & RH
  { cle: "payfit", nom: "PayFit", categorie: "paie", url: "https://payfit.com", pays: ["FR"], description: "Logiciel de paie" },
  { cle: "silae", nom: "Silae", categorie: "paie", url: "https://www.silae.fr", pays: ["FR"], description: "Paie (souvent via l'expert-comptable)" },
  { cle: "securex", nom: "Securex", categorie: "paie", url: "https://www.securex.be", pays: ["BE"], description: "Secrétariat social" },
  { cle: "partena", nom: "Partena Professional", categorie: "paie", url: "https://www.partena-professional.be", pays: ["BE"], description: "Secrétariat social" },
  { cle: "sdworx", nom: "SD Worx", categorie: "paie", url: "https://www.sdworx.be", pays: ["BE"], description: "Secrétariat social et paie" },
  // Comptabilité & gestion
  { cle: "pennylane", nom: "Pennylane", categorie: "compta", url: "https://www.pennylane.com", pays: ["FR"], description: "Comptabilité et pilotage" },
  { cle: "tiime", nom: "Tiime", categorie: "compta", url: "https://www.tiime.fr", pays: ["FR"], description: "Comptabilité, notes de frais" },
  { cle: "agicap", nom: "Agicap", categorie: "compta", url: "https://agicap.com", pays: ["FR", "BE"], description: "Trésorerie" },
  { cle: "yuki", nom: "Yuki", categorie: "compta", url: "https://www.yuki.be", pays: ["BE"], description: "Comptabilité en ligne" },
  // Caisse
  { cle: "zelty", nom: "Zelty", categorie: "caisse", url: "https://www.zelty.fr", pays: ["FR", "BE"], description: "Caisse restaurant" },
  { cle: "lightspeed", nom: "Lightspeed", categorie: "caisse", url: "https://www.lightspeedhq.fr", pays: ["FR", "BE"], description: "Caisse restaurant" },
  { cle: "laddition", nom: "L'Addition", categorie: "caisse", url: "https://www.laddition.com", pays: ["FR"], description: "Caisse sur iPad" },
  { cle: "sumup", nom: "SumUp", categorie: "caisse", url: "https://www.sumup.com", pays: ["FR", "BE"], description: "Terminal de paiement et caisse" },
  { cle: "tiller", nom: "Tiller", categorie: "caisse", url: "https://www.tillersystems.com", pays: ["FR"], description: "Caisse restaurant" },
  // Livraison & réservation
  { cle: "ubereats", nom: "Uber Eats Manager", categorie: "vente", url: "https://merchants.ubereats.com", pays: ["FR", "BE"], description: "Livraison" },
  { cle: "deliveroo", nom: "Deliveroo Hub", categorie: "vente", url: "https://restaurants.deliveroo.com", pays: ["FR", "BE"], description: "Livraison" },
  { cle: "thefork", nom: "TheFork Manager", categorie: "vente", url: "https://www.theforkmanager.com", pays: ["FR", "BE"], description: "Réservations en ligne" },
  { cle: "zenchef", nom: "Zenchef", categorie: "vente", url: "https://www.zenchef.com", pays: ["FR", "BE"], description: "Réservations, avis clients" },
  { cle: "google-business", nom: "Google Business Profile", categorie: "vente", url: "https://business.google.com", pays: ["FR", "BE"], description: "Fiche Google, horaires, avis" },
  // Formation & syndicats
  { cle: "akto", nom: "OPCO AKTO", categorie: "metier", url: "https://www.akto.fr", pays: ["FR"], description: "Financement des formations HCR" },
  { cle: "umih", nom: "UMIH", categorie: "metier", url: "https://www.umih.fr", pays: ["FR"], description: "Syndicat des métiers de l'hôtellerie-restauration" },
  { cle: "ghr", nom: "GHR", categorie: "metier", url: "https://www.ghr.fr", pays: ["FR"], description: "Groupement des hôtelleries & restaurations" },
  { cle: "horeca-wallonie", nom: "Horeca Wallonie", categorie: "metier", url: "https://www.horecawallonie.be", pays: ["BE"], description: "Fédération horeca" },
  { cle: "horeca-bruxelles", nom: "Horeca Bruxelles", categorie: "metier", url: "https://www.horecabruxelles.be", pays: ["BE"], description: "Fédération horeca" },
  { cle: "horeca-vlaanderen", nom: "Horeca Vlaanderen", categorie: "metier", url: "https://www.horecavlaanderen.be", pays: ["BE"], description: "Fédération horeca" },
];

export const duCatalogue = (cle: string) => CATALOGUE.find((o) => o.cle === cle);

/** Nom, catégorie et adresse effectifs : ceux saisis par l'établissement, sinon ceux du catalogue. */
export function vueOutil(o: OutilEtablissement) {
  const c = duCatalogue(o.cle);
  return {
    nom: o.nom || c?.nom || "Outil",
    categorie: ((o.categorie || c?.categorie || "autre") in CATEGORIES ? o.categorie || c?.categorie || "autre" : "autre") as Categorie,
    url: o.url || c?.url || null,
    description: c?.description ?? null,
  };
}

/** Une adresse saisie sans « https:// » reste cliquable. */
export function urlPropre(u: string | null) {
  if (!u?.trim()) return null;
  return /^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`;
}
