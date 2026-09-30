// Calculs de fin de contrat (droit français) : ancienneté, indemnité légale de licenciement,
// préavis légal, délai de prévenance de la période d'essai, calendrier de la rupture conventionnelle.
// Pur : aucun accès réseau. Les conventions collectives peuvent prévoir plus favorable.
import { ajouterJours } from "@/lib/planning";
import { reperes } from "@/lib/evenements";

const jourMs = 864e5;
const t = (iso: string) => new Date(iso + "T12:00").getTime();

/** Ancienneté entre deux dates, en années (décimales) et en mois entiers. */
export function anciennete(debut: string, fin: string) {
  if (!debut || !fin || fin < debut) return { annees: 0, mois: 0 };
  const a = new Date(debut + "T12:00");
  const b = new Date(fin + "T12:00");
  let mois = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) mois -= 1;
  return { annees: mois / 12, mois: Math.max(0, mois) };
}

/**
 * Indemnité légale de licenciement (art. L1234-9 et R1234-2) : dès 8 mois d'ancienneté,
 * 1/4 de mois de salaire par année jusqu'à 10 ans, puis 1/3 de mois par année au-delà
 * (années incomplètes au prorata). Sert aussi de plancher à l'indemnité de rupture conventionnelle.
 */
export function indemniteLegale(salaireReference: number, annees: number) {
  if (!(salaireReference > 0) || annees < 8 / 12) return 0;
  const jusqua10 = Math.min(annees, 10);
  const auDela = Math.max(0, annees - 10);
  return Math.round((salaireReference * (jusqua10 / 4 + auDela / 3)) * 100) / 100;
}

/** Préavis légal de licenciement (art. L1234-1), hors faute grave ou lourde. */
export function preavisLegal(moisAnciennete: number) {
  if (moisAnciennete >= 24) return "2 mois";
  if (moisAnciennete >= 6) return "1 mois";
  return "selon la convention collective (HCR : 8 jours pour un employé)";
}

/** Délai de prévenance quand l'employeur rompt la période d'essai (art. L1221-25). */
export function prevenanceEssai(joursPresence: number) {
  if (joursPresence < 8) return { libelle: "24 heures", jours: 1 };
  if (joursPresence <= 31) return { libelle: "48 heures", jours: 2 };
  if (joursPresence <= 92) return { libelle: "2 semaines", jours: 14 };
  return { libelle: "1 mois", jours: 30 };
}

export const joursEntre = (debut: string, fin: string) => (debut && fin ? Math.round((t(fin) - t(debut)) / jourMs) : 0);

function feries(annee: number) {
  return new Set(reperes(annee).filter((r) => r.type === "Jour férié").map((r) => r.date));
}

/** Jour ouvrable : du lundi au samedi, hors jours fériés. */
export function estOuvrable(iso: string) {
  const d = new Date(iso + "T12:00");
  return d.getDay() !== 0 && !feries(d.getFullYear()).has(iso);
}

/** Ajoute n jours ouvrables, décompte commençant le lendemain. */
export function ajouterOuvrables(iso: string, n: number) {
  let x = iso;
  let reste = n;
  while (reste > 0) {
    x = ajouterJours(x, 1);
    if (estOuvrable(x)) reste--;
  }
  return x;
}

/**
 * Calendrier d'une rupture conventionnelle (art. L1237-13 et L1237-14) :
 * rétractation de 15 jours calendaires à compter du lendemain de la signature (reportée au premier
 * jour ouvrable s'il tombe un samedi, dimanche ou jour férié) ; demande d'homologation le lendemain ;
 * instruction de 15 jours ouvrables ; fin du contrat au plus tôt le lendemain de l'homologation.
 */
export function calendrierRupture(signature: string) {
  if (!signature) return null;
  // Un délai qui expire un samedi, un dimanche ou un jour férié est prorogé (art. R1231-1).
  let finRetractation = ajouterJours(signature, 15);
  while ([0, 6].includes(new Date(finRetractation + "T12:00").getDay()) || !estOuvrable(finRetractation)) finRetractation = ajouterJours(finRetractation, 1);
  const depot = ajouterJours(finRetractation, 1);
  const homologation = ajouterOuvrables(depot, 15);
  const finAuPlusTot = ajouterJours(homologation, 1);
  return { finRetractation, depot, homologation, finAuPlusTot };
}
