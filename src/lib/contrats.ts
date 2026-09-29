// Contrats de travail : modèles, options et génération du texte. Pur (pas d'accès réseau).
//
// Modèles France (convention collective HCR, IDCC 1979) et Belgique (CP 302 Horeca). Ce sont des
// trames de départ : le texte généré doit être relu par l'employeur (ou son expert-comptable /
// avocat) avant signature.
//
// Format du texte produit (figé et signé tel quel) :
//   « # »  titre              « #> » sous-titre
//   « | Libellé | Valeur »    lignes de l'encadré « En bref »
//   « @ Titre »               cadre d'une partie (lignes suivantes = contenu)
//   « ## »  article           « - »  puce          **gras**
//   lignes vides entre les blocs.

import { CONVENTIONS, paliersEnTexte, PREAVIS_DEMISSION_BE, PREAVIS_LEGAL, PREVENANCE_ESSAI, TITRES_RESTAURANT } from "@/lib/droitTravail";
import type { Statut } from "@/lib/droitTravail";

export type Pays = "FR" | "BE";
export type ModeleCle = "fr_cdi" | "fr_cdd" | "fr_extra" | "be_cdi" | "be_cdd" | "be_extra";

export const MODELES: Record<ModeleCle, { label: string; court: string; pays: Pays; description: string }> = {
  fr_cdi: { label: "CDI (temps plein ou partiel)", court: "CDI", pays: "FR", description: "Contrat à durée indéterminée, convention HCR" },
  fr_cdd: { label: "CDD", court: "CDD", pays: "FR", description: "Remplacement, accroissement temporaire d'activité ou saisonnier" },
  fr_extra: { label: "Extra (CDD d'usage)", court: "Extra", pays: "FR", description: "Mission ponctuelle, usage constant du secteur HCR" },
  be_cdi: { label: "Contrat à durée indéterminée", court: "CDI", pays: "BE", description: "Commission paritaire 302 (Horeca)" },
  be_cdd: { label: "Contrat à durée déterminée", court: "CDD", pays: "BE", description: "Commission paritaire 302 (Horeca)" },
  be_extra: { label: "Travailleur occasionnel (extra)", court: "Extra", pays: "BE", description: "Horeca, 50 jours maximum par an, Dimona obligatoire" },
};

export const MOTIFS_CDD: Record<string, string> = {
  remplacement: "Remplacement d'un salarié absent",
  accroissement: "Accroissement temporaire d'activité",
  saisonnier: "Emploi à caractère saisonnier",
};

export const STATUTS_FR: Record<string, { label: string; essaiCdiMois: number }> = {
  employe: { label: "Employé", essaiCdiMois: 2 },
  maitrise: { label: "Agent de maîtrise", essaiCdiMois: 3 },
  cadre: { label: "Cadre", essaiCdiMois: 4 },
};

/** Emplois courants HCR, avec une classification indicative (à ajuster selon l'établissement). */
export const EMPLOIS: { intitule: string; famille: "Salle" | "Bar" | "Cuisine" | "Encadrement"; statut: string; niveau: string; echelon: string }[] = [
  { intitule: "Serveur / Serveuse", famille: "Salle", statut: "employe", niveau: "I", echelon: "3" },
  { intitule: "Runner", famille: "Salle", statut: "employe", niveau: "I", echelon: "1" },
  { intitule: "Chef de rang", famille: "Salle", statut: "employe", niveau: "II", echelon: "2" },
  { intitule: "Hôte / Hôtesse d'accueil", famille: "Salle", statut: "employe", niveau: "I", echelon: "3" },
  { intitule: "Maître d'hôtel", famille: "Salle", statut: "maitrise", niveau: "III", echelon: "2" },
  { intitule: "Sommelier / Sommelière", famille: "Salle", statut: "employe", niveau: "III", echelon: "1" },
  { intitule: "Employé polyvalent", famille: "Salle", statut: "employe", niveau: "I", echelon: "2" },
  { intitule: "Barman / Barmaid", famille: "Bar", statut: "employe", niveau: "II", echelon: "1" },
  { intitule: "Chef barman", famille: "Bar", statut: "maitrise", niveau: "III", echelon: "2" },
  { intitule: "Plongeur / Plongeuse", famille: "Cuisine", statut: "employe", niveau: "I", echelon: "1" },
  { intitule: "Commis de cuisine", famille: "Cuisine", statut: "employe", niveau: "I", echelon: "2" },
  { intitule: "Cuisinier / Cuisinière", famille: "Cuisine", statut: "employe", niveau: "II", echelon: "2" },
  { intitule: "Pâtissier / Pâtissière", famille: "Cuisine", statut: "employe", niveau: "II", echelon: "2" },
  { intitule: "Chef de partie", famille: "Cuisine", statut: "employe", niveau: "III", echelon: "1" },
  { intitule: "Second de cuisine", famille: "Cuisine", statut: "maitrise", niveau: "IV", echelon: "1" },
  { intitule: "Chef de cuisine", famille: "Cuisine", statut: "cadre", niveau: "V", echelon: "1" },
  { intitule: "Responsable de salle", famille: "Encadrement", statut: "maitrise", niveau: "IV", echelon: "1" },
  { intitule: "Manager", famille: "Encadrement", statut: "maitrise", niveau: "IV", echelon: "2" },
  { intitule: "Directeur adjoint / Directrice adjointe", famille: "Encadrement", statut: "cadre", niveau: "V", echelon: "2" },
];

