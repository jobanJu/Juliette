"use client";

// Chargement commun aux modules Stocks, Pertes, Commandes et Réception.
// Chaque table est facultative : si la base refuse l'accès (module non autorisé), elle reste vide.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { calculerStocks } from "@/lib/stock";
import type { ALigneListe, Commande, Fournisseur, Mouvement, Perte, Produit, ProduitZone, Reception, Releve, Zone } from "@/lib/stock";

const JOURS = 180;

export type DonneesStock = {
  produits: Produit[];
  zones: Zone[];
  produitZones: ProduitZone[];
  releves: Releve[];
  pertes: Perte[];
  mouvements: Mouvement[];
  receptions: Reception[];
  fournisseurs: Fournisseur[];
  liste: ALigneListe[];
  commandes: Commande[];
};

export function useStock(etablissementId: string) {
  const [d, setD] = useState<DonneesStock | null>(null);
  const [version, setVersion] = useState(0);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vivant = true;
    const sb = getSupabaseClient()!;
    const depuis = new Date(Date.now() - JOURS * 864e5).toISOString();
    const e = etablissementId;
    Promise.all([
      sb.from("produits").select("id, nom, unite, origine, fournisseur, conditionnement, conservation, prix_unitaire, reference_fournisseur, unite_alternative, seuil, niveau_cible, famille, sous_categorie").eq("etablissement_id", e).order("nom"),
      sb.from("zones_stockage").select("id, titre, couleur, note, ordre").eq("etablissement_id", e).order("ordre"),
      sb.from("produit_zones").select("produit_id, zone_id, produits!inner(etablissement_id)").eq("produits.etablissement_id", e),
      sb.from("inventaire_releves").select("id, produit_id, zone_id, valeur, created_at, created_by").eq("etablissement_id", e).gte("created_at", depuis).limit(20000),
      sb.from("pertes").select("id, produit_id, date, valeur, motif, precision, created_by, created_at").eq("etablissement_id", e).gte("created_at", depuis).order("created_at", { ascending: false }).limit(5000),
      sb.from("mouvements_stock_commandes").select("produit_id, variation, created_at").eq("etablissement_id", e).gte("created_at", depuis).limit(20000),
      sb.from("receptions").select("id, commande_id, fournisseur_nom, fournisseur_email, received_at, received_by, temperature_camion, lignes, signalement_envoye").eq("etablissement_id", e).gte("received_at", depuis).order("received_at", { ascending: false }),
      sb.from("fournisseurs").select("id, nom, email, tva_pct, minimum_commande").eq("etablissement_id", e).order("nom"),
      sb.from("commande_liste").select("produit_id, quantite, added_at").eq("etablissement_id", e),
      sb.from("commandes_envoyees").select("id, fournisseur_id, fournisseur_nom, fournisseur_email, envoyee_at, lignes, created_by, email_statut, email_erreur, email_envoye_at").eq("etablissement_id", e).gte("envoyee_at", depuis).order("envoyee_at", { ascending: false }),
    ]).then(([pr, zo, pz, re, pe, mo, rc, fo, li, co]) => {
      if (!vivant) return;
      setD({
        produits: (pr.data ?? []) as Produit[],
        zones: (zo.data ?? []) as Zone[],
        produitZones: ((pz.data ?? []) as { produit_id: string; zone_id: string }[]).map(({ produit_id, zone_id }) => ({ produit_id, zone_id })),
        releves: (re.data ?? []) as Releve[],
        pertes: (pe.data ?? []) as Perte[],
        mouvements: (mo.data ?? []) as Mouvement[],
        receptions: (rc.data ?? []) as Reception[],
        fournisseurs: (fo.data ?? []) as Fournisseur[],
        liste: (li.data ?? []) as ALigneListe[],
        commandes: (co.data ?? []) as Commande[],
      });
    });
    return () => {
      vivant = false;
    };
  }, [etablissementId, version]);

  const stocks = useMemo(() => (d ? calculerStocks(d.produits, d.releves, d.receptions, d.pertes, d.mouvements) : new Map()), [d]);
  const produitParId = useMemo(() => new Map((d?.produits ?? []).map((p) => [p.id, p])), [d]);

  return { d, stocks, produitParId, recharger };
}
