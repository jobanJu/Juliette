// Contenu du centre d'aide : un guide par module, dans l'ordre du menu.
import type { NomIcone } from "@/components/Icone";

export type Guide = {
  id: string;
  titre: string;
  icone: NomIcone;
  /** Qui s'en sert au quotidien. */
  pour: string;
  /** Lien vers le module, s'il existe. */
  href?: string;
  resume: string;
  etapes: { titre: string; texte: string }[];
  astuces?: string[];
};

export const PREMIERS_PAS: Guide = {
  id: "premiers-pas",
  titre: "Installer Juliette dans ton établissement",
  icone: "eclair",
  pour: "Directeur",
  resume: "En une heure, ton restaurant est prêt : équipe invitée, produits importés, HACCP paramétré et pointeuse installée. Suis les étapes dans l'ordre, chacune ne prend que quelques minutes.",
  etapes: [
    { titre: "Compléter la fiche de l'établissement", texte: "Paramètres › Restaurant : nom, adresse, SIRET (ou numéro d'entreprise en Belgique), convention collective, horaires d'ouverture. Ces informations remplissent automatiquement les contrats, les documents RH et les commandes fournisseurs." },
    { titre: "Inviter l'équipe", texte: "Ressources humaines › Équipe › « + Ajouter un collaborateur ». Saisis le prénom, le nom, l'e-mail et le poste. Chaque personne reçoit le code de l'établissement et active son compte elle-même depuis la page de connexion (« Active ton compte »)." },
    { titre: "Régler les accès", texte: "Paramètres › Accréditations. Trois niveaux existent : directeur (tout), responsable (gestion du quotidien : planning, stock, HACCP) et salarié (son pointage, son planning, ses congés, la messagerie). Tu peux ouvrir ou fermer chaque module par niveau." },
    { titre: "Importer tes produits", texte: "Stock & commandes › Stocks › « Importer depuis Excel ». Prends l'export de ton grossiste ou le modèle Juliette : les colonnes sont reconnues, les produits sont classés (frais, surgelé, épicerie sèche, boissons…) et les fournisseurs sont créés. Pas besoin de saisir les produits un par un." },
    { titre: "Créer les zones de stockage", texte: "Stocks › « Zones de stockage » : chambre froide, réserve sèche, bar… puis « Faire l'inventaire › Ranger des produits ici ». L'inventaire se fera ensuite zone par zone, dans l'ordre où tu passes réellement." },
    { titre: "Paramétrer le HACCP", texte: "HACCP › Paramètres : déclare tes frigos et congélateurs (avec leurs températures cibles), le plan de nettoyage, tes friteuses et les produits de tes étiquettes DLC. Le tour des frigos du matin est ensuite prêt pour l'équipe." },
    { titre: "Installer la pointeuse", texte: "Paramètres › Pointeuse : ouvre Juliette sur la tablette de l'entrée, connecte-toi en directeur et active la borne. La tablette garde un accès limité au pointage : ta session personnelle n'y reste pas." },
    { titre: "Brancher la caisse (facultatif)", texte: "Paramètres › Caisse. SumUp et Square se connectent directement avec une clé d'accès : les ventes remontent chaque nuit dans Finance. Pour Zelty, L'Addition, Lightspeed, Tiller ou Innovorder, fais une demande : l'équipe Juliette s'occupe du branchement." },
  ],
  astuces: [
    "Commence par l'import des produits : c'est ce qui fait gagner le plus de temps, car les fiches techniques, les commandes et l'inventaire s'appuient dessus.",
    "Tu gères plusieurs restaurants ? Crée chaque établissement depuis Paramètres › Mes établissements, puis passe de l'un à l'autre depuis le haut du menu.",
  ],
};

