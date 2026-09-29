// Documents RH : modèles, champs de saisie et génération du texte (même format que les contrats).
// Pur (pas d'accès réseau). Les textes reprennent les mentions exigées par le Code du travail :
//   * règlement intérieur (art. L1321-1 et s.) : hygiène et sécurité, discipline et échelle des
//     sanctions (durée maximale de la mise à pied), droits de la défense, harcèlement moral et
//     sexuel, agissements sexistes, protection des lanceurs d'alerte ; formalités de dépôt ;
//   * convocation à entretien préalable (L1232-2, L1332-2) : objet, date, heure, lieu, droit d'être
//     assisté, délai de 5 jours ouvrables ;
//   * certificat de travail (L1234-19, D1234-6) : dates d'entrée et de sortie, emplois occupés,
//     maintien des garanties santé et prévoyance ;
//   * remise de matériel : aucune retenue sur salaire en cas de perte (sanction pécuniaire interdite, L1331-2).

import { briques, EMPLOIS, MATERIELS } from "@/lib/contrats";

const { eur, dateLongue, ou } = briques;

export type TypeDoc = "fiche_poste" | "remise_materiel" | "reglement" | "promesse" | "avertissement" | "convocation" | "certificat" | "attestation";
export type Valeur = string | string[] | boolean | LigneMateriel[];
export type LigneMateriel = { article: string; quantite: string; taille: string; etat: string };
export type Donnees = Record<string, Valeur>;

export type Champ = {
  cle: string;
  label: string;
  type: "texte" | "zone" | "date" | "heure" | "nombre" | "choix" | "liste" | "cases" | "materiel" | "oui_non";
  options?: [string, string][];
  aide?: string;
  placeholder?: string;
  requis?: boolean;
  si?: (d: Donnees) => boolean;
};

export type Contexte = {
  etablissement: { nom: string; adresse: string; siret: string; ville: string };
  directeur: string;
  salarie: { civilite: "M." | "Mme"; prenom: string; nom: string; fonction: string; date_embauche: string; nature: string } | null;
  /** Matériel prévu au dernier contrat du salarié (pour la remise de matériel). */
  materielContrat: string[];
};

export type Modele = {
  cle: TypeDoc;
  label: string;
  icone: string;
  description: string;
  /** requis : un salarié de l'équipe ; optionnel : salarié ou document générique ; candidat : nom saisi ; non : document d'établissement. */
  nominatif: "requis" | "optionnel" | "candidat" | "non";
  /** Le salarié signe (reçu, lu et approuvé…) ; sinon seul l'employeur signe (ou publication). */
  signatureSalarie: boolean;
  mentionSalarie?: string;
  champs: Champ[];
  defauts: (ctx: Contexte) => Donnees;
  generer: (d: Donnees, ctx: Contexte) => string;
};

