// Finance : indicateurs calculés à partir des données de Juliette. Aucun accès réseau ici.
//
// - Chiffre d'affaires : bons encaissés (statut « terminee »), datés du moment de l'encaissement.
//   Les prix de la carte sont TTC ; le HT est estimé avec la TVA de la restauration sur place (10 %).
// - Coût matière : ingrédients décomptés à la vente × prix du catalogue (tarif fournisseur) ; à défaut,
//   le coût matière enregistré sur l'article de la carte.
// - Pertes : quantité × prix du catalogue. Achats : commandes fournisseurs envoyées (HT).
// - Masse salariale : heures pointées × taux horaire brut (sans charges patronales).

import { ajouterJours, iso } from "@/lib/planning";
import { VARIATION_AFFLUENCE } from "@/lib/evenements";
import type { Evenement } from "@/lib/evenements";

export const TVA_SUR_PLACE = 0.1;

export type LigneVente = { produitId: string; nom: string; quantite: number; prixCentimes: number; ingredients?: { productId: string; quantite: number }[] };
export type BonVendu = { id: string; updated_at: string; lignes: LigneVente[]; type_commande?: string | null; couverts?: number };

export function jourDe(isoDate: string) {
  return iso(new Date(isoDate));
}

export function caParJour(bons: BonVendu[], jours: string[]) {
  const m = new Map(jours.map((j) => [j, 0]));
  for (const b of bons) {
    const j = jourDe(b.updated_at);
    if (m.has(j)) m.set(j, m.get(j)! + totalTTC(b));
  }
  return jours.map((j) => ({ jour: j, ttc: m.get(j)! / 100 }));
}

export const totalTTC = (b: Pick<BonVendu, "lignes">) => (b.lignes ?? []).reduce((s, l) => s + Number(l.quantite) * Number(l.prixCentimes), 0);

/** Coût matière d'un bon (€) : ingrédients décomptés × prix catalogue, sinon coût enregistré sur la carte. */
export function coutMatiere(b: BonVendu, prix: Map<string, number>, coutCarte: Map<string, number>) {
  let total = 0;
  let complet = true;
  for (const l of b.lignes ?? []) {
    if (l.ingredients?.length) {
      for (const i of l.ingredients) {
        const p = prix.get(i.productId);
        if (p === undefined) complet = false;
        else total += Number(i.quantite) * p * Number(l.quantite);
      }
    } else if (coutCarte.has(l.produitId)) {
      total += (coutCarte.get(l.produitId)! / 100) * Number(l.quantite);
    } else complet = false;
  }
  return { total, complet };
}

export function topVentes(bons: BonVendu[]) {
  const m = new Map<string, { nom: string; quantite: number; ttc: number }>();
  for (const b of bons)
    for (const l of b.lignes ?? []) {
      const e = m.get(l.nom) ?? { nom: l.nom, quantite: 0, ttc: 0 };
      e.quantite += Number(l.quantite);
      e.ttc += (Number(l.quantite) * Number(l.prixCentimes)) / 100;
      m.set(l.nom, e);
    }
  return [...m.values()].sort((a, b) => b.ttc - a.ttc);
}

/**
 * Prévision indicative : moyenne du CA du même jour de la semaine sur les semaines passées
 * (jours sans vente exclus), ajustée par les événements du jour (hausse / baisse selon l'intensité).
 */
export function prevision(historique: { jour: string; ttc: number }[], evenements: Pick<Evenement, "date" | "date_fin" | "sens" | "impact" | "nom">[], debut: string, nbJours = 7) {
  const parJourSemaine = new Map<number, number[]>();
  for (const h of historique) {
    if (h.ttc <= 0) continue;
    const js = new Date(h.jour + "T00:00").getDay();
    parJourSemaine.set(js, [...(parJourSemaine.get(js) ?? []), h.ttc]);
  }
  return Array.from({ length: nbJours }, (_, i) => {
    const jour = ajouterJours(debut, i);
    const valeurs = parJourSemaine.get(new Date(jour + "T00:00").getDay()) ?? [];
    const base = valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : null;
    const evts = evenements.filter((e) => e.date <= jour && (e.date_fin ?? e.date) >= jour);
    const facteur = evts.reduce((f, e) => f * (1 + (e.sens === "hausse" ? 1 : -1) * VARIATION_AFFLUENCE[e.impact]), 1);
    return { jour, base, estimation: base !== null ? base * facteur : null, facteur, evenements: evts.map((e) => e.nom), echantillon: valeurs.length };
  });
}

export const eur = (n: number, dec = 0) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: dec, minimumFractionDigits: dec });
export const pct = (n: number | null) => (n === null || !Number.isFinite(n) ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