export const GUIDES: Guide[] = [
  {
    id: "tableau-de-bord",
    titre: "Tableau de bord",
    icone: "tableau",
    pour: "Tout le monde",
    href: "/dashboard",
    resume: "L'essentiel de la journée sur une page : qui est présent, le stock sous le seuil, les pertes de la semaine, ce qu'il faut commander et les événements à venir.",
    etapes: [
      { titre: "Lire les compteurs", texte: "Les quatre cartes du haut se cliquent : elles mènent au module concerné (pointage, stocks, pertes, commandes)." },
      { titre: "Personnaliser", texte: "« Personnaliser » permet d'afficher ou de masquer chaque carte. Tes choix sont enregistrés pour toi seul, établissement par établissement." },
    ],
  },
  {
    id: "pointage",
    titre: "Pointage",
    icone: "horloge",
    pour: "Tout le monde",
    href: "/pointeuse",
    resume: "Chaque salarié pointe son arrivée, ses pauses et son départ. L'heure est prise sur le serveur : elle ne peut pas être modifiée depuis le téléphone.",
    etapes: [
      { titre: "Pointer depuis son téléphone", texte: "Ressources humaines › Pointage › « Pointer mon arrivée ». Les boutons de pause et de départ apparaissent ensuite." },
      { titre: "Pointer sur la borne", texte: "Sur la tablette de l'entrée, chaque salarié tape son code personnel de pointeuse (visible dans son profil)." },
      { titre: "Suivre la journée (responsables)", texte: "L'onglet Jour montre qui est là, en pause ou parti, et les retards par rapport au planning. L'onglet Semaine donne les heures réelles de chacun." },
      { titre: "Corriger un oubli", texte: "Un pointage manquant ou erroné se corrige depuis la ligne du salarié, avec un motif. La correction reste tracée." },
    ],
    astuces: ["Le planning peut afficher le réel à côté du prévu : « Comparer au pointage »."],
  },
  {
    id: "planning",
    titre: "Planning",
    icone: "planning",
    pour: "Responsables (lecture pour les salariés)",
    href: "/planning",
    resume: "Les horaires de la semaine, poste par poste, avec les repos et les absences. Chaque salarié voit son planning sur son téléphone.",
    etapes: [
      { titre: "Poser un créneau", texte: "Clique sur une case (personne × jour) : choisis l'heure de début et de fin, ou un repos, une absence, un congé. Pour une journée en coupure, ajoute un second service : la coupure est affichée." },
      { titre: "Aller plus vite", texte: "« Copier la semaine précédente » reprend toute la semaine passée. « Suggestion » propose une répartition à partir des habitudes de l'équipe et des événements prévus." },
      { titre: "Surveiller les règles", texte: "Juliette signale les amplitudes trop longues et les repos trop courts au regard de la convention HCR." },
    ],
  },
  {
    id: "rh",
    titre: "Congés, acomptes et absences",
    icone: "rh",
    pour: "Tout le monde",
    href: "/rh-conges",
    resume: "Les salariés posent leurs congés et demandent un acompte ; le responsable accepte ou refuse, avec l'impact sur le planning sous les yeux.",
    etapes: [
      { titre: "Faire une demande (salarié)", texte: "RH & congés › « Nouvelle demande » : type, dates, commentaire. Tu suis la réponse dans la même page." },
      { titre: "Traiter une demande (responsable)", texte: "Chaque demande indique les créneaux du planning à réaffecter et les autres absents sur la période. Accepte ou refuse en un clic." },
    ],
  },
  {
    id: "equipe",
    titre: "Équipe",
    icone: "equipe",
    pour: "Responsables",
    href: "/equipe",
    resume: "L'annuaire du personnel : coordonnées, poste, type de contrat, rémunération et accès à Juliette.",
    etapes: [
      { titre: "Ajouter une personne", texte: "« + Ajouter un collaborateur », puis envoie-lui le code de l'établissement pour qu'elle active son compte." },
      { titre: "Consulter une fiche", texte: "Clique sur un nom pour voir ses informations, ses contrats, ses documents et son historique de pointage." },
    ],
    astuces: ["Les coordonnées privées (adresse, téléphone personnel) ne sont visibles que par la direction."],
  },
  {
    id: "contrats",
    titre: "Contrats de travail",
    icone: "contrat",
    pour: "Directeur (signature pour les salariés)",
    href: "/contrats",
    resume: "CDI, CDD, extra (France, convention HCR ou restauration rapide) et contrats belges (CP 302) : le document se remplit tout seul et se signe dans Juliette.",
    etapes: [
      { titre: "Créer un contrat", texte: "« Nouveau contrat » : choisis la personne et le type, puis avance étape par étape (emploi, horaires, période d'essai, repas, tenue, primes). Les clauses suivent la convention choisie." },
      { titre: "Relire l'aperçu", texte: "Bascule sur « Aperçu du contrat » : c'est exactement ce qui sera imprimé, découpé en pages A4 avec les paraphes." },
      { titre: "Faire signer", texte: "Envoie le contrat au salarié : il le lit et le signe depuis son compte. Tu peux aussi l'imprimer." },
      { titre: "Faire un avenant", texte: "Depuis un contrat signé : salaire, durée, horaires, poste, lieu, renouvellement… L'avenant est numéroté et rattaché au contrat." },
    ],
    astuces: ["« Enregistrer ces choix par défaut » garde tes réglages habituels pour les prochains contrats."],
  },
  {
    id: "documents-rh",
    titre: "Documents RH",
    icone: "documents",
    pour: "Directeur",
    href: "/documents-rh",
    resume: "Fiche de poste, remise de matériel, règlement intérieur, promesse d'embauche, avertissement, convocation, certificat de travail, attestation employeur : rédigés en quelques clics.",
    etapes: [
      { titre: "Choisir le document", texte: "Clique sur le modèle voulu, puis sur la personne concernée." },
      { titre: "Remplir", texte: "Les champs connus (identité, poste, dates) sont pré-remplis. Complète le reste : l'aperçu se met à jour en direct." },
      { titre: "Imprimer ou faire signer", texte: "Le document s'imprime en A4, ou part dans l'espace du salarié pour signature (remise de matériel, règlement intérieur…)." },
    ],
  },
  {
    id: "messagerie",
    titre: "Messagerie",
    icone: "mail",
    pour: "Tout le monde",
    href: "/messagerie",
    resume: "Les messages de l'équipe, en direct : un fil général, des groupes (cuisine, salle…) et des messages privés, avec photos et pièces jointes.",
    etapes: [
      { titre: "Écrire", texte: "Bouton « Messages » en haut de l'écran, puis choisis un fil ou crée un groupe." },
      { titre: "Joindre un fichier", texte: "Le trombone ajoute une photo ou un document." },
    ],
  },
  {
    id: "haccp",
    titre: "HACCP",
    icone: "hygiene",
    pour: "Tout le monde",
    href: "/haccp",
    resume: "Ton plan de maîtrise sanitaire tenu à jour au fil du service : températures, nettoyage, traçabilité, étiquettes DLC, refroidissements, cuissons et huiles de friture. En cas de contrôle, le registre s'exporte en un clic.",
    etapes: [
      { titre: "Le tour des frigos", texte: "Températures : choisis Matin ou Soir, ajuste chaque équipement avec − et +, puis « Valider la tournée ». Une valeur hors norme demande une action corrective." },
      { titre: "Le nettoyage", texte: "Plan de nettoyage : coche chaque tâche faite. Les tâches sont réparties par fréquence (quotidienne, hebdomadaire…)." },
      { titre: "La traçabilité", texte: "Photographie l'étiquette de chaque produit entamé (lot, DLC). La photo est rangée dans le registre." },
      { titre: "Les étiquettes DLC", texte: "Choisis le produit : la date limite est calculée selon sa catégorie. Elle ne peut être modifiée qu'à la baisse." },
      { titre: "Refroidissements et cuissons", texte: "Note l'heure et la température de départ et d'arrivée : Juliette vérifie les seuils (par exemple de +63 °C à +10 °C en moins de 2 h)." },
      { titre: "Huiles de friture", texte: "Enregistre contrôles, filtrations et changements d'huile, ainsi que la collecte par ton prestataire." },
      { titre: "Préparer un contrôle", texte: "Historique & export : filtre la période et exporte le registre (CSV, ou copie directe dans Google Sheets)." },
    ],
    astuces: ["Les relevés sont horodatés par le serveur et ne peuvent pas être antidatés : c'est ce qui leur donne de la valeur en cas de contrôle."],
  },
  {
    id: "stocks",
    titre: "Stocks et inventaire",
    icone: "stock",
    pour: "Responsables",
    href: "/inventaire",
    resume: "Le stock théorique de chaque produit, calculé en continu : dernier inventaire + réceptions − pertes − ventes en salle.",
    etapes: [
      { titre: "Importer le catalogue", texte: "« Importer depuis Excel » : dépose l'export de ton grossiste ou le modèle Juliette. Vérifie l'aperçu (catégorie, prix, doublons), puis importe. Les produits déjà présents sont mis à jour sans créer de doublon." },
      { titre: "Classer les produits", texte: "Chaque produit a une famille (Frais, Surgelé, Épicerie sèche, Boissons, Non alimentaire) et une sous-catégorie (Fromages, Légumes, Viandes…). « Classer automatiquement » range en une fois les produits qui ne le sont pas encore." },
      { titre: "Faire l'inventaire", texte: "Onglet « Faire l'inventaire » : choisis la zone, saisis ce que tu comptes (0 si le produit est absent, vide si tu ne l'as pas compté), puis enregistre." },
      { titre: "Suivre les alertes", texte: "Renseigne un seuil d'alerte et un niveau cible dans la fiche produit : les produits sous le seuil remontent en tête et au tableau de bord. « + Commander » les ajoute à la liste de commande." },
    ],
    astuces: ["Filtre par famille avec les onglets au-dessus du tableau, puis par sous-catégorie."],
  },
  {
    id: "pertes",
    titre: "Pertes",
    icone: "baisse",
    pour: "Tout le monde",
    href: "/perte",
    resume: "Casse, DLC dépassée, erreur de préparation, retour client : chaque perte sort du stock et se chiffre en euros.",
    etapes: [
      { titre: "Déclarer une perte", texte: "« Déclarer une perte » : produit, quantité, motif et précision." },
      { titre: "Analyser", texte: "Les graphiques montrent les pertes par motif et les produits les plus perdus sur la période." },
    ],
  },
  {
    id: "commandes",
    titre: "Commandes fournisseurs",
    icone: "camion",
    pour: "Responsables",
    href: "/aide-commande",
    resume: "Ce qu'il faut commander, chez qui et pour combien. La commande part par e-mail au fournisseur, avec ton adresse en réponse.",
    etapes: [
      { titre: "Remplir la liste", texte: "Les produits sous le seuil sont proposés avec la quantité qui ramène au niveau cible. Ajoute ou retire ce que tu veux." },
      { titre: "Envoyer", texte: "Les lignes sont regroupées par fournisseur. Vérifie le minimum de commande, puis « Envoyer » : le bon de commande part par e-mail." },
      { titre: "Suivre les réponses", texte: "Les réponses des fournisseurs arrivent dans la Boîte mail de Juliette." },
    ],
  },
  {
    id: "reception",
    titre: "Réception des livraisons",
    icone: "livraison_ok",
    pour: "Responsables",
    href: "/reception",
    resume: "À chaque livraison, compare ce qui arrive à ce qui a été commandé. Ce qui est reçu entre en stock ; les anomalies partent en réclamation.",
    etapes: [
      { titre: "Contrôler", texte: "Ouvre la commande livrée, note la température du camion et, pour chaque ligne : conforme, quantité différente, manquant, abîmé ou refusé." },
      { titre: "Réclamer", texte: "En cas d'anomalie, Juliette prépare le message de réclamation au fournisseur." },
    ],
  },
  {
    id: "salle",
    titre: "Salle : commandes et réservations",
    icone: "salle",
    pour: "Équipe de salle",
    href: "/commandes-clients",
    resume: "Prise de commande à la table, envoi en cuisine, vente à emporter et livraison, carnet de réservations et briefing du service.",
    etapes: [
      { titre: "Préparer la carte", texte: "Onglet Carte : les plats et leurs prix. Un plat lié à une fiche technique décompte ses ingrédients du stock à chaque vente." },
      { titre: "Prendre une commande", texte: "Onglet Salle : touche la table, ajoute les plats, envoie en cuisine. L'onglet Cuisine affiche les bons à préparer." },
      { titre: "À emporter et livraison", texte: "« À emporter » ou « Nouvelle livraison » : nom, heure souhaitée, adresse s'il y a lieu." },
      { titre: "Réservations", texte: "Note chaque réservation (nom, couverts, heure, remarques). Le briefing du service récapitule les allergies et les demandes particulières." },
    ],
  },
  {
    id: "fiches",
    titre: "Fiches techniques",
    icone: "cuisine",
    pour: "Cuisine et direction",
    href: "/fiche-technique",
    resume: "Recettes, grammages, étapes, photos et allergènes, avec le coût matière calculé en direct à partir des prix d'achat.",
    etapes: [
      { titre: "Créer une fiche", texte: "« + Nouvelle fiche » : nom, nombre de portions, ingrédients (choisis dans le catalogue) et étapes." },
      { titre: "Suivre le coût", texte: "Le coût par portion et le ratio avec le prix de vente se mettent à jour quand un prix fournisseur change." },
      { titre: "Utiliser le calculateur", texte: "Indique ce qu'il te reste d'un ingrédient : Juliette calcule combien de portions tu peux encore produire." },
    ],
  },
  {
    id: "finance",
    titre: "Finance",
    icone: "euro",
    pour: "Directeur",
    href: "/finance",
    resume: "Chiffre d'affaires par jour, meilleures ventes, coût matière, pertes et masse salariale, avec une prévision des 7 prochains jours.",
    etapes: [
      { titre: "Lire la période", texte: "Choisis la période : les ventes viennent de la salle Juliette et de ta caisse connectée." },
      { titre: "Anticiper", texte: "La prévision tient compte des ventes passées et des événements à venir (matchs, marchés, jours fériés…)." },
    ],
  },
  {
    id: "evenements",
    titre: "Événements",
    icone: "evenement",
    pour: "Responsables",
    href: "/evenements",
    resume: "Concerts, matchs, marchés, jours fériés, météo : tout ce qui fait varier l'affluence, pour adapter le planning et les commandes.",
    etapes: [{ titre: "Ajouter un événement", texte: "Nom, date, lieu, type, et s'il fait monter ou baisser l'activité. Les jours fériés sont ajoutés automatiquement." }],
  },
  {
    id: "documentation",
    titre: "Documentation",
    icone: "livre",
    pour: "Tout le monde",
    href: "/documentation",
    resume: "Procédures, attestations, factures, contrats de maintenance : les documents du restaurant rangés par catégorie, avec leurs échéances.",
    etapes: [
      { titre: "Ajouter un document", texte: "Titre, catégorie, fichier et, s'il y a lieu, une date d'échéance (extincteurs, contrôle électrique…)." },
      { titre: "Limiter l'accès", texte: "« Responsables » réserve un document à l'encadrement. « Épingler » le garde en haut de la liste." },
    ],
  },
  {
    id: "boite-mail",
    titre: "Boîte mail",
    icone: "reception",
    pour: "Responsables",
    href: "/boite-mail",
    resume: "Chaque établissement a une adresse de réception : les réponses des fournisseurs y arrivent, rattachées à la commande concernée.",
    etapes: [{ titre: "Lire et classer", texte: "Filtre par fournisseur ou par commande, ouvre les pièces jointes (bons de livraison, factures)." }],
  },
  {
    id: "outils",
    titre: "Outils externes",
    icone: "lien",
    pour: "Directeur",
    href: "/outils",
    resume: "URSSAF, ONSS, banque, mutuelle, paie, comptabilité, caisse, livraison : les services du restaurant réunis, avec les liens et les identifiants de contrat.",
    etapes: [{ titre: "Ajouter un outil", texte: "« Choisir dans le catalogue » (France ou Belgique) ou ajoute un service libre. Ne note jamais de mot de passe ici." }],
  },
  {
    id: "parametres",
    titre: "Paramètres et accréditations",
    icone: "reglages",
    pour: "Tout le monde (établissement : directeur)",
    href: "/parametres",
    resume: "Ton profil et ton mot de passe, les informations du restaurant, les modules utilisés, la pointeuse, les e-mails de commande, la caisse et les niveaux d'accès.",
    etapes: [
      { titre: "Mon compte", texte: "Photo, coordonnées, mot de passe et affichage du menu (latéral ou horizontal)." },
      { titre: "Modules", texte: "Masque les modules dont l'établissement ne se sert pas : le menu s'allège pour toute l'équipe." },
      { titre: "Accréditations", texte: "Choisis, pour chaque niveau (directeur, responsable, salarié), les modules visibles." },
    ],
  },
];

