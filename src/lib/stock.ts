// Stock & achats : types, libellés et calcul du stock théorique. Aucun accès réseau ici.
//
// Stock théorique d'un produit =
//   dernier inventaire (dernier relevé de chaque zone, additionnés)
//   + quantités reçues depuis (réceptions)
//   − pertes déclarées depuis
//   + mouvements depuis (les ventes en salle décomptent les ingrédients, variation négative).
// Un produit jamais inventorié a un stock inconnu (null) : on ne devine pas.

import type { Famille } from "@/lib/categories";

export type Produit = {
  id: string;
  nom: string;
  unite: string;
  origine: "achat" | "fabrication" | null;
  fournisseur: string | null;
  conditionnement: string | null;
  conservation: string | null;
  prix_unitaire: number | null;
  reference_fournisseur: string | null;
  unite_alternative: string | null;
  seuil: number | null;
  niveau_cible: number | null;
  famille: Famille | null;
  sous_categorie: string | null;
};

export type Zone = { id: string; titre: string; couleur: string | null; note: string | null; ordre: number };
export type ProduitZone = { produit_id: string; zone_id: string };
export type Releve = { id: string; produit_id: string; zone_id: string; valeur: number; created_at: string; created_by: string | null };
export type Perte = { id: string; produit_id: string; date: string; valeur: number; motif: string; precision: string | null; created_by: string | null; created_at: string };
export type Mouvement = { produit_id: string; variation: number; created_at: string };
export type Fournisseur = { id: string; nom: string; email: string | null; tva_pct: number | null; minimum_commande: number | null };
export type ALigneListe = { produit_id: string; quantite: number; added_at: string };

export type LigneCommande = { produit_id?: string; nom: string; unite: string; quantite: number; prixUnitaireHT: number; reference?: string | null };
export type Commande = { id: string; fournisseur_id: string | null; fournisseur_nom: string; fournisseur_email: string | null; envoyee_at: string; lignes: LigneCommande[]; created_by: string | null; email_statut?: string; email_erreur?: string | null; email_envoye_at?: string | null };

export type EtatReception = "conforme" | "manquant" | "incomplet" | "abime" | "refuse";
export type LigneReception = {
  produit_id?: string;
  nom: string;
  unite: string;
  quantiteCommandee: number;
  quantiteRecue: number;
  etat: EtatReception;
  temperatureProduit?: number | null;
  note?: string;
};
export type Reception = {
  id: string;
  commande_id: string | null;
  fournisseur_nom: string;
  fournisseur_email: string | null;
  received_at: string;
  received_by: string;
  temperature_camion: number | null;
  lignes: LigneReception[];
  signalement_envoye: boolean;
};

export const MOTIFS_PERTE: Record<string, { label: string; couleur: string }> = {
  dlc: { label: "DLC dépassée", couleur: "#e9c46a" },
  casse: { label: "Casse", couleur: "#e58f86" },
  erreur_preparation: { label: "Erreur de préparation", couleur: "#b6a6e0" },
  retour_client: { label: "Retour client", couleur: "#7fb7d6" },
  controle_qualite: { label: "Contrôle qualité", couleur: "#8fcfa9" },
  autre: { label: "Autre", couleur: "#b8b3c2" },
};

export const ETATS_RECEPTION: Record<EtatReception, { label: string; ton: string }> = {
  conforme: { label: "Conforme", ton: "t-mint" },
  incomplet: { label: "Quantité différente", ton: "t-yellow" },
  manquant: { label: "Manquant", ton: "t-red" },
  abime: { label: "Abîmé", ton: "t-peach" },
  refuse: { label: "Refusé", ton: "t-red" },
};

export const UNITES = ["kg", "g", "L", "cl", "pièce", "botte", "barquette", "sachet", "boîte", "bouteille", "carton", "portion"];

export type EtatStock = { quantite: number | null; depuis: string | null; statut: "inconnu" | "rupture" | "bas" | "ok" };

export function calculerStocks(
  produits: Produit[],
  releves: Releve[],
  receptions: Reception[],
  pertes: Perte[],
  mouvements: Mouvement[],
): Map<string, EtatStock> {
  // Dernier relevé de chaque couple (produit, zone).
  const dernier = new Map<string, Releve>();
  for (const r of releves) {
    const k = `${r.produit_id}|${r.zone_id}`;
    const d = dernier.get(k);
    if (!d || r.created_at > d.created_at) dernier.set(k, r);
  }
  const base = new Map<string, { q: number; date: string }>();
  for (const r of dernier.values()) {
    const b = base.get(r.produit_id) ?? { q: 0, date: "" };
    b.q += Number(r.valeur);
    if (r.created_at > b.date) b.date = r.created_at;
    base.set(r.produit_id, b);
  }

  const res = new Map<string, EtatStock>();
  for (const p of produits) {
    const b = base.get(p.id);
    if (!b) {
      res.set(p.id, { quantite: null, depuis: null, statut: "inconnu" });
      continue;
    }
    let q = b.q;
    for (const rc of receptions) {
      if (rc.received_at <= b.date) continue;
      for (const l of rc.lignes ?? []) {
        if (l.produit_id === p.id && l.etat !== "refuse") q += Number(l.quantiteRecue) || 0;
      }
    }
    for (const pe of pertes) if (pe.produit_id === p.id && pe.created_at > b.date) q -= Number(pe.valeur);
    for (const m of mouvements) if (m.produit_id === p.id && m.created_at > b.date) q += Number(m.variation);
    q = Math.round(q * 1000) / 1000;
    const statut = q <= 0 ? "rupture" : p.seuil != null && q <= Number(p.seuil) ? "bas" : "ok";
    res.set(p.id, { quantite: q, depuis: b.date, statut });
  }
  return res;
}

/** Quantité à commander pour revenir au niveau cible (ou à deux fois le seuil faute de cible). */
export function quantiteSuggeree(p: Produit, stock: number | null) {
  const cible = p.niveau_cible != null ? Number(p.niveau_cible) : p.seuil != null ? Number(p.seuil) * 2 : null;
  if (cible == null) return null;
  const q = cible - Math.max(0, stock ?? 0);
  return q > 0 ? Math.ceil(q * 10) / 10 : null;
}

export const memeNom = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function formatQte(q: number | null | undefined, unite = "") {
  if (q == null) return "—";
  return `${Number(q).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}${unite ? ` ${unite}` : ""}`;
}

export const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export const STATUT_STOCK: Record<EtatStock["statut"], { label: string; ton: string }> = {
  inconnu: { label: "Non inventorié", ton: "t-lav" },
  rupture: { label: "Rupture", ton: "t-red" },
  bas: { label: "Sous le seuil", ton: "t-peach" },
  ok: { label: "OK", ton: "t-mint" },
};
