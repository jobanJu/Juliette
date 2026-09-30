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
import type { NomIcone } from "@/components/Icone";
import { anciennete, calendrierRupture, indemniteLegale, joursEntre, preavisLegal, prevenanceEssai, ajouterOuvrables } from "@/lib/finContrat";
import { ajouterJours } from "@/lib/planning";

const { eur, dateLongue, ou } = briques;

export type TypeDoc =
  | "fiche_poste" | "remise_materiel" | "reglement" | "promesse" | "avertissement" | "convocation" | "certificat" | "attestation"
  | "licenciement" | "rupture_conventionnelle" | "rupture_essai" | "rupture_cdd" | "demission" | "solde_tout_compte";

export type GroupeDoc = "Embauche & quotidien" | "Discipline" | "Fin de contrat";
export const GROUPES_DOCS: GroupeDoc[] = ["Embauche & quotidien", "Discipline", "Fin de contrat"];
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
  icone: NomIcone;
  groupe: GroupeDoc;
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
    groupe: "Embauche & quotidien",
    label: "Fiche de poste",
    icone: "liste",
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
    groupe: "Embauche & quotidien",
    label: "Remise de matériel",
    icone: "outils",
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
    groupe: "Embauche & quotidien",
    label: "Règlement intérieur",
    icone: "parchemin",
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
    groupe: "Embauche & quotidien",
    label: "Promesse d'embauche",
    icone: "partenaire",
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
    groupe: "Discipline",
    label: "Avertissement",
    icone: "alerte",
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
    groupe: "Discipline",
    label: "Convocation à entretien préalable",
    icone: "calendrier",
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
    groupe: "Fin de contrat",
    label: "Certificat de travail",
    icone: "formation",
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
    groupe: "Embauche & quotidien",
    label: "Attestation employeur",
    icone: "facture",
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

  licenciement: {
    cle: "licenciement",
    label: "Lettre de licenciement",
    icone: "interdit",
    groupe: "Fin de contrat",
    description: "Motif personnel (faute, insuffisance), après l'entretien préalable. À envoyer en recommandé.",
    nominatif: "requis",
    signatureSalarie: false,
    champs: [
      {
        cle: "motif",
        label: "Motif",
        type: "choix",
        options: [["faute_simple", "Faute simple (cause réelle et sérieuse)"], ["faute_grave", "Faute grave"], ["faute_lourde", "Faute lourde (intention de nuire)"], ["insuffisance", "Insuffisance professionnelle"]],
      },
      { cle: "date_entretien", label: "Date de l'entretien préalable", type: "date", requis: true },
      { cle: "faits", label: "Motifs précis (faits datés et vérifiables)", type: "zone", requis: true, aide: "La lettre fixe les limites du litige : tout motif non écrit ne pourra pas être invoqué ensuite." },
      { cle: "mise_a_pied", label: "Le salarié était en mise à pied conservatoire", type: "oui_non", si: (d) => d.motif === "faute_grave" || d.motif === "faute_lourde" },
      { cle: "preavis", label: "Durée du préavis", type: "texte", si: (d) => d.motif === "faute_simple" || d.motif === "insuffisance" },
      { cle: "preavis_dispense", label: "Dispense de préavis (payé)", type: "oui_non", si: (d) => d.motif === "faute_simple" || d.motif === "insuffisance" },
      { cle: "organisme", label: "Organisme santé / prévoyance (portabilité)", type: "texte" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => {
      const anc = anciennete(ctx.salarie?.date_embauche ?? "", aujourdhui());
      return { motif: "faute_simple", date_entretien: "", faits: "", mise_a_pied: false, preavis: preavisLegal(anc.mois), preavis_dispense: false, organisme: "", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() };
    },
    generer: (d, ctx) => {
      const motif = s(d, "motif");
      const grave = motif === "faute_grave" || motif === "faute_lourde";
      const civ = ctx.salarie?.civilite === "Mme" ? "Madame" : "Monsieur";
      const anc = anciennete(ctx.salarie?.date_embauche ?? "", s(d, "fait_le") || aujourdhui());
      const qualif = { faute_simple: "une faute constituant une cause réelle et sérieuse de licenciement", faute_grave: "une faute grave", faute_lourde: "une faute lourde, commise avec l'intention de nuire à l'entreprise", insuffisance: "une insuffisance professionnelle" }[motif] ?? "une cause réelle et sérieuse";
      return [
        "# Notification de licenciement",
        `#> ${ctx.etablissement.nom} · lettre recommandée avec accusé de réception`,
        `**${nomSal(ctx)}**${ctx.salarie ? `, ${posteDe(ctx.salarie.fonction, ctx.salarie.civilite)}` : ""}`,
        `${civ},`,
        `Nous vous avons reçu${e(ctx)} le ${dateLongue(s(d, "date_entretien"))} pour l'entretien préalable auquel vous aviez été convoqué${e(ctx)}. Les explications recueillies au cours de cet entretien ne nous ont pas permis de modifier notre appréciation des faits.`,
        `Nous vous notifions par la présente votre **licenciement** pour ${qualif}, pour les motifs suivants :`,
        ou(s(d, "faits")),
        grave
          ? `Ces faits rendent impossible votre maintien dans l'entreprise, y compris pendant la durée d'un préavis. Votre licenciement prend donc effet immédiatement, à la date de première présentation de cette lettre, sans préavis ni indemnité de licenciement.${b(d, "mise_a_pied") ? " La période de mise à pied conservatoire, nécessaire à la procédure, ne sera pas rémunérée." : ""}`
          : `Votre préavis, d'une durée de ${ou(s(d, "preavis"))}, débutera à la date de première présentation de cette lettre.${b(d, "preavis_dispense") ? " Nous vous dispensons de l'effectuer ; il vous sera néanmoins intégralement rémunéré aux échéances habituelles de la paie." : ""}`,
        !grave && anc.mois >= 8 ? "Vous percevrez l'indemnité de licenciement prévue par la loi ou par la convention collective, si elle est plus favorable." : "",
        "Vous percevrez l'indemnité compensatrice correspondant aux congés payés acquis et non pris.",
        "À l'issue de votre contrat, votre certificat de travail, votre attestation destinée à France Travail et votre reçu pour solde de tout compte vous seront remis.",
        `Vous bénéficiez, sous réserve de votre prise en charge par l'assurance chômage, du maintien gratuit de vos garanties de complémentaire santé et de prévoyance pour une durée égale à celle de votre dernier contrat, dans la limite de 12 mois (art. L911-8 du Code de la sécurité sociale)${s(d, "organisme") ? ` ; organisme : ${s(d, "organisme")}` : ""}.`,
        "Vous pouvez, dans les quinze jours suivant la notification de la présente lettre, nous demander par lettre recommandée ou remise contre récépissé de préciser les motifs de votre licenciement (art. R1232-13 du Code du travail). Toute action portant sur la rupture du contrat de travail se prescrit par douze mois à compter de sa notification (art. L1471-1).",
        `Veuillez agréer, ${civ}, l'expression de nos salutations distinguées.`,
        fait(d, ctx),
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  },

  rupture_conventionnelle: {
    cle: "rupture_conventionnelle",
    label: "Rupture conventionnelle",
    icone: "partenaire",
    groupe: "Fin de contrat",
    description: "Convention signée par les deux parties (CDI), avec calendrier et indemnité minimale calculés.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Lu et approuvé",
    champs: [
      { cle: "entretiens", label: "Date(s) du ou des entretiens (une par ligne)", type: "liste", placeholder: "ex. 2 octobre 2026", requis: true },
      { cle: "assistance", label: "Assistance lors des entretiens (facultatif)", type: "texte", placeholder: "ex. le salarié était assisté de M. X, délégué du personnel" },
      { cle: "date_signature", label: "Date de signature de la convention", type: "date", requis: true },
      { cle: "salaire_reference", label: "Salaire brut mensuel de référence (€)", type: "nombre", aide: "Le plus favorable entre la moyenne des 12 et des 3 derniers mois." },
      { cle: "indemnite", label: "Indemnité spécifique convenue (€)", type: "nombre", requis: true },
      { cle: "date_fin", label: "Date de fin du contrat envisagée", type: "date", requis: true },
      { cle: "fait_a", label: "Fait à", type: "texte" },
    ],
    defauts: (ctx) => ({ entretiens: [], assistance: "", date_signature: aujourdhui(), salaire_reference: "", indemnite: "", date_fin: "", fait_a: ctx.etablissement.ville }),
    generer: (d, ctx) => {
      const cal = calendrierRupture(s(d, "date_signature"));
      const anc = anciennete(ctx.salarie?.date_embauche ?? "", s(d, "date_fin") || s(d, "date_signature"));
      const mini = indemniteLegale(Number(s(d, "salaire_reference")), anc.annees);
      return [
        "# Convention de rupture conventionnelle",
        `#> Contrat à durée indéterminée · articles L1237-11 et suivants du Code du travail`,
        "Entre les soussignés :",
        `${employeur(ctx)}, représentée par ${ou(ctx.directeur)}, ci-après « l'employeur »,`,
        `et ${nomSal(ctx)}${ctx.salarie?.fonction ? `, ${posteDe(ctx.salarie.fonction, ctx.salarie.civilite)}` : ""}, employé${e(ctx)} depuis le ${dateLongue(ctx.salarie?.date_embauche ?? "")}, ci-après « ${leSal(ctx)} ».`,
        "## Entretiens",
        `Les parties se sont réunies lors ${l(d, "entretiens").length > 1 ? "des entretiens" : "de l'entretien"} du ${l(d, "entretiens").join(", du ") || "[date à compléter]"}, au cours ${l(d, "entretiens").length > 1 ? "desquels" : "duquel"} elles ont convenu du principe et des conditions de la rupture. ${s(d, "assistance") || `${leSal(ctx) === "la salariée" ? "La salariée" : "Le salarié"} a été informé${e(ctx)} de la possibilité de se faire assister.`}`,
        "## Conditions de la rupture",
        puces([
          `Date envisagée de fin du contrat : **${dateLongue(s(d, "date_fin"))}**.`,
          `Indemnité spécifique de rupture conventionnelle : **${s(d, "indemnite") ? eur(Number(s(d, "indemnite"))) : "[montant à compléter]"}** brut${mini ? ` (minimum légal : ${eur(mini)}, soit l'indemnité légale de licenciement pour ${Math.floor(anc.annees)} an${Math.floor(anc.annees) > 1 ? "s" : ""} et ${anc.mois % 12} mois d'ancienneté)` : ""}.`,
          "Les congés payés acquis et non pris donnent lieu à une indemnité compensatrice.",
        ]),
        "## Calendrier",
        cal
          ? puces([
              `Signature de la convention : ${dateLongue(s(d, "date_signature"))}.`,
              `Délai de rétractation de 15 jours calendaires : jusqu'au **${dateLongue(cal.finRetractation)}** inclus. Chaque partie peut se rétracter par lettre recommandée ou remise contre décharge, sans avoir à se justifier.`,
              `Demande d'homologation en ligne sur le service TéléRC, à partir du ${dateLongue(cal.depot)}.`,
              `Réponse de l'administration au plus tard le ${dateLongue(cal.homologation)} (15 jours ouvrables ; sans réponse, l'homologation est acquise).`,
              `Fin du contrat au plus tôt le ${dateLongue(cal.finAuPlusTot)}.`,
            ])
          : "[Date de signature à compléter]",
        "## Fin du contrat",
        "À la date de fin du contrat, l'employeur remettra le certificat de travail, l'attestation destinée à France Travail et le reçu pour solde de tout compte. La rupture conventionnelle ouvre droit, sous conditions, aux allocations d'assurance chômage et au maintien des garanties santé et prévoyance (portabilité).",
        "La présente convention, établie en deux exemplaires dont un remis à chaque partie, reprend l'accord des parties. La demande d'homologation est déposée sur le formulaire officiel en ligne (TéléRC), après l'expiration du délai de rétractation.",
        `Fait à ${ou(s(d, "fait_a") || ctx.etablissement.ville)}, le ${dateLongue(s(d, "date_signature"))}.`,
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  },

  rupture_essai: {
    cle: "rupture_essai",
    label: "Rupture de la période d'essai",
    icone: "horloge",
    groupe: "Fin de contrat",
    description: "Par l'employeur, avec le délai de prévenance légal calculé selon la présence.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Reçu en main propre",
    champs: [
      { cle: "date_debut", label: "Date d'entrée du salarié", type: "date" },
      { cle: "date_notification", label: "Date de remise de la lettre", type: "date" },
      { cle: "fin_essai", label: "Fin prévue de la période d'essai", type: "date", aide: "Renouvellement compris." },
    ],
    defauts: (ctx) => ({ date_debut: ctx.salarie?.date_embauche ?? "", date_notification: aujourdhui(), fin_essai: "" }),
    generer: (d, ctx) => {
      const civ = ctx.salarie?.civilite === "Mme" ? "Madame" : "Monsieur";
      const prev = prevenanceEssai(joursEntre(s(d, "date_debut"), s(d, "date_notification")));
      const finPrev = s(d, "date_notification") ? ajouterJours(s(d, "date_notification"), prev.jours) : "";
      const depasse = s(d, "fin_essai") && finPrev > s(d, "fin_essai");
      return [
        "# Rupture de la période d'essai",
        `#> ${ctx.etablissement.nom} · lettre remise en main propre contre décharge`,
        `**${nomSal(ctx)}**`,
        `${civ},`,
        `Vous êtes entré${e(ctx)} dans notre établissement le ${dateLongue(s(d, "date_debut"))}. Nous vous informons que nous mettons fin à votre période d'essai.`,
        `Conformément à l'article L1221-25 du Code du travail, compte tenu de votre temps de présence, vous bénéficiez d'un délai de prévenance de **${prev.libelle}**.`,
        depasse
          ? `La période d'essai ne pouvant être prolongée par le délai de prévenance, votre contrat prendra fin le **${dateLongue(s(d, "fin_essai"))}**. Vous percevrez une indemnité compensatrice correspondant aux salaires et avantages que vous auriez perçus jusqu'au terme du délai de prévenance.`
          : `Votre contrat de travail prendra fin le **${dateLongue(finPrev)}** au soir.`,
        "Votre certificat de travail, votre attestation destinée à France Travail et votre reçu pour solde de tout compte, comprenant l'indemnité compensatrice de congés payés, vous seront remis à cette date.",
        `Veuillez agréer, ${civ}, l'expression de nos salutations distinguées.`,
        `Fait à ${ou(ctx.etablissement.ville)}, le ${dateLongue(s(d, "date_notification"))}.`,
      ].join("\n\n");
    },
  },

  rupture_cdd: {
    cle: "rupture_cdd",
    label: "Rupture anticipée d'un CDD",
    icone: "calendrier",
    groupe: "Fin de contrat",
    description: "Accord commun écrit pour mettre fin à un CDD avant son terme.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Lu et approuvé, bon pour accord",
    champs: [
      { cle: "date_debut", label: "Date de début du CDD", type: "date" },
      { cle: "terme", label: "Terme initialement prévu", type: "date" },
      { cle: "date_fin", label: "Date de fin convenue", type: "date", requis: true },
      { cle: "usage", label: "CDD d'usage (extra)", type: "oui_non", aide: "Pas d'indemnité de fin de contrat pour un CDD d'usage." },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ date_debut: ctx.salarie?.date_embauche ?? "", terme: "", date_fin: "", usage: ctx.salarie?.nature === "extra", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) =>
      [
        "# Rupture anticipée du contrat à durée déterminée d'un commun accord",
        `#> Article L1243-1 du Code du travail`,
        "Entre les soussignés :",
        `${employeur(ctx)}, représentée par ${ou(ctx.directeur)}, ci-après « l'employeur »,`,
        `et ${nomSal(ctx)}, ci-après « ${leSal(ctx)} ».`,
        `Les parties ont conclu un contrat à durée déterminée ayant pris effet le ${dateLongue(s(d, "date_debut"))}${s(d, "terme") ? ` et dont le terme était fixé au ${dateLongue(s(d, "terme"))}` : ""}.`,
        `Elles conviennent, d'un commun accord et sans contrainte, de mettre fin à ce contrat de manière anticipée. Le contrat prendra fin le **${dateLongue(s(d, "date_fin"))}** au soir.`,
        b(d, "usage")
          ? "S'agissant d'un contrat à durée déterminée d'usage, aucune indemnité de fin de contrat n'est due. Une indemnité compensatrice de congés payés sera versée."
          : `${leSal(ctx) === "la salariée" ? "La salariée" : "Le salarié"} percevra l'indemnité de fin de contrat égale à 10 % de la rémunération totale brute perçue, ainsi que l'indemnité compensatrice de congés payés.`,
        "Le certificat de travail, l'attestation destinée à France Travail et le reçu pour solde de tout compte seront remis à la fin du contrat.",
        "Établi en deux exemplaires, dont un remis à chaque partie.",
        fait(d, ctx),
      ].join("\n\n"),
  },

  demission: {
    cle: "demission",
    label: "Accusé de réception de démission",
    icone: "reception",
    groupe: "Fin de contrat",
    description: "Prend acte de la démission et fixe le préavis et la date de départ.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Reçu en main propre",
    champs: [
      { cle: "date_reception", label: "Démission reçue le", type: "date" },
      { cle: "forme", label: "Reçue par", type: "choix", options: [["main", "Lettre remise en main propre"], ["lrar", "Lettre recommandée"], ["email", "E-mail"]] },
      { cle: "preavis", label: "Durée du préavis", type: "texte", placeholder: "ex. 8 jours, 15 jours, 1 mois selon l'ancienneté et la convention" },
      { cle: "dispense", label: "Dispense de préavis", type: "choix", options: [["non", "Pas de dispense"], ["salarie", "Accordée à la demande du salarié (non payée)"], ["employeur", "À l'initiative de l'employeur (payée)"]] },
      { cle: "date_depart", label: "Date de fin du contrat", type: "date" },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ date_reception: aujourdhui(), forme: "main", preavis: "", dispense: "non", date_depart: "", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) => {
      const civ = ctx.salarie?.civilite === "Mme" ? "Madame" : "Monsieur";
      const forme = { main: "votre lettre remise en main propre", lrar: "votre lettre recommandée", email: "votre courriel" }[s(d, "forme")] ?? "votre courrier";
      const disp = s(d, "dispense");
      return [
        "# Accusé de réception de démission",
        `#> ${ctx.etablissement.nom}`,
        `**${nomSal(ctx)}**`,
        `${civ},`,
        `Nous accusons réception de ${forme} du ${dateLongue(s(d, "date_reception"))}, par laquelle vous nous avez fait part de votre décision de démissionner de votre poste${ctx.salarie ? ` de ${posteDe(ctx.salarie.fonction, ctx.salarie.civilite)}` : ""}. Nous en prenons acte.`,
        disp === "salarie"
          ? `À votre demande, nous acceptons de vous dispenser de votre préavis${s(d, "preavis") ? ` de ${s(d, "preavis")}` : ""}. Cette dispense n'étant pas rémunérée, votre contrat prendra fin le **${dateLongue(s(d, "date_depart"))}**.`
          : disp === "employeur"
            ? `Nous vous dispensons d'effectuer votre préavis${s(d, "preavis") ? ` de ${s(d, "preavis")}` : ""}, qui vous sera néanmoins rémunéré. Vous cesserez vos fonctions dès réception de la présente ; votre contrat prendra fin le **${dateLongue(s(d, "date_depart"))}**.`
            : `Votre préavis${s(d, "preavis") ? ` d'une durée de ${s(d, "preavis")}` : ""} court à compter de la réception de votre démission. Votre contrat prendra fin le **${dateLongue(s(d, "date_depart"))}** au soir.`,
        "Votre certificat de travail, votre attestation destinée à France Travail et votre reçu pour solde de tout compte, comprenant l'indemnité compensatrice de congés payés, vous seront remis à cette date.",
        "Nous vous remercions pour le travail accompli et vous souhaitons pleine réussite pour la suite.",
        `Veuillez agréer, ${civ}, l'expression de nos salutations distinguées.`,
        fait(d, ctx),
      ].join("\n\n");
    },
  },

  solde_tout_compte: {
    cle: "solde_tout_compte",
    label: "Reçu pour solde de tout compte",
    icone: "facture",
    groupe: "Fin de contrat",
    description: "Inventaire des sommes versées à la fin du contrat, signé par le salarié.",
    nominatif: "requis",
    signatureSalarie: true,
    mentionSalarie: "Pour solde de tout compte",
    champs: [
      { cle: "date_sortie", label: "Date de fin du contrat", type: "date" },
      { cle: "lignes", label: "Sommes versées (une par ligne : libellé et montant brut)", type: "liste", placeholder: "ex. Salaire du 1er au 30 septembre : 1 520,00 €", requis: true },
      { cle: "total", label: "Total net versé", type: "texte", placeholder: "ex. 2 348,15 €", requis: true },
      { cle: "mode", label: "Mode de paiement", type: "choix", options: [["virement", "Virement"], ["cheque", "Chèque"]] },
      ...CHAMPS_FIN,
    ],
    defauts: (ctx) => ({ date_sortie: "", lignes: ["Salaire du mois en cours", "Indemnité compensatrice de congés payés"], total: "", mode: "virement", fait_a: ctx.etablissement.ville, fait_le: aujourdhui() }),
    generer: (d, ctx) =>
      [
        "# Reçu pour solde de tout compte",
        `#> Article L1234-20 du Code du travail`,
        `Je soussigné${e(ctx)} ${nomSal(ctx)}, ${ctx.salarie ? posteDe(ctx.salarie.fonction, ctx.salarie.civilite) : ""}, dont le contrat de travail avec ${employeur(ctx)} a pris fin le ${dateLongue(s(d, "date_sortie"))}, reconnais avoir reçu la somme nette de **${ou(s(d, "total"))}**, versée par ${s(d, "mode") === "cheque" ? "chèque" : "virement"}, en paiement des salaires, accessoires du salaire et indemnités dus au titre de l'exécution et de la cessation de mon contrat de travail.`,
        "Cette somme se décompose comme suit :",
        puces(l(d, "lignes")) || "- [détail à compléter]",
        "Ce reçu, établi en deux exemplaires dont un m'a été remis, peut être dénoncé dans les six mois qui suivent sa signature. Passé ce délai, il devient libératoire pour l'employeur pour les seules sommes qui y sont mentionnées.",
        fait(d, ctx),
      ].join("\n\n"),
  },
};

export const ORDRE_DOCS: TypeDoc[] = [
  "fiche_poste", "remise_materiel", "reglement", "promesse", "attestation",
  "avertissement", "convocation",
  "licenciement", "rupture_conventionnelle", "rupture_essai", "rupture_cdd", "demission", "solde_tout_compte", "certificat",
];

/** Alertes légales propres à chaque document. */
export function alertesDoc(type: TypeDoc, d: Donnees, ctx?: Contexte): string[] {
  const a: string[] = [];
  const m = MODELES_DOCS[type];
  for (const c of m.champs) {
    const v = d[c.cle];
    const vide = typeof v === "string" ? !v.trim() : Array.isArray(v) ? !v.some((x) => typeof x !== "string" || x.trim()) : !v;
    if (c.requis && (!c.si || c.si(d)) && vide) a.push(`${c.label} : à compléter.`);
  }
  const jours = (x: string) => Math.round((new Date(x + "T12:00").getTime() - Date.now()) / 864e5);
  if (type === "convocation" && s(d, "date_entretien")) {
    if (jours(s(d, "date_entretien")) < 7) a.push("L'entretien doit se tenir au moins 5 jours ouvrables après la remise de la convocation (hors samedi, dimanche et jours fériés).");
  }
  if (type === "avertissement" && s(d, "date_faits") && jours(s(d, "date_faits")) < -60) a.push("Faits de plus de deux mois : ils sont prescrits et ne peuvent plus être sanctionnés seuls (art. L1332-4).");
  if (type === "reglement" && !Number(s(d, "mise_a_pied_jours"))) a.push("Indique la durée maximale de la mise à pied disciplinaire, sinon elle ne pourra pas être appliquée.");
  if (type === "reglement" && !s(d, "date_vigueur")) a.push("Indique la date d'entrée en vigueur (au moins un mois après les formalités de dépôt).");
  if (type === "certificat" && !s(d, "date_sortie")) a.push("Indique la date de sortie (fin du préavis, même non effectué).");
  if (type === "licenciement" && s(d, "date_entretien")) {
    const auPlusTot = ajouterOuvrables(s(d, "date_entretien"), 2);
    if (s(d, "fait_le") && s(d, "fait_le") < auPlusTot) a.push(`La lettre ne peut pas être envoyée moins de 2 jours ouvrables après l'entretien : au plus tôt le ${dateLongue(auPlusTot)} (art. L1232-6).`);
    const disciplinaire = s(d, "motif") !== "insuffisance";
    if (disciplinaire && s(d, "fait_le") && s(d, "fait_le") > ajouterJours(s(d, "date_entretien"), 30)) a.push("Licenciement disciplinaire : la lettre doit être envoyée au plus tard un mois après l'entretien (art. L1332-2).");
  }
  if (type === "licenciement" && s(d, "motif") === "faute_lourde") a.push("La faute lourde suppose une intention de nuire à l'entreprise, difficile à prouver : en cas de doute, retiens la faute grave.");
  if (type === "rupture_conventionnelle") {
    const cal = calendrierRupture(s(d, "date_signature"));
    if (cal && s(d, "date_fin") && s(d, "date_fin") < cal.finAuPlusTot) a.push(`La date de fin ne peut pas précéder le lendemain de l'homologation : au plus tôt le ${dateLongue(cal.finAuPlusTot)}.`);
    const ref = Number(s(d, "salaire_reference"));
    if (!ref) a.push("Indique le salaire de référence pour vérifier l'indemnité minimale.");
    if (ref && s(d, "indemnite") && Number(s(d, "indemnite")) < indemniteLegale(ref, anciennete(ctx?.salarie?.date_embauche ?? "", s(d, "date_fin") || s(d, "date_signature")).annees)) a.push("L'indemnité convenue est inférieure à l'indemnité légale de licenciement : l'administration refusera l'homologation.");
  }
  if (type === "rupture_essai" && !s(d, "fin_essai")) a.push("Indique la fin prévue de la période d'essai : le délai de prévenance ne peut pas la dépasser.");
  if (type === "solde_tout_compte") a.push("Le montant doit correspondre au bulletin de paie de sortie. Le salarié peut dénoncer ce reçu pendant 6 mois.");
  return a;
}

export { eur, MATERIELS };