export const FAQ: { q: string; r: string }[] = [
  { q: "Comment changer mon mot de passe ?", r: "Paramètres › Mon compte › Mot de passe. Il faut au moins 8 caractères." },
  { q: "Mes données sont-elles partagées entre mes restaurants ?", r: "Non. Chaque établissement a ses propres produits, son équipe et son registre HACCP. Un même compte peut simplement accéder à plusieurs établissements." },
  { q: "Est-ce que Juliette fonctionne sur téléphone ?", r: "Oui. Toutes les pages s'adaptent au téléphone, avec une barre d'accès rapide en bas de l'écran. Tu peux ajouter Juliette à l'écran d'accueil depuis le navigateur." },
  { q: "Puis-je exporter mes données ?", r: "Le registre HACCP et les pointages s'exportent en CSV, lisible dans Excel ou Google Sheets." },
  { q: "Mon fichier Excel n'est pas reconnu.", r: "Juliette lit les fichiers .xlsx et .csv. Pour un ancien fichier .xls, ouvre-le dans Excel et fais « Enregistrer sous » au format .xlsx. La première ligne doit contenir le titre des colonnes (Nom, Prix, Unité…)." },
  { q: "Comment résilier ou changer d'abonnement ?", r: "Paramètres › Abonnement : tu y retrouves tes factures et tu peux gérer ton abonnement à tout moment, sans engagement." },
];
