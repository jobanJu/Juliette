// Logiciels de caisse que Juliette sait connecter. Partagé entre l'écran client et la console.
//
// « api »        : le restaurateur crée lui-même une clé dans son espace et la colle dans Juliette ;
//                  la connexion et l'import des ventes sont automatiques.
// « partenaire » : l'éditeur réserve son API à ses partenaires agréés ; la demande part à l'équipe
//                  Juliette, qui active la connexion avec l'éditeur.

export type ModeConnexion = "api" | "partenaire";
export type Caisse = {
  cle: string;
  nom: string;
  mode: ModeConnexion;
  pays: ("FR" | "BE")[];
  etapes: string[];
  champs?: { cle: string; label: string; aide?: string; secret?: boolean; optionnel?: boolean }[];
};

export const CAISSES: Caisse[] = [
  {
    cle: "sumup",
    nom: "SumUp",
    mode: "api",
    pays: ["FR", "BE"],
    etapes: ["Connecte-toi à ton espace SumUp (me.sumup.com).", "Ouvre Paramètres → Développeurs → Clés API, puis crée une clé.", "Copie la clé (elle commence par « sk_ ») et colle-la ci-dessous."],
    champs: [{ cle: "cle", label: "Clé API SumUp", secret: true }],
  },
  {
    cle: "square",
    nom: "Square",
    mode: "api",
    pays: ["FR"],
    etapes: [
      "Connecte-toi sur developer.squareup.com avec ton compte Square.",
      "Crée une application (nom libre, ex. « Juliette »), puis ouvre Identifiants → Production.",
      "Copie le « jeton d'accès de production » et colle-le ci-dessous. Si tu as plusieurs points de vente, indique l'identifiant de l'emplacement.",
    ],
    champs: [
      { cle: "cle", label: "Jeton d'accès de production", secret: true },
      { cle: "identifiant", label: "Identifiant d'emplacement (facultatif)", aide: "Laisse vide si tu n'as qu'un point de vente.", optionnel: true },
    ],
  },
  { cle: "zelty", nom: "Zelty", mode: "partenaire", pays: ["FR", "BE"], etapes: ["Demande la connexion : l'équipe Juliette l'active avec Zelty.", "Tu recevras ensuite une clé à coller dans le Back Office Zelty → Marketplace."] },
  { cle: "laddition", nom: "L'Addition", mode: "partenaire", pays: ["FR"], etapes: ["Demande la connexion : l'équipe Juliette la met en place avec L'Addition."] },
  { cle: "lightspeed", nom: "Lightspeed Restaurant", mode: "partenaire", pays: ["FR", "BE"], etapes: ["Demande la connexion : tu devras ensuite autoriser Juliette depuis ton compte Lightspeed."] },
  { cle: "tiller", nom: "Tiller", mode: "partenaire", pays: ["FR"], etapes: ["Demande la connexion : l'équipe Juliette la met en place avec Tiller."] },
  { cle: "innovorder", nom: "Innovorder", mode: "partenaire", pays: ["FR"], etapes: ["Demande la connexion : l'équipe Juliette la met en place avec Innovorder."] },
  { cle: "autre", nom: "Autre logiciel", mode: "partenaire", pays: ["FR", "BE"], etapes: ["Indique ton logiciel dans la demande : l'équipe Juliette étudie la connexion."] },
];

export const caisse = (cle: string | null | undefined) => CAISSES.find((c) => c.cle === cle);

export const STATUTS_CAISSE: Record<string, { label: string; ton: string }> = {
  aucune: { label: "Aucune", ton: "t-lav" },
  demandee: { label: "Demandée", ton: "t-yellow" },
  en_cours: { label: "En cours", ton: "t-blue" },
  connectee: { label: "Connectée", ton: "t-mint" },
  erreur: { label: "Erreur", ton: "t-red" },
};