export const MATERIELS = ["Veste de cuisine", "Pantalon de cuisine", "Tablier", "Calot / toque", "Chaussures de sécurité", "Tenue de salle", "Couteaux", "Limonadier / tire-bouchon", "Terminal de commande"];

export type Periodicite = "mois" | "an" | "service" | "heure" | "variable";
export type Prime = { libelle: string; montant: string; periodicite: Periodicite; condition: string };
export const PERIODICITES: Record<Periodicite, string> = { mois: "brut par mois", an: "brut par an", service: "brut par service", heure: "brut par heure", variable: "montant variable" };
export const PRIMES_TYPES: Prime[] = [
  { libelle: "Prime d'objectifs", montant: "", periodicite: "mois", condition: "selon les objectifs fixés chaque mois" },
  { libelle: "13e mois", montant: "", periodicite: "an", condition: "versé en décembre, au prorata du temps de présence" },
  { libelle: "Prime du dimanche", montant: "", periodicite: "service", condition: "pour chaque service effectué un dimanche" },
  { libelle: "Prime de nuit", montant: "", periodicite: "heure", condition: "pour les heures effectuées entre 22 h et 7 h" },
  { libelle: "Prime de panier", montant: "", periodicite: "service", condition: "pour chaque service en coupure" },
  { libelle: "Pourboires", montant: "", periodicite: "variable", condition: "reversés selon la répartition en vigueur dans l'établissement" },
];

export type Repas = "nature" | "indemnite" | "titres" | "aucun";
export type Entretien = "entreprise" | "prime" | "salarie";

export type Donnees = {
  // Salarié
  civilite: "M." | "Mme";
  prenom: string;
  nom: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  adresse: string;
  numero_securite: string; // n° sécurité sociale (FR) ou registre national (BE)
  // Convention collective (France)
  convention: string; // hcr / rapide / collective / autre
  convention_libre: string;
  idcc_libre: string;
  // Employeur
  employeur: string;
  employeur_adresse: string;
  employeur_numero: string; // SIRET (FR) ou n° d'entreprise (BE)
  representant: string;
  representant_qualite: string;
  // Emploi
  fonction: string;
  statut: string; // FR : employe / maitrise / cadre ; BE : employe / ouvrier
  niveau: string;
  echelon: string;
  lieu_travail: string;
  date_debut: string;
  date_fin: string;
  motif: string;
  motif_detail: string;
  duree_minimale: string;
  essai: string;
  essai_renouvelable: boolean;
  // Temps et rémunération
  heures_hebdo: string;
  repartition: string;
  horaires_mission: string;
  taux_horaire: string;
  primes: Prime[];
  // Avantages et équipement
  repas: Repas;
  repas_montant: string; // valeur d'un repas (avantage en nature ou indemnité)
  tr_valeur: string; // titres-restaurant : valeur faciale
  tr_part: string; // titres-restaurant : part employeur en %
  tenue_fournie: boolean;
  entretien: Entretien;
  prime_entretien: string;
  materiel: string[];
  transport: boolean;
  mutuelle: string;
  caisse_retraite: string; // nom et adresse (mention obligatoire en CDD)
  organisme_prevoyance: string;
  clauses: string;
  paraphe: boolean;
  // Signature
  fait_a: string;
  fait_le: string;
};

export const DONNEES_VIDES: Donnees = {
  civilite: "M.",
  prenom: "",
  nom: "",
  date_naissance: "",
  lieu_naissance: "",
  nationalite: "française",
  adresse: "",
  numero_securite: "",
  convention: "hcr",
  convention_libre: "",
  idcc_libre: "",
  employeur: "",
  employeur_adresse: "",
  employeur_numero: "",
  representant: "",
  representant_qualite: "Gérant",
  fonction: "",
  statut: "employe",
  niveau: "I",
  echelon: "1",
  lieu_travail: "",
  date_debut: "",
  date_fin: "",
  motif: "accroissement",
  motif_detail: "",
  duree_minimale: "",
  essai: "",
  essai_renouvelable: true,
  heures_hebdo: "35",
  repartition: "",
  horaires_mission: "",
  taux_horaire: "",
  primes: [],
  repas: "nature",
  repas_montant: "",
  tr_valeur: "",
  tr_part: "50",
  tenue_fournie: true,
  entretien: "entreprise",
  prime_entretien: "",
  materiel: [],
  transport: true,
  mutuelle: "",
  caisse_retraite: "",
  organisme_prevoyance: "",
  clauses: "",
  paraphe: true,
  fait_a: "",
  fait_le: "",
};

/** Choix d'un établissement qui deviennent les valeurs de départ de chaque nouveau contrat. */
export const CHAMPS_DEFAUTS = ["convention", "convention_libre", "idcc_libre", "essai_renouvelable", "repas", "repas_montant", "tr_valeur", "tr_part", "caisse_retraite", "organisme_prevoyance", "tenue_fournie", "entretien", "prime_entretien", "materiel", "primes", "transport", "mutuelle", "clauses", "paraphe", "representant", "representant_qualite", "lieu_travail"] as const;
export type Defauts = Partial<Pick<Donnees, (typeof CHAMPS_DEFAUTS)[number]>>;

export type PosteType = { id: string; intitule: string; statut: string; niveau: string; echelon: string; taux_horaire: string; heures_hebdo: string; repartition: string };
export type Reglages = { postes: PosteType[]; defauts: Defauts };

