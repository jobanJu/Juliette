"use client";

// Tarif de la formule, lu côté serveur dans Stripe.
import { useEffect, useState } from "react";

export type TarifPublic = { disponible: boolean; montant?: number; devise?: string; intervalle?: string; essaiJours?: number };

export function useTarif() {
  const [tarif, setTarif] = useState<TarifPublic | null>(null);
  useEffect(() => {
    fetch("/api/souscription/tarif")
      .then((r) => r.json())
      .then(setTarif)
      .catch(() => setTarif({ disponible: false }));
  }, []);
  return tarif;
}

export function prixLisible(t: TarifPublic) {
  if (!t.disponible || t.montant == null) return null;
  const montant = t.montant.toLocaleString("fr-FR", { style: "currency", currency: t.devise ?? "EUR", maximumFractionDigits: t.montant % 1 ? 2 : 0 });
  const periode = t.intervalle === "year" ? "an" : t.intervalle === "week" ? "semaine" : t.intervalle === "day" ? "jour" : "mois";
  return { montant, periode };
}