const s = (d: Donnees, k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
const l = (d: Donnees, k: string) => (Array.isArray(d[k]) ? (d[k] as string[]).filter((x) => typeof x === "string" && x.trim()) : []);
const b = (d: Donnees, k: string) => d[k] === true;
const puces = (items: string[]) => items.map((x) => `- ${x}`).join("\n");
const nomSal = (ctx: Contexte) => (ctx.salarie ? `${ctx.salarie.civilite === "Mme" ? "Madame" : "Monsieur"} ${ctx.salarie.prenom} ${ctx.salarie.nom.toUpperCase()}` : "[salarié]");
const leSal = (ctx: Contexte) => (ctx.salarie?.civilite === "Mme" ? "la salariée" : "le salarié");
const e = (ctx: Contexte) => (ctx.salarie?.civilite === "Mme" ? "e" : "");
const posteDe = (f: string, civ?: string) => {
  const x = f.split(" / ");
  return x.length === 2 ? x[civ === "Mme" ? 1 : 0] : f;
};
const employeur = (ctx: Contexte) => `**${ctx.etablissement.nom}**${ctx.etablissement.siret ? `, SIRET ${ctx.etablissement.siret}` : ""}, ${ctx.etablissement.adresse || "[adresse]"}`;
const fait = (d: Donnees, ctx: Contexte) => `Fait à ${ou(s(d, "fait_a") || ctx.etablissement.ville)}, le ${dateLongue(s(d, "fait_le"))}.`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const CHAMPS_FIN: Champ[] = [
  { cle: "fait_a", label: "Fait à", type: "texte" },
  { cle: "fait_le", label: "Le", type: "date" },
];

// ——— Fiche de poste : missions types par emploi ———

type Trame = { finalite: string; missions: string[]; taches: string[]; competences: string[]; conditions: string[] };
const TRAMES: Record<string, Trame> = {
  salle: {
    finalite: "Assurer l'accueil et le service des clients en salle, dans le respect des standards de qualité de l'établissement.",
    missions: ["Accueillir et installer les clients", "Présenter la carte, conseiller et prendre les commandes", "Servir les plats et les boissons", "Encaisser et prendre congé des clients", "Veiller à la propreté et à la mise en place de la salle"],
    taches: ["Ouverture : mise en place des tables, des consoles et de la terrasse", "Service : accueil, prise de commande, envoi en cuisine, service, débarrassage", "Fermeture : nettoyage de la salle, réassort, rangement"],
    competences: ["Sens de l'accueil et du service", "Connaissance des règles de service à table", "Aisance à l'oral, gestion des réclamations", "Maîtrise de la caisse et du terminal de commande"],
    conditions: ["Station debout prolongée et port de plateaux", "Travail en soirée, le week-end et les jours fériés", "Port de la tenue fournie"],
  },
  bar: {
    finalite: "Préparer et servir les boissons, animer le bar et contribuer à la satisfaction des clients.",
    missions: ["Préparer les boissons chaudes, fraîches et cocktails", "Tenir le bar propre et approvisionné", "Gérer les stocks du bar et signaler les besoins", "Encaisser les consommations au comptoir", "Appliquer la réglementation sur la vente d'alcool (mineurs, ivresse)"],
    taches: ["Ouverture : mise en place, réassort des frigos, préparation des garnitures", "Service : préparation et envoi des boissons, service au comptoir", "Fermeture : nettoyage du bar et des tireuses, inventaire rapide"],
    competences: ["Connaissance des boissons et des techniques de bar", "Rapidité et organisation", "Respect des règles d'hygiène"],
    conditions: ["Station debout, manipulation de fûts et caisses", "Travail en soirée et le week-end"],
  },
  cuisine: {
    finalite: "Préparer les plats de la carte selon les fiches techniques, dans le respect des règles d'hygiène et de sécurité alimentaire.",
    missions: ["Réaliser la mise en place de son poste", "Préparer et dresser les plats selon les fiches techniques", "Appliquer le plan de maîtrise sanitaire (HACCP) : températures, traçabilité, DLC", "Réceptionner et ranger les marchandises", "Nettoyer et entretenir son poste et le matériel"],
    taches: ["Avant le service : épluchage, taillage, cuissons de base, mise en place", "Service : cuisson, dressage, envoi des plats", "Après le service : refroidissement, étiquetage, nettoyage du poste"],
    competences: ["Techniques culinaires de base", "Respect des fiches techniques et des grammages", "Règles d'hygiène HACCP", "Rapidité et travail en équipe"],
    conditions: ["Chaleur, station debout prolongée, port de charges", "Utilisation d'outils tranchants et d'appareils chauds", "Port de la tenue et des chaussures de sécurité fournies"],
  },
  plonge: {
    finalite: "Assurer la propreté de la vaisselle, des ustensiles et des locaux de cuisine.",
    missions: ["Laver la vaisselle, la batterie de cuisine et les ustensiles", "Ranger la vaisselle propre", "Nettoyer les locaux de cuisine selon le plan de nettoyage", "Évacuer et trier les déchets", "Aider à la réception des marchandises et aux préparations simples"],
    taches: ["Service : plonge vaisselle et batterie en continu", "Fermeture : nettoyage des sols, des surfaces et du lave-vaisselle"],
    competences: ["Organisation et rapidité", "Respect des produits d'entretien et des dosages", "Règles d'hygiène"],
    conditions: ["Humidité, station debout, port de charges", "Utilisation de produits d'entretien (gants et équipements fournis)"],
  },
  encadrement: {
    finalite: "Organiser et encadrer l'activité de son secteur pour garantir la qualité du service et la rentabilité.",
    missions: ["Organiser le travail et les plannings de l'équipe", "Former, accompagner et évaluer les collaborateurs", "Veiller à la qualité du service et à la satisfaction des clients", "Suivre les stocks, les commandes et les coûts", "Faire respecter les règles d'hygiène, de sécurité et le règlement intérieur"],
    taches: ["Briefing d'avant-service, répartition des postes", "Supervision du service et gestion des imprévus", "Clôture : caisse, bilan, préparation du lendemain"],
    competences: ["Management d'équipe", "Maîtrise des outils de gestion (planning, stock, caisse)", "Sens des responsabilités et de l'organisation"],
    conditions: ["Horaires variables, soirées, week-ends et jours fériés", "Disponibilité en cas d'imprévu"],
  },
};

function trameDe(poste: string): Trame {
  const em = EMPLOIS.find((x) => x.intitule === poste || posteDe(x.intitule) === poste || posteDe(x.intitule, "Mme") === poste);
  const p = poste.toLowerCase();
  if (p.includes("plong")) return TRAMES.plonge;
  if (em?.famille === "Bar" || p.includes("bar")) return TRAMES.bar;
  if (em?.famille === "Cuisine" || /cuisin|commis|chef de partie|pâtiss|second/.test(p)) return TRAMES.cuisine;
  if (em?.famille === "Encadrement" || /manager|responsable|directeur|maître/.test(p)) return TRAMES.encadrement;
  return TRAMES.salle;
}

export const MODELES_DOCS: Record<TypeDoc, Modele> = {
  fiche_poste: {
    cle: "fiche_poste",
    label: "Fiche de poste",
    icone: "📋",
    description: "Missions, tâches, compétences et conditions de travail d'un poste.",
    nominatif: "optionnel",
    signatureSalarie: true,
    mentionSalarie: "Lu et pris connaissance",
    champs: [
      { cle: "poste", label: "Intitulé du poste", type: "texte", requis: true },
      { cle: "service", label: "Service", type: "choix", options: [["Salle", "Salle"], ["Bar", "Bar"], ["Cuisine", "Cuisine"], ["Plonge", "Plonge"], ["Direction", "Direction"]] },
      { cle: "rattachement", label: "Rattaché à (supérieur hiérarchique)", type: "texte", placeholder: "ex. Responsable de salle" },
      { cle: "classification", label: "Statut / classification", type: "texte", placeholder: "ex. Employé, niveau I, échelon 3" },
      { cle: "finalite", label: "Finalité du poste", type: "zone" },
      { cle: "missions", label: "Missions principales (une par ligne)", type: "liste" },
      { cle: "taches", label: "Tâches par moment de la journée (une par ligne)", type: "liste" },
      { cle: "competences", label: "Compétences et savoir-être attendus (une par ligne)", type: "liste" },
      { cle: "conditions", label: "Conditions de travail (une par ligne)", type: "liste" },
      { cle: "horaires", label: "Horaires / organisation", type: "texte", placeholder: "ex. Selon planning, 2 jours de repos consécutifs" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => {
      const poste = ctx.salarie ? posteDe(ctx.salarie.fonction, ctx.salarie.civilite) : "";
      const t = trameDe(poste);
      return { poste, service: t === TRAMES.cuisine ? "Cuisine" : t === TRAMES.bar ? "Bar" : t === TRAMES.plonge ? "Plonge" : t === TRAMES.encadrement ? "Direction" : "Salle", rattachement: "", classification: "", finalite: t.finalite, missions: t.missions, taches: t.taches, competences: t.competences, conditions: t.conditions, horaires: "Selon le planning communiqué, dans le respect de la durée du travail prévue au contrat.", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() };
    },
    generer: (d, ctx) =>
      [
        `# Fiche de poste`,
        `#> ${ou(s(d, "poste"))} · ${ctx.etablissement.nom}`,
        ctx.salarie ? `**Titulaire du poste :** ${nomSal(ctx)}` : "",
        `**Service :** ${ou(s(d, "service"))}${s(d, "rattachement") ? ` · **Rattaché à :** ${s(d, "rattachement")}` : ""}${s(d, "classification") ? ` · **Classification :** ${s(d, "classification")}` : ""}`,
        "## Finalité du poste",
        ou(s(d, "finalite")),
        "## Missions principales",
        puces(l(d, "missions")) || "[à compléter]",
        "## Tâches et organisation",
        puces(l(d, "taches")) || "[à compléter]",
        s(d, "horaires") && `**Horaires :** ${s(d, "horaires")}`,
        "## Compétences et savoir-être",
        puces(l(d, "competences")) || "[à compléter]",
        "## Conditions de travail",
        puces(l(d, "conditions")) || "[à compléter]",
        "Cette fiche décrit les missions habituelles du poste. Elle n'est pas exhaustive et pourra évoluer selon les besoins du service, sans modifier la qualification prévue au contrat de travail.",
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n"),
  },

  remise_materiel: {
    cle: "remise_materiel",
    label: "Remise de matériel",
    icone: "🧰",
    description: "Fiche de perception : le salarié atteste avoir reçu tenues et équipements.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Reçu le matériel ci-dessus en bon état",
    champs: [
      { cle: "date_remise", label: "Date de remise", type: "date" },
      { cle: "lignes", label: "Matériel remis", type: "materiel" },
      { cle: "entretien", label: "Entretien des tenues", type: "choix", options: [["entreprise", "Assuré par l'entreprise"], ["salarie", "Assuré par le salarié (prime d'entretien)"]] },
      { cle: "remarques", label: "Remarques (facultatif)", type: "zone" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({
      date_remise: aujourdhui(),
      lignes: (ctx.materielContrat.length ? ctx.materielContrat : ["Tablier"]).map((m) => ({ article: m, quantite: m.toLowerCase().includes("tenue") || m.toLowerCase().includes("veste") || m.toLowerCase().includes("tablier") ? "2" : "1", taille: "", etat: "Neuf" })),
      entretien: "entreprise",
      remarques: "",
      fait_a: ctx.etablissement.ville,
      fait_le: aujourdhui(),
    }),
    generer: (d, ctx) => {
      const lignes = (Array.isArray(d.lignes) ? (d.lignes as LigneMateriel[]) : []).filter((x) => x.article?.trim());
      return [
        "# Fiche de remise de matériel",
        `#> ${ctx.etablissement.nom}`,
        `L'entreprise ${employeur(ctx)}, remet ce jour, le ${dateLongue(s(d, "date_remise"))}, à ${nomSal(ctx)}, ${ctx.salarie ? posteDe(ctx.salarie.fonction, ctx.salarie.civilite) : "[poste]"}, le matériel et les équipements suivants :`,
        lignes.length ? lignes.map((x) => `- **${x.article}** · quantité : ${ou(x.quantite, "1")}${x.taille?.trim() ? ` · taille : ${x.taille.trim()}` : ""} · état : ${ou(x.etat, "bon état")}`).join("\n") : "- [matériel à compléter]",
        "## Engagements",
        `${leSal(ctx).charAt(0).toUpperCase() + leSal(ctx).slice(1)} s'engage à utiliser ce matériel dans le cadre exclusif de son travail, à en prendre soin et à le porter ou l'utiliser conformément aux consignes d'hygiène et de sécurité.`,
        s(d, "entretien") === "salarie" ? `L'entretien des tenues est assuré par ${leSal(ctx)}, qui perçoit à ce titre la prime d'entretien prévue à son contrat.` : "L'entretien des tenues est assuré par l'entreprise.",
        `Ce matériel reste la propriété de l'entreprise et devra être restitué au plus tard le dernier jour de travail. Toute perte ou détérioration doit être signalée sans délai ; conformément à l'article L1331-2 du Code du travail, aucune retenue sur salaire ne peut être opérée à ce titre.`,
        s(d, "remarques").trim() && `**Remarques :** ${s(d, "remarques").trim()}`,
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  },

  reglement: {
    cle: "reglement",
    label: "Règlement intérieur",
    icone: "📜",
    description: "Obligatoire dès 50 salariés (France). Hygiène, sécurité, discipline, harcèlement.",
    nominatif: "non",
    signatureSalarie: false,
    champs: [
      { cle: "date_vigueur", label: "Date d'entrée en vigueur", type: "date", aide: "Au moins un mois après le dépôt au greffe et l'envoi à l'inspection du travail." },
      { cle: "alcool", label: "Boissons alcoolisées", type: "choix", options: [["interdit", "Interdites sur le lieu de travail"], ["repas", "Tolérées au repas (vin, bière, cidre), avec modération"]] },
      { cle: "controle_alcool", label: "Contrôle d'alcoolémie possible pour les postes à risque", type: "oui_non" },
      { cle: "postes_risque", label: "Postes concernés par le contrôle", type: "texte", placeholder: "ex. cuisine (appareils de cuisson), livraison", si: (d) => d.controle_alcool === true },
      { cle: "telephone", label: "Téléphone personnel pendant le service", type: "choix", options: [["interdit", "Interdit en salle et en cuisine, sauf urgence"], ["pause", "Autorisé pendant les pauses uniquement"]] },
      { cle: "pointage", label: "Pointage des arrivées et départs obligatoire", type: "oui_non" },
      { cle: "mise_a_pied_jours", label: "Durée maximale de la mise à pied disciplinaire (jours)", type: "nombre", aide: "Obligatoire : sans durée maximale, la mise à pied ne peut pas être appliquée." },
      { cle: "referent_harcelement", label: "Référent harcèlement / agissements sexistes (facultatif)", type: "texte" },
      { cle: "clauses", label: "Dispositions propres à l'établissement (une par ligne)", type: "liste" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ date_vigueur: "", alcool: "interdit", controle_alcool: false, postes_risque: "", telephone: "pause", pointage: true, mise_a_pied_jours: "3", referent_harcelement: "", clauses: [], fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) => {
      let n = 0;
      const art = (t: string) => `## Article ${++n} – ${t}`;
      const jours = s(d, "mise_a_pied_jours") || "[à compléter]";
      return [
        "# Règlement intérieur",
        `#> ${ctx.etablissement.nom} · établi en application des articles L1321-1 et suivants du Code du travail`,
        art("Objet et champ d'application"),
        "Le présent règlement fixe les règles relatives à l'hygiène et à la sécurité, les règles générales et permanentes relatives à la discipline, la nature et l'échelle des sanctions, ainsi que les garanties de procédure dont bénéficient les salariés. Il s'applique à l'ensemble des salariés, y compris les salariés en contrat à durée déterminée, les extras et les stagiaires, dans tous les locaux de l'établissement.",
        art("Hygiène et sécurité alimentaire"),
        "Chaque salarié respecte les consignes d'hygiène du plan de maîtrise sanitaire (HACCP) : lavage des mains, port de la tenue propre fournie, relevés de températures, traçabilité et étiquetage, respect des dates limites. Tout salarié atteint d'une affection transmissible (gastro-entérite, plaie infectée…) en informe sa hiérarchie avant sa prise de poste.",
        art("Sécurité"),
        puces([
          "Les consignes de sécurité et d'utilisation des équipements (appareils de cuisson, trancheurs, produits d'entretien) sont obligatoires.",
          "Les équipements de protection fournis (chaussures de sécurité, gants…) doivent être portés.",
          "Tout accident, même bénin, est signalé immédiatement au responsable.",
          "Les issues de secours et les extincteurs restent dégagés en permanence.",
          "Tout salarié qui a un motif raisonnable de penser qu'une situation présente un danger grave et imminent pour sa vie ou sa santé en alerte immédiatement l'employeur et peut se retirer de cette situation (droit d'alerte et de retrait, art. L4131-1).",
        ]),
        art("Alcool, drogues et tabac"),
        s(d, "alcool") === "repas" ? "L'introduction et la consommation de boissons alcoolisées sont interdites, à l'exception du vin, de la bière et du cidre consommés avec modération au moment des repas. Il est interdit de pénétrer ou de demeurer dans l'établissement en état d'ivresse." : "L'introduction et la consommation de boissons alcoolisées sont interdites sur le lieu de travail, y compris pendant les repas du personnel. Il est interdit de pénétrer ou de demeurer dans l'établissement en état d'ivresse.",
        b(d, "controle_alcool") && `Pour les postes où l'état d'ébriété présente un danger pour le salarié ou pour autrui (${ou(s(d, "postes_risque"))}), un contrôle d'alcoolémie peut être pratiqué par un responsable. Le salarié peut demander l'assistance d'un tiers et une contre-expertise.`,
        "La consommation et la détention de stupéfiants sont interdites. Il est interdit de fumer ou de vapoter dans les locaux fermés, conformément à la loi.",
        art("Discipline et organisation du travail"),
        puces([
          "Les salariés respectent les horaires communiqués par le planning.",
          b(d, "pointage") ? "Chaque salarié pointe personnellement ses arrivées, départs et pauses ; pointer pour un collègue est interdit." : "Les arrivées et départs sont enregistrés selon les consignes de l'établissement.",
          "Toute absence est justifiée dans les 48 heures ; en cas d'empêchement, le responsable est prévenu au plus tôt.",
          s(d, "telephone") === "interdit" ? "L'usage du téléphone personnel est interdit en salle et en cuisine pendant le service, sauf urgence." : "L'usage du téléphone personnel est réservé aux temps de pause.",
          "La tenue fournie est portée propre et complète ; les bijoux pouvant présenter un risque d'hygiène sont retirés en cuisine.",
          "Les consommations et repas sont pris aux horaires et dans les conditions prévus ; aucun produit ne sort de l'établissement sans autorisation.",
          "Le salarié fait preuve de correction envers la clientèle et ses collègues.",
          ...l(d, "clauses"),
        ]),
        art("Harcèlement et agissements sexistes"),
        "Aucun salarié ne doit subir des agissements répétés de harcèlement moral ayant pour objet ou pour effet une dégradation de ses conditions de travail (art. L1152-1), ni des faits de harcèlement sexuel (art. L1153-1). Nul ne doit subir d'agissement sexiste (art. L1142-2-1). Aucun salarié ne peut être sanctionné pour avoir subi, refusé de subir, témoigné de tels agissements ou les avoir relatés. Tout salarié ayant procédé à de tels agissements est passible d'une sanction disciplinaire.",
        s(d, "referent_harcelement").trim() && `Référent en matière de lutte contre le harcèlement et les agissements sexistes : ${s(d, "referent_harcelement").trim()}.`,
        art("Protection des lanceurs d'alerte"),
        "Conformément à la loi, aucun salarié ne peut être sanctionné, licencié ou faire l'objet d'une mesure discriminatoire pour avoir signalé ou divulgué, de bonne foi, des informations sur un crime, un délit ou une menace pour l'intérêt général dont il a eu connaissance.",
        art("Sanctions disciplinaires"),
        `Tout manquement au présent règlement ou aux obligations professionnelles peut faire l'objet de l'une des sanctions suivantes, selon la gravité des faits :\n${puces(["observation écrite ;", "avertissement ;", `mise à pied disciplinaire sans salaire, d'une durée maximale de ${jours} jour(s) ouvrable(s) ;`, "mutation ou rétrogradation disciplinaire ;", "licenciement pour faute simple, grave ou lourde."])}`,
        "Cette échelle ne constitue pas une gradation obligatoire. Aucune amende ni sanction pécuniaire ne peut être infligée (art. L1331-2).",
        art("Droits de la défense"),
        "Toute sanction autre qu'une observation ou un avertissement est précédée d'une convocation à un entretien préalable, indiquant l'objet, la date, l'heure et le lieu de l'entretien, et rappelant que le salarié peut se faire assister par une personne de son choix appartenant au personnel de l'entreprise. La sanction ne peut intervenir moins de deux jours ouvrables ni plus d'un mois après l'entretien ; elle est motivée et notifiée par écrit. Aucun fait fautif ne peut donner lieu à lui seul à des poursuites disciplinaires au-delà de deux mois à compter du jour où l'employeur en a eu connaissance (art. L1332-1 et suivants).",
        art("Entrée en vigueur"),
        `Le présent règlement entre en vigueur le ${dateLongue(s(d, "date_vigueur"))}. Il a été soumis à l'avis du comité social et économique, déposé au greffe du conseil de prud'hommes, communiqué à l'inspection du travail et porté à la connaissance du personnel par affichage et par Juliette.`,
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  },

  promesse: {
    cle: "promesse",
    label: "Promesse d'embauche",
    icone: "🤝",
    description: "Offre ferme de contrat adressée à un candidat.",
    nominatif: "candidat",
    signatureSalarie: false,
    champs: [
      { cle: "candidat_civilite", label: "Civilité", type: "choix", options: [["M.", "Monsieur"], ["Mme", "Madame"]] },
      { cle: "candidat_nom", label: "Prénom et nom du candidat", type: "texte", requis: true },
      { cle: "candidat_adresse", label: "Adresse du candidat", type: "texte" },
      { cle: "poste", label: "Poste proposé", type: "texte", requis: true },
      { cle: "contrat", label: "Type de contrat", type: "choix", options: [["CDI", "CDI"], ["CDD", "CDD"], ["Extra", "Extra (CDD d'usage)"]] },
      { cle: "heures", label: "Heures par semaine", type: "nombre" },
      { cle: "remuneration", label: "Rémunération brute", type: "texte", placeholder: "ex. 12,30 € de l'heure, soit 1 865,55 € par mois" },
      { cle: "date_entree", label: "Date d'entrée", type: "date" },
      { cle: "lieu", label: "Lieu de travail", type: "texte" },
      { cle: "essai", label: "Période d'essai", type: "texte", placeholder: "ex. 2 mois" },
      { cle: "delai", label: "Réponse attendue avant le", type: "date" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ candidat_civilite: "M.", candidat_nom: "", candidat_adresse: "", poste: "", contrat: "CDI", heures: "35", remuneration: "", date_entree: "", lieu: [ctx.etablissement.nom, ctx.etablissement.adresse].filter(Boolean).join(", "), essai: "2 mois", delai: "", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) =>
      [
        "# Promesse d'embauche",
        `#> ${ctx.etablissement.nom}`,
        `**À l'attention de ${s(d, "candidat_civilite") === "Mme" ? "Madame" : "Monsieur"} ${ou(s(d, "candidat_nom"))}**${s(d, "candidat_adresse") ? `, ${s(d, "candidat_adresse")}` : ""}`,
        `${s(d, "candidat_civilite") === "Mme" ? "Madame" : "Monsieur"},`,
        `À la suite de nos échanges, nous avons le plaisir de vous confirmer notre engagement de vous embaucher aux conditions suivantes :`,
        puces([
          `Poste : **${ou(s(d, "poste"))}**`,
          `Contrat : ${ou(s(d, "contrat"))}${s(d, "heures") ? `, ${s(d, "heures")} heures par semaine` : ""}`,
          `Rémunération : ${ou(s(d, "remuneration"))}`,
          `Date d'entrée : ${dateLongue(s(d, "date_entree"))}`,
          `Lieu de travail : ${ou(s(d, "lieu"))}`,
          s(d, "essai") ? `Période d'essai : ${s(d, "essai")}` : "Sans période d'essai",
        ]),
        "Cette promesse vaut engagement ferme de notre part. Le contrat de travail, reprenant ces éléments, vous sera remis au plus tard lors de votre prise de fonctions.",
        `Nous vous remercions de nous faire connaître votre réponse avant le ${dateLongue(s(d, "delai"))} ; passé ce délai, la présente proposition sera caduque.`,
        `Veuillez agréer, ${s(d, "candidat_civilite") === "Mme" ? "Madame" : "Monsieur"}, l'expression de nos salutations distinguées.`,
        fait(d, ctx),
      ].join("\n\n"),
  },

  avertissement: {
    cle: "avertissement",
    label: "Avertissement",
    icone: "⚠️",
    description: "Sanction écrite pour un manquement, remise contre décharge.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Reçu en main propre (sans valoir acceptation)",
    champs: [
      { cle: "date_faits", label: "Date des faits", type: "date", aide: "Les faits doivent dater de moins de deux mois." },
      { cle: "faits", label: "Faits reprochés (précis et datés)", type: "zone", requis: true },
      { cle: "regle", label: "Règle ou obligation méconnue", type: "texte", placeholder: "ex. article 5 du règlement intérieur (horaires)" },
      { cle: "antecedents", label: "Rappels antérieurs (facultatif)", type: "texte" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ date_faits: "", faits: "", regle: "", antecedents: "", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) =>
      [
        "# Avertissement",
        `#> ${ctx.etablissement.nom} · lettre remise en main propre contre décharge`,
        `**${nomSal(ctx)}**, ${ctx.salarie ? posteDe(ctx.salarie.fonction, ctx.salarie.civilite) : ""}`,
        `${ctx.salarie?.civilite === "Mme" ? "Madame" : "Monsieur"},`,
        `Nous avons constaté le ${dateLongue(s(d, "date_faits"))} les faits suivants : ${ou(s(d, "faits"))}`,
        s(d, "regle") && `Ces faits constituent un manquement à ${s(d, "regle")}.`,
        s(d, "antecedents") && `Nous vous rappelons que ${s(d, "antecedents")}.`,
        "Ce comportement n'est pas acceptable et perturbe le bon fonctionnement de l'établissement. Nous vous notifions en conséquence, par la présente, un **avertissement**, qui sera versé à votre dossier personnel.",
        "Nous comptons sur vous pour que de tels faits ne se reproduisent pas. À défaut, nous pourrions être amenés à prendre une sanction plus grave.",
        `Veuillez agréer, ${ctx.salarie?.civilite === "Mme" ? "Madame" : "Monsieur"}, l'expression de nos salutations distinguées.`,
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n"),
  },

  convocation: {
    cle: "convocation",
    label: "Convocation à entretien préalable",
    icone: "📅",
    description: "Avant une sanction importante ou un licenciement. Délai de 5 jours ouvrables.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Reçu en main propre",
    champs: [
      { cle: "objet", label: "Objet", type: "choix", options: [["sanction", "Éventuelle sanction disciplinaire"], ["licenciement", "Éventuel licenciement"]] },
      { cle: "date_entretien", label: "Date de l'entretien", type: "date", aide: "Au moins 5 jours ouvrables après la remise de la convocation." },
      { cle: "heure_entretien", label: "Heure", type: "heure" },
      { cle: "lieu_entretien", label: "Lieu", type: "texte" },
      { cle: "representants", label: "L'entreprise a-t-elle des représentants du personnel (CSE) ?", type: "oui_non" },
      { cle: "mise_a_pied_conservatoire", label: "Mise à pied conservatoire jusqu'à la décision", type: "oui_non" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ objet: "sanction", date_entretien: "", heure_entretien: "10:00", lieu_entretien: [ctx.etablissement.nom, ctx.etablissement.adresse].filter(Boolean).join(", "), representants: false, mise_a_pied_conservatoire: false, fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) => {
      const lic = s(d, "objet") === "licenciement";
      return [
        "# Convocation à un entretien préalable",
        `#> ${ctx.etablissement.nom} · lettre remise en main propre contre décharge`,
        `**${nomSal(ctx)}**`,
        `${ctx.salarie?.civilite === "Mme" ? "Madame" : "Monsieur"},`,
        `Nous envisageons à votre égard ${lic ? "une mesure de licenciement" : "une sanction disciplinaire"}. En application des articles ${lic ? "L1232-2 et suivants" : "L1332-2"} du Code du travail, nous vous convoquons à un entretien préalable qui se tiendra :`,
        puces([`le **${dateLongue(s(d, "date_entretien"))}** à **${ou(s(d, "heure_entretien")).replace(":", " h ")}**`, `à ${ou(s(d, "lieu_entretien"))}`]),
        "Au cours de cet entretien, nous vous exposerons les motifs de la décision envisagée et recueillerons vos explications.",
        b(d, "representants") || !lic
          ? "Vous pouvez vous faire assister lors de cet entretien par une personne de votre choix appartenant au personnel de l'entreprise."
          : "Vous pouvez vous faire assister lors de cet entretien par une personne de votre choix appartenant au personnel de l'entreprise ou, l'entreprise étant dépourvue de représentants du personnel, par un conseiller du salarié choisi sur la liste dressée par le préfet, consultable à l'inspection du travail et à la mairie de votre domicile.",
        b(d, "mise_a_pied_conservatoire") && `Compte tenu de la gravité des faits, nous vous notifions une **mise à pied conservatoire** à effet immédiat, dans l'attente de la décision à intervenir.`,
        `Veuillez agréer, ${ctx.salarie?.civilite === "Mme" ? "Madame" : "Monsieur"}, l'expression de nos salutations distinguées.`,
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  },

  certificat: {
    cle: "certificat",
    label: "Certificat de travail",
    icone: "🎓",
    description: "À remettre à tout salarié à la fin de son contrat.",
    nominatif: "requis",
    signatureSalarie: false,
    champs: [
      { cle: "date_entree", label: "Date d'entrée", type: "date" },
      { cle: "date_sortie", label: "Date de sortie (fin du préavis)", type: "date" },
      { cle: "emplois", label: "Emplois occupés et périodes (un par ligne)", type: "liste", placeholder: "ex. Commis de cuisine du 1er mars 2024 au 31 août 2025" },
      { cle: "portabilite", label: "Maintien des garanties santé et prévoyance (portabilité)", type: "oui_non" },
      { cle: "organisme", label: "Organisme assureur (santé / prévoyance)", type: "texte", si: (d) => d.portabilite === true },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ date_entree: ctx.salarie?.date_embauche ?? "", date_sortie: "", emplois: ctx.salarie ? [`${posteDe(ctx.salarie.fonction, ctx.salarie.civilite)}`] : [], portabilite: true, organisme: "", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) =>
      [
        "# Certificat de travail",
        `#> ${ctx.etablissement.nom}`,
        `Je soussigné(e) ${ou(ctx.directeur)}, agissant pour le compte de l'entreprise ${employeur(ctx)}, certifie que ${nomSal(ctx)} a été employé${e(ctx)} dans notre entreprise du **${dateLongue(s(d, "date_entree"))}** au **${dateLongue(s(d, "date_sortie"))}**, en qualité de :`,
        puces(l(d, "emplois")) || "- [emploi à compléter]",
        b(d, "portabilite")
          ? `${ctx.salarie?.civilite === "Mme" ? "L'intéressée" : "L'intéressé"} bénéficie, sous réserve d'être pris${e(ctx)} en charge par l'assurance chômage, du maintien à titre gratuit des garanties de complémentaire santé et de prévoyance en vigueur dans l'entreprise, pour une durée égale à celle de son dernier contrat, dans la limite de 12 mois (art. L911-8 du Code de la sécurité sociale)${s(d, "organisme") ? ` ; organisme assureur : ${s(d, "organisme")}` : ""}.`
          : "",
        `${nomSal(ctx)} nous quitte libre de tout engagement.`,
        "Certificat délivré pour servir et valoir ce que de droit.",
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n"),
  },

  attestation: {
    cle: "attestation",
    label: "Attestation employeur",
    icone: "🧾",
    description: "Atteste que la personne est employée (logement, banque, démarches).",
    nominatif: "requis",
    signatureSalarie: false,
    champs: [
      { cle: "date_entree", label: "Employé depuis le", type: "date" },
      { cle: "contrat", label: "Type de contrat", type: "texte" },
      { cle: "poste", label: "Poste", type: "texte" },
      { cle: "periode_essai_terminee", label: "Période d'essai terminée", type: "oui_non" },
      { cle: "salaire", label: "Salaire mensuel brut (facultatif)", type: "texte" },
      { cle: "motif", label: "Destinataire / motif (facultatif)", type: "texte", placeholder: "ex. pour une demande de logement" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ date_entree: ctx.salarie?.date_embauche ?? "", contrat: ctx.salarie?.nature ? ctx.salarie.nature.toUpperCase() : "CDI", poste: ctx.salarie ? posteDe(ctx.salarie.fonction, ctx.salarie.civilite) : "", periode_essai_terminee: true, salaire: "", motif: "", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) =>
      [
        "# Attestation employeur",
        `#> ${ctx.etablissement.nom}`,
        `Je soussigné(e) ${ou(ctx.directeur)}, agissant pour le compte de l'entreprise ${employeur(ctx)}, atteste que ${nomSal(ctx)} est employé${e(ctx)} dans notre entreprise depuis le **${dateLongue(s(d, "date_entree"))}**, en qualité de **${ou(s(d, "poste"))}**, sous contrat ${ou(s(d, "contrat"))}.`,
        b(d, "periode_essai_terminee") ? `${ctx.salarie?.civilite === "Mme" ? "L'intéressée" : "L'intéressé"} a terminé sa période d'essai et ne fait l'objet d'aucune procédure de licenciement ou de démission à ce jour.` : "",
        s(d, "salaire") && `Son salaire mensuel brut est de ${s(d, "salaire")}.`,
        `Attestation délivrée à la demande de l'intéressé${e(ctx)}${s(d, "motif") ? `, ${s(d, "motif")}` : ""}, pour servir et valoir ce que de droit.`,
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n"),
  },
};

export const ORDRE_DOCS: TypeDoc[] = ["fiche_poste", "remise_materiel", "reglement", "promesse", "avertissement", "convocation", "certificat", "attestation"];

/** Alertes légales propres à chaque document. */
export function alertesDoc(type: TypeDoc, d: Donnees): string[] {
  const a: string[] = [];
  const m = MODELES_DOCS[type];
  for (const c of m.champs) if (c.requis && !(typeof d[c.cle] === "string" ? (d[c.cle] as string).trim() : d[c.cle])) a.push(`${c.label} : à compléter.`);
  const jours = (x: string) => Math.round((new Date(x + "T12:00").getTime() - Date.now()) / 864e5);
  if (type === "convocation" && s(d, "date_entretien")) {
    if (jours(s(d, "date_entretien")) < 7) a.push("L'entretien doit se tenir au moins 5 jours ouvrables après la remise de la convocation (hors samedi, dimanche et jours fériés).");
  }
  if (type === "avertissement" && s(d, "date_faits") && jours(s(d, "date_faits")) < -60) a.push("Faits de plus de deux mois : ils sont prescrits et ne peuvent plus être sanctionnés seuls (art. L1332-4).");
  if (type === "reglement" && !Number(s(d, "mise_a_pied_jours"))) a.push("Indique la durée maximale de la mise à pied disciplinaire, sinon elle ne pourra pas être appliquée.");
  if (type === "reglement" && !s(d, "date_vigueur")) a.push("Indique la date d'entrée en vigueur (au moins un mois après les formalités de dépôt).");
  if (type === "certificat" && !s(d, "date_sortie")) a.push("Indique la date de sortie (fin du préavis, même non effectué).");
  return a;
}

export { eur, MATERIELS };