/** Complète des données enregistrées avec une ancienne version (champs manquants). */
export function normaliser(d: Partial<Donnees> & { avantage_nourriture?: boolean }): Donnees {
  const n = { ...DONNEES_VIDES, ...d } as Donnees;
  if (d.repas === undefined && d.avantage_nourriture === false) n.repas = "aucun";
  n.primes = Array.isArray(d.primes) ? d.primes : [];
  n.materiel = Array.isArray(d.materiel) ? d.materiel : [];
  return n;
}

const num = (s: string) => Number(String(s ?? "").replace(",", "."));
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const heures = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const date = (iso: string) => (iso ? new Date(iso + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "[date à compléter]");
const ou = (v: string, defaut = "[à compléter]") => (v?.trim() ? v.trim() : defaut);
const e = (d: Donnees) => (d.civilite === "Mme" ? "e" : "");
const leSalarie = (d: Donnees) => (d.civilite === "Mme" ? "la salariée" : "le salarié");
const LeSalarie = (d: Donnees) => (d.civilite === "Mme" ? "La salariée" : "Le salarié");
const pronom = (d: Donnees) => (d.civilite === "Mme" ? "elle" : "il");

/** Convention applicable (France) et son intitulé complet. */
export function conventionDe(d: Pick<Donnees, "convention" | "convention_libre" | "idcc_libre">) {
  const c = CONVENTIONS[d.convention] ?? CONVENTIONS.hcr;
  const intitule = c.cle === "autre" ? `${d.convention_libre.trim() || "[convention collective à préciser]"}${d.idcc_libre.trim() ? ` (IDCC ${d.idcc_libre.trim()})` : ""}` : `${c.intitule} (IDCC ${c.idcc})`;
  return { ...c, intituleComplet: intitule };
}

const statutFr = (d: Donnees): Statut => (d.statut === "cadre" ? "cadre" : d.statut === "maitrise" ? "maitrise" : "employe");

/** Renouvellement de l'essai possible ? (HCR : interdit au niveau I échelon 1) */
export function renouvellementEssai(d: Donnees): { mois: number | null; interdit: boolean; raison?: string } {
  const c = conventionDe(d);
  const mois = c.renouvellement[statutFr(d)];
  if (c.cle === "hcr" && statutFr(d) === "employe" && d.niveau.trim().toUpperCase() === "I" && d.echelon.trim() === "1") return { mois: 0, interdit: true, raison: "interdit au niveau I, échelon 1 (convention HCR, art. 13)" };
  if (mois === 0) return { mois: 0, interdit: true, raison: "non prévu par la convention pour ce statut" };
  return { mois, interdit: false };
}

/** Valeur d'un repas retenue (saisie, sinon valeur de référence de la convention). */
export function valeurRepas(d: Donnees) {
  return num(d.repas_montant) || conventionDe(d).repas;
}

/** Titres-restaurant : part employeur en euros. */
export function partEmployeurTitre(d: Donnees) {
  const v = num(d.tr_valeur);
  const p = num(d.tr_part);
  return v && p ? Math.round(v * p) / 100 : null;
}

/** Salaire mensuel brut de base : taux horaire × heures hebdo × 52 / 12. */
export function salaireMensuel(d: Pick<Donnees, "taux_horaire" | "heures_hebdo">) {
  const t = num(d.taux_horaire);
  const h = num(d.heures_hebdo);
  if (!t || !h) return null;
  return (t * h * 52) / 12;
}

function joursEntre(a: string, b: string) {
  return Math.round((new Date(b + "T12:00").getTime() - new Date(a + "T12:00").getTime()) / 864e5) + 1;
}

/** Période d'essai proposée (maximum légal) ; modifiable dans le formulaire. */
export function essaiPropose(modele: ModeleCle, d: Donnees): string {
  if (modele === "fr_cdi") return `${conventionDe(d).essai[statutFr(d)]} mois`;
  if (modele === "fr_cdd") {
    if (!d.date_debut || !d.date_fin) return "1 jour par semaine de contrat";
    const jours = joursEntre(d.date_debut, d.date_fin);
    if (jours > 183) return "1 mois";
    const j = Math.min(14, Math.max(1, Math.ceil(jours / 7)));
    return `${j} jour${j > 1 ? "s" : ""}`;
  }
  return "";
}

export function alertes(modele: ModeleCle, d: Donnees): string[] {
  const a: string[] = [];
  const h = num(d.heures_hebdo);
  if (MODELES[modele].pays === "FR" && modele !== "fr_extra") {
    if (h && h < 35 && !d.repartition.trim()) a.push("Temps partiel : la répartition des heures entre les jours de la semaine est obligatoire.");
    if (h && h < 24) a.push("Moins de 24 h par semaine : possible seulement à la demande écrite du salarié ou dans les cas prévus par la loi.");
  }
  if ((modele === "fr_cdd" || modele === "be_cdd") && !d.date_fin && !d.duree_minimale) a.push("CDD : indique une date de fin, ou une durée minimale (remplacement).");
  if (modele === "fr_cdd" && d.motif === "remplacement" && !d.motif_detail.trim()) a.push("Remplacement : le nom et la qualification du salarié remplacé doivent figurer au contrat.");
  if (!d.numero_securite.trim()) a.push(MODELES[modele].pays === "FR" ? "N° de sécurité sociale manquant." : "N° de registre national manquant.");
  if (!num(d.taux_horaire)) a.push("Rémunération manquante.");
  if (d.tenue_fournie && d.entretien === "prime" && !num(d.prime_entretien)) a.push("Prime d'entretien de la tenue : indique le montant.");
  if (d.primes.some((p) => p.periodicite !== "variable" && !num(p.montant))) a.push("Une prime n'a pas de montant.");
  if (MODELES[modele].pays === "FR") {
    const ren = renouvellementEssai(d);
    if (modele === "fr_cdi" && d.essai_renouvelable && ren.interdit) a.push(`Renouvellement de l'essai ${ren.raison} : il ne figurera pas au contrat.`);
    if (modele === "fr_cdi" && d.essai_renouvelable && ren.mois === null) a.push("Renouvellement de l'essai : vérifie que ta convention collective l'autorise (sinon choisis « non renouvelable »).");
    if (d.convention === "autre" && !d.convention_libre.trim()) a.push("Indique l'intitulé de la convention collective (mention obligatoire).");
    if ((modele === "fr_cdd" || modele === "fr_extra") && !d.caisse_retraite.trim()) a.push("CDD : le nom et l'adresse de la caisse de retraite complémentaire doivent figurer au contrat.");
  }
  if (d.repas === "titres") {
    const p = num(d.tr_part);
    const part = partEmployeurTitre(d);
    if (!num(d.tr_valeur)) a.push("Titres-restaurant : indique la valeur du titre.");
    if (p && (p < TITRES_RESTAURANT.partMin || p > TITRES_RESTAURANT.partMax)) a.push(`Titres-restaurant : la part employeur doit être entre ${TITRES_RESTAURANT.partMin} et ${TITRES_RESTAURANT.partMax} % pour être exonérée.`);
    if (part && part > TITRES_RESTAURANT.plafondExonere) a.push(`Titres-restaurant : la part employeur (${eur(part)}) dépasse le plafond exonéré de ${eur(TITRES_RESTAURANT.plafondExonere)} en 2026 ; l'excédent est soumis à cotisations.`);
    if (d.convention === "hcr" && MODELES[modele].pays === "FR") a.push("HCR : l'employeur doit nourrir le salarié ou lui verser l'indemnité compensatrice de nourriture ; les titres-restaurant ne remplacent pas cette obligation pour les repas pris pendant le service.");
  }
  return a;
}

// ——— Blocs de texte ———

function enBref(modele: ModeleCle, d: Donnees) {
  const pays = MODELES[modele].pays;
  const h = num(d.heures_hebdo);
  const plein = pays === "FR" ? 35 : 38;
  const m = salaireMensuel(d);
  const t = num(d.taux_horaire);
  const statut = pays === "FR" ? `${STATUTS_FR[d.statut]?.label ?? "Employé"}, niveau ${ou(d.niveau)}, échelon ${ou(d.echelon)}` : d.statut === "ouvrier" ? "Ouvrier" : "Employé";
  const extra = modele.endsWith("extra");
  const duree = modele.endsWith("cdi") ? "Indéterminée" : d.date_fin ? `Jusqu'au ${date(d.date_fin)}` : d.duree_minimale ? `Durée minimale : ${d.duree_minimale}` : "[à compléter]";
  const lignes: string[][] = [
    ["Emploi", `${ou(d.fonction)} · ${statut}`],
    [extra ? "Date de la mission" : "Date d'entrée", date(d.date_debut)],
    ...(extra ? [["Horaires", ou(d.horaires_mission, "communiqués à l'embauche")]] : [["Durée du contrat", duree], ["Temps de travail", h ? `${heures(h)} h par semaine (${h < plein ? "temps partiel" : "temps plein"})` : "[à compléter]"]]),
    ["Rémunération", !t ? "[à compléter]" : !extra && m ? `${eur(m)} brut par mois (${eur(t)} de l'heure)` : `${eur(t)} brut de l'heure`],
    ...(d.essai && !extra ? [["Période d'essai", `${d.essai}${modele === "fr_cdi" ? (d.essai_renouvelable ? ", renouvelable une fois" : ", non renouvelable") : ""}`]] : []),
    ["Lieu de travail", ou(d.lieu_travail)],
    ...(pays === "FR" ? [["Convention collective", conventionDe(d).cle === "autre" ? ou(d.convention_libre) : `${LIBELLE_COURT[conventionDe(d).cle]} (IDCC ${conventionDe(d).idcc})`]] : []),
  ];
  return lignes.map(([l, v]) => `| ${l} | ${v}`).join("\n");
}

const LIBELLE_COURT: Record<string, string> = { hcr: "Hôtels, cafés, restaurants", rapide: "Restauration rapide", collective: "Restauration de collectivités" };

function parties(d: Donnees, pays: Pays) {
  return [
    ["@ L'employeur", `**${ou(d.employeur)}**`, pays === "FR" ? `SIRET ${ou(d.employeur_numero)}` : `N° d'entreprise ${ou(d.employeur_numero)}`, ou(d.employeur_adresse), `Représenté par ${ou(d.representant)}, ${ou(d.representant_qualite)}`].join("\n"),
    [
      `@ ${LeSalarie(d)}`,
      `**${d.civilite} ${ou(d.prenom)} ${ou(d.nom)}**`,
      `Né${e(d)} le ${date(d.date_naissance)} à ${ou(d.lieu_naissance)}`,
      `Nationalité ${ou(d.nationalite)}`,
      ou(d.adresse),
      `${pays === "FR" ? "N° de sécurité sociale" : "N° de registre national"} : ${ou(d.numero_securite)}`,
    ].join("\n"),
  ].join("\n\n");
}

function montantPrime(p: Prime) {
  if (p.periodicite === "variable") return "montant variable";
  return `${num(p.montant) ? eur(num(p.montant)) : "[montant à compléter]"} ${PERIODICITES[p.periodicite]}`;
}

function remuneration(d: Donnees, pays: Pays, mensuel: boolean): string[] {
  const t = num(d.taux_horaire);
  const m = salaireMensuel(d);
  const base = mensuel && m ? `un salaire mensuel brut de base de **${eur(m)}** pour ${heures(num(d.heures_hebdo))} heures hebdomadaires, soit un taux horaire brut de ${eur(t)}` : `un taux horaire brut de **${t ? eur(t) : "[à compléter]"}**`;
  const p = [`En contrepartie de son travail, ${leSalarie(d)} percevra ${base}.`];
  if (d.primes.length) {
    p.push(`S'y ajoutent les éléments suivants :\n${d.primes.map((x) => `- **${x.libelle}** : ${montantPrime(x)}${x.condition.trim() ? `, ${x.condition.trim()}` : ""}.`).join("\n")}`);
    p.push("Les primes non prévues par la convention collective restent soumises à leurs conditions d'attribution.");
  }
  if (pays === "FR") p.push("Les heures effectuées au-delà de la durée prévue donnent lieu aux majorations prévues par la convention collective et la loi.");
  return p;
}

function repas(d: Donnees, pays: Pays): string[] {
  const v = eur(valeurRepas(d));
  if (d.repas === "nature")
    return [
      `${LeSalarie(d)} bénéficie des repas pris sur place pendant ses services, fournis gratuitement par l'employeur.`,
      pays === "FR"
        ? `Cet avantage en nature est évalué à **${v} par repas**${d.convention === "hcr" ? " (minimum garanti, convention HCR)" : " (barème de la Sécurité sociale)"}, montant réévalué selon la réglementation, et figure sur le bulletin de paie.`
        : `Cet avantage est valorisé à ${v} par repas conformément à la réglementation sociale en vigueur.`,
    ];
  if (d.repas === "indemnite")
    return [`${LeSalarie(d)} ne prenant pas ses repas dans l'établissement, une indemnité compensatrice de nourriture de **${v} par repas dû** lui est versée${pays === "FR" && d.convention === "hcr" ? ", conformément à la convention collective HCR" : ""}, montant réévalué selon la réglementation.`];
  if (d.repas === "titres") {
    const val = num(d.tr_valeur);
    const part = partEmployeurTitre(d);
    return [
      `${LeSalarie(d)} bénéficie d'un titre-restaurant d'une valeur de **${val ? eur(val) : "[à compléter]"}** par jour de travail comprenant un repas.`,
      `L'employeur en finance **${ou(d.tr_part)} %**, soit ${part ? eur(part) : "[à compléter]"} par titre ; le solde est retenu sur le salaire.`,
      "Les titres ne sont pas dus les jours d'absence ni lorsque le repas est fourni par l'employeur.",
    ];
  }
  return ["Les horaires de travail ne comportant pas de période de repas, aucun avantage nourriture n'est prévu."];
}

function tenue(d: Donnees): string[] {
  const p: string[] = [];
  if (d.tenue_fournie) {
    p.push(`L'employeur fournit à ${leSalarie(d)} la tenue de travail, qu'${pronom(d)} s'engage à porter pendant son service. Elle reste la propriété de l'entreprise et devra être restituée au départ.`);
    if (d.entretien === "entreprise") p.push("L'entretien de la tenue est assuré par l'entreprise.");
    else if (d.entretien === "prime") p.push(`L'entretien de la tenue étant assuré par ${leSalarie(d)}, une prime d'entretien de ${num(d.prime_entretien) ? eur(num(d.prime_entretien)) : "[montant à compléter]"} brut par mois lui est versée.`);
  } else {
    p.push(`${LeSalarie(d)} porte une tenue correcte et adaptée à l'activité, conforme aux consignes de l'établissement et aux règles d'hygiène.`);
  }
  if (d.materiel.length) p.push(`Matériel et équipement mis à disposition par l'entreprise :\n${d.materiel.map((m) => `- ${m}`).join("\n")}`);
  else p.push("Aucun matériel spécifique n'est mis à disposition en dehors des équipements de l'établissement.");
  return p;
}

function transport(d: Donnees, pays: Pays) {
  if (!d.transport) return null;
  return pays === "FR"
    ? "L'employeur prend en charge 50 % du prix de l'abonnement aux transports publics souscrit pour le trajet entre la résidence habituelle et le lieu de travail, sur présentation du justificatif."
    : "L'employeur intervient dans les frais de déplacement domicile-lieu de travail conformément aux conventions collectives applicables.";
}

function obligations(d: Donnees) {
  return `${LeSalarie(d)} s'engage à respecter les consignes d'hygiène et de sécurité alimentaire (plan de maîtrise sanitaire, HACCP), le règlement intérieur et les instructions de l'employeur, et à observer une discrétion absolue sur les informations dont ${pronom(d)} aurait connaissance dans l'exercice de ses fonctions.`;
}

function protection(d: Donnees): string[] {
  return [
    `${LeSalarie(d)} est affilié${e(d)} au régime général de la Sécurité sociale et aux régimes de retraite complémentaire et de prévoyance dont relève l'entreprise.`,
    d.caisse_retraite.trim() && `Caisse de retraite complémentaire : ${d.caisse_retraite.trim()}.`,
    d.organisme_prevoyance.trim() && `Organisme de prévoyance : ${d.organisme_prevoyance.trim()}.`,
    d.mutuelle.trim() ? `Complémentaire santé obligatoire de l'entreprise : ${d.mutuelle.trim()}.` : `${LeSalarie(d)} est affilié${e(d)} à la complémentaire santé obligatoire de l'entreprise, sauf dispense prévue par la loi.`,
  ].filter((x): x is string => !!x);
}

function preavisFr(d: Donnees): string[] {
  const c = conventionDe(d);
  const st = statutFr(d);
  const intro = `Après la période d'essai, le contrat peut être rompu par l'une ou l'autre des parties dans les conditions prévues par la loi et par la convention collective, sous réserve d'un préavis notifié par écrit, fixé selon le statut (${STATUTS_FR[st].label.toLowerCase()}) et l'ancienneté :`;
  if (!c.preavis)
    return [intro, `En cas de licenciement (sauf faute grave ou lourde), le préavis ne peut être inférieur à :\n${paliersEnTexte(PREAVIS_LEGAL).map((l) => `- ${l}`).join("\n")}`, "En cas de démission, le préavis est celui prévu par la convention collective ou, à défaut, par les usages de la profession."];
  return [
    intro,
    `En cas de démission :\n${paliersEnTexte(c.preavis.demission[st]).map((l) => `- ${l}`).join("\n")}`,
    `En cas de licenciement (sauf faute grave ou lourde) :\n${paliersEnTexte(c.preavis.licenciement[st]).map((l) => `- ${l}`).join("\n")}`,
    "La partie qui dispense l'autre d'exécuter tout ou partie du préavis lui verse, le cas échéant, l'indemnité compensatrice correspondante.",
  ];
}

/** Briques réutilisées par les avenants. */
export const briques = { parties, eur, dateLongue: date, ou, leSalarie, LeSalarie, num, montantPrime };

/** Texte complet du contrat. */
export function genererContrat(modele: ModeleCle, brut: Donnees): string {
  const d = normaliser(brut);
  const pays = MODELES[modele].pays;
  const h = num(d.heures_hebdo);
  const partiel = h > 0 && h < (pays === "FR" ? 35 : 38);
  const statut = pays === "FR" ? STATUTS_FR[d.statut]?.label ?? "Employé" : d.statut === "ouvrier" ? "ouvrier" : "employé";
  const qualif = pays === "FR" ? `statut ${statut}, niveau ${ou(d.niveau)}, échelon ${ou(d.echelon)} de la grille de classification de la convention collective` : `${statut} relevant de la commission paritaire 302 (Horeca)`;
  const conv = conventionDe(d);
  const extra = modele.endsWith("extra");
  let n = 0;
  const art = (titre: string, ...p: (string | false | null | undefined)[]) => [`## Article ${++n} – ${titre}`, ...p.filter((x): x is string => !!x)].join("\n\n");

  const titre =
    modele === "fr_cdi" ? `Contrat de travail à durée indéterminée${partiel ? " à temps partiel" : ""}` :
    modele === "fr_cdd" ? `Contrat de travail à durée déterminée${partiel ? " à temps partiel" : ""}` :
    modele === "fr_extra" ? "Contrat de travail à durée déterminée d'usage (extra)" :
    modele === "be_extra" ? "Contrat de travail de travailleur occasionnel" :
    `Contrat de travail d'${d.statut === "ouvrier" ? "ouvrier" : "employé"} à durée ${modele === "be_cdi" ? "indéterminée" : "déterminée"}`;
  const sousTitre = pays === "FR" ? conv.intituleComplet : "Commission paritaire 302 – Industrie hôtelière";

  const tete = [`# ${titre}`, `#> ${sousTitre}`, enBref(modele, d), parties(d, pays), "**Il a été convenu ce qui suit :**"];
  const avantages = () => [art("Repas", ...repas(d, pays)), art("Tenue et matériel", ...tenue(d)), ...(transport(d, pays) ? [art("Frais de transport", transport(d, pays))] : [])];
  const clauses = () => (d.clauses.trim() ? [art("Dispositions particulières", d.clauses.trim())] : []);
  const fait = `Fait à ${ou(d.fait_a)}, le ${date(d.fait_le)}, en deux exemplaires originaux dont un remis à ${leSalarie(d)}.`;

  if (modele === "fr_cdi" || modele === "fr_cdd") {
    const cdd = modele === "fr_cdd";
    const motif = d.motif === "remplacement" ? `du remplacement de ${ou(d.motif_detail)}, absent(e)` : d.motif === "saisonnier" ? `d'un emploi à caractère saisonnier${d.motif_detail.trim() ? ` (${d.motif_detail.trim()})` : ""}` : `d'un accroissement temporaire d'activité${d.motif_detail.trim() ? ` : ${d.motif_detail.trim()}` : ""}`;
    return [
      ...tete,
      ...(cdd ? [art("Motif du contrat", `Le présent contrat est conclu en application de l'article L. 1242-2 du Code du travail, au titre ${motif}.`)] : []),
      art(
        cdd ? "Durée du contrat" : "Engagement",
        cdd
          ? d.date_fin
            ? `Le contrat prend effet le ${date(d.date_debut)} et prend fin le ${date(d.date_fin)}. Il pourra être renouvelé dans les limites légales, par avenant accepté avant son terme.`
            : `Le contrat prend effet le ${date(d.date_debut)}, pour une durée minimale de ${ou(d.duree_minimale)}, et prend fin au retour du salarié remplacé.`
          : `${LeSalarie(d)} est engagé${e(d)} à compter du ${date(d.date_debut)} pour une durée indéterminée, sous réserve des résultats de la visite d'information et de prévention.`,
        `Le présent contrat est régi par la ${conv.intituleComplet.charAt(0).toLowerCase() + conv.intituleComplet.slice(1)}, tenue à disposition dans l'établissement.`,
      ),
      art("Fonctions et qualification", `${LeSalarie(d)} occupe l'emploi de **${ou(d.fonction)}**, ${qualif}.`, !cdd && "Ces fonctions pourront évoluer selon les nécessités de l'entreprise, sans modification de la qualification."),
      art(
        "Période d'essai",
        cdd
          ? `Le contrat comporte une période d'essai de **${ou(d.essai)}**, pendant laquelle chacune des parties peut y mettre fin sans indemnité.`
          : `Le contrat ne deviendra définitif qu'à l'issue d'une période d'essai de **${ou(d.essai)}** de travail effectif, pendant laquelle chacune des parties pourra y mettre fin en respectant le délai de prévenance légal.`,
        !cdd && (d.essai_renouvelable && !renouvellementEssai(d).interdit ? `Elle pourra être renouvelée une fois${renouvellementEssai(d).mois ? `, pour une durée maximale de ${renouvellementEssai(d).mois} mois` : ""}, par accord écrit des deux parties conclu avant son terme.` : "Elle n'est pas renouvelable."),
        `En cas de rupture pendant l'essai, l'employeur respecte un délai de prévenance de ${PREVENANCE_ESSAI.employeur.join(", ")} ; ${leSalarie(d)} respecte un délai de ${PREVENANCE_ESSAI.salarie.join(", ")}.`,
      ),
      art("Lieu de travail", `${LeSalarie(d)} exerce ses fonctions à ${ou(d.lieu_travail)}.`),
      art(
        "Durée du travail",
        partiel
          ? `${LeSalarie(d)} est engagé${e(d)} à temps partiel pour **${heures(h)} heures par semaine**, réparties comme suit : ${ou(d.repartition)}. Cette répartition peut être modifiée en respectant un délai de prévenance de 7 jours. Les heures complémentaires ne peuvent excéder le dixième de la durée prévue, sauf accord collectif le permettant.`
          : `La durée du travail est fixée à **${heures(h)} heures par semaine**${d.repartition.trim() ? `, réparties comme suit : ${d.repartition.trim()}` : ""}. Les horaires sont communiqués par le planning affiché dans l'établissement.`,
        "Compte tenu de l'activité de restauration, le travail peut être organisé les week-ends et jours fériés, dans le respect du repos hebdomadaire.",
      ),
      art("Rémunération", ...remuneration(d, pays, true), cdd && d.motif !== "saisonnier" && `À l'issue du contrat, ${leSalarie(d)} percevra, sauf exceptions légales, une indemnité de fin de contrat égale à 10 % de la rémunération totale brute perçue, ainsi qu'une indemnité compensatrice de congés payés.`),
      ...avantages(),
      ...(!cdd ? [art("Congés payés", `${LeSalarie(d)} bénéficie des congés payés prévus par la loi, soit 2,5 jours ouvrables par mois de travail effectif, dont les dates sont fixées par l'employeur.`)] : []),
      art("Protection sociale", ...protection(d)),
      art("Formation", `${LeSalarie(d)} bénéficie des actions de formation prévues par le plan de développement des compétences de l'entreprise et de son compte personnel de formation (CPF). Un entretien professionnel est organisé tous les deux ans.`),
      art("Obligations professionnelles", obligations(d)),
      ...clauses(),
      cdd
        ? art("Rupture anticipée", `Avant son terme, le contrat ne peut être rompu que d'un commun accord, en cas de faute grave ou de force majeure, d'inaptitude constatée par le médecin du travail, ou à l'initiative de ${leSalarie(d)} qui justifie d'une embauche en contrat à durée indéterminée ; ${d.civilite === "Mme" ? "elle" : "il"} respecte alors un préavis d'un jour par semaine de contrat, dans la limite de deux semaines.`)
        : art("Rupture du contrat et préavis", ...preavisFr(d)),
      fait,
    ].join("\n\n");
  }

  if (modele === "fr_extra") {
    return [
      ...tete,
      art("Motif", "Le présent contrat est conclu en application des articles L. 1242-2 3° et D. 1242-1 du Code du travail, l'emploi d'extra relevant d'un usage constant dans le secteur des hôtels, cafés, restaurants, en raison de la nature de l'activité et du caractère par nature temporaire de cet emploi."),
      art("Mission", `${LeSalarie(d)} est engagé${e(d)} en qualité de **${ou(d.fonction)}** (${qualif}) pour la mission suivante : le ${date(d.date_debut)}${d.date_fin && d.date_fin !== d.date_debut ? ` au ${date(d.date_fin)}` : ""}, ${ou(d.horaires_mission, "horaires communiqués à l'embauche")}.`, `Lieu : ${ou(d.lieu_travail)}.`),
      art("Rémunération", ...remuneration(d, pays, false), "Conformément à l'usage, le contrat d'extra ne donne pas lieu à l'indemnité de fin de contrat. L'indemnité compensatrice de congés payés (10 %) est versée à l'issue de la mission."),
      ...avantages(),
      art("Protection sociale", ...protection(d)),
      art("Obligations professionnelles", obligations(d)),
      art("Rupture anticipée", "Avant son terme, le contrat ne peut être rompu que d'un commun accord, en cas de faute grave ou de force majeure, ou d'inaptitude constatée par le médecin du travail."),
      ...clauses(),
      fait,
    ].join("\n\n");
  }

  // Belgique (CP 302)
  const regime = partiel ? `à temps partiel, **${heures(h)} heures par semaine**, selon l'horaire suivant : ${ou(d.repartition)}` : `à temps plein, **${heures(h)} heures par semaine**${d.repartition.trim() ? ` (${d.repartition.trim()})` : ""}`;
  if (extra) {
    return [
      ...tete,
      art("Objet", `L'employeur engage ${leSalarie(d)} en qualité de travailleur occasionnel (extra) dans le secteur Horeca (CP 302), en tant que **${ou(d.fonction)}**, conformément à l'article 31ter de l'arrêté royal du 28 novembre 1969.`),
      art("Durée et horaire", `Le contrat est conclu pour le ${date(d.date_debut)}${d.date_fin && d.date_fin !== d.date_debut ? ` au ${date(d.date_fin)}` : ""}, ${ou(d.horaires_mission, "selon l'horaire convenu")}. Une déclaration Dimona est effectuée avant le début des prestations. Le travailleur occasionnel ne peut être occupé plus de 50 jours par année civile sous ce régime.`),
      art("Rémunération", ...remuneration(d, pays, false)),
      ...avantages(),
      art("Obligations professionnelles", obligations(d)),
      ...clauses(),
      fait,
    ].join("\n\n");
  }
  return [
    ...tete,
    art("Engagement", `L'employeur engage ${leSalarie(d)} en qualité de **${ou(d.fonction)}**, ${qualif}, à partir du ${date(d.date_debut)}${modele === "be_cdd" ? ` jusqu'au ${date(d.date_fin)}` : " pour une durée indéterminée"}.`, "Le contrat est régi par la loi du 3 juillet 1978 relative aux contrats de travail et par les conventions collectives de la commission paritaire 302."),
    art("Lieu de travail", ou(d.lieu_travail)),
    art("Durée du travail", `${LeSalarie(d)} est occupé${e(d)} ${regime}. L'horaire de travail figure au règlement de travail.`),
    art("Rémunération", ...remuneration(d, pays, true), "La rémunération est payée par virement, au plus tard le quatrième jour ouvrable qui suit la période de paie. Elle suit l'indexation prévue par la commission paritaire."),
    ...avantages(),
    art("Vacances annuelles", "Le travailleur bénéficie des vacances annuelles et du pécule de vacances conformément à la législation belge."),
    art("Règlement de travail", `${LeSalarie(d)} reconnaît avoir reçu un exemplaire du règlement de travail de l'entreprise.`),
    art("Obligations professionnelles", obligations(d)),
    ...clauses(),
    modele === "be_cdi"
      ? art(
          "Fin du contrat et préavis",
          "Le contrat peut être rompu moyennant un préavis notifié par écrit, qui prend cours le lundi suivant sa notification. Le délai est calculé selon l'ancienneté, conformément à l'article 37/2 de la loi du 3 juillet 1978.",
          `En cas de démission, le préavis est de :\n${paliersEnTexte(PREAVIS_DEMISSION_BE).map((l) => `- ${l}`).join("\n")}`,
          "En cas de licenciement, l'employeur respecte le délai légal fixé par le même article selon l'ancienneté du travailleur.",
        )
      : art("Fin du contrat", "Le contrat prend fin de plein droit à son terme. Des contrats à durée déterminée successifs ne sont possibles que dans les limites légales."),
    fait,
  ].join("\n\n");
}

/** Nom du contrat (et du fichier PDF) : NOM_Prénom_TYPE_POSTE_DATE, ex. MARTIN_Léa_CDI_Serveuse_2026-10-05. */
export function nomContrat(modele: ModeleCle, brut: Partial<Donnees>) {
  const d = normaliser(brut);
  const propre = (s: string) => s.trim().replace(/[\/:*?"<>|]+/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-");
  // « Serveur / Serveuse » → la forme qui correspond à la personne.
  const formes = d.fonction.split(" / ");
  const poste = formes.length === 2 ? formes[d.civilite === "Mme" ? 1 : 0] : d.fonction;
  return [propre(d.nom).toUpperCase(), propre(d.prenom), MODELES[modele].court.toUpperCase(), propre(poste), d.date_debut || "sans-date"].filter(Boolean).join("_");
}

// ——— Lecture du texte pour l'affichage ———

export type Bloc =
  | { type: "titre"; texte: string }
  | { type: "soustitre"; texte: string }
  | { type: "article"; texte: string }
  | { type: "para"; texte: string }
  | { type: "bref"; lignes: [string, string][] }
  | { type: "partie"; titre: string; lignes: string[] }
  | { type: "liste"; intro: string | null; items: string[] };

export function blocs(texte: string): Bloc[] {
  const res: Bloc[] = [];
  for (const b of texte.split(/\n{2,}/)) {
    if (b.startsWith("# ")) res.push({ type: "titre", texte: b.slice(2) });
    else if (b.startsWith("#> ")) res.push({ type: "soustitre", texte: b.slice(3) });
    else if (b.startsWith("## ")) res.push({ type: "article", texte: b.slice(3) });
    else if (b.startsWith("| ")) res.push({ type: "bref", lignes: b.split("\n").map((l) => l.slice(2).split(" | ") as [string, string]) });
    else if (b.startsWith("@ ")) {
      const [t, ...l] = b.split("\n");
      res.push({ type: "partie", titre: t.slice(2), lignes: l });
    } else if (/(^|\n)- /.test(b)) {
      const l = b.split("\n");
      const intro = l[0].startsWith("- ") ? null : l.shift()!;
      res.push({ type: "liste", intro, items: l.map((x) => x.replace(/^- /, "")) });
    } else res.push({ type: "para", texte: b });
  }
  return res;
}
