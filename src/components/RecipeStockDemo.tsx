"use client";

import { useEffect, useState } from "react";

const TOMATOES_PER_PORTION = 3;
const OIL_GRAMS_PER_PORTION = 30;

export default function RecipeStockDemo({ onSale }: { onSale?: () => void }) {
  const [soldPortions, setSoldPortions] = useState(0);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    // Différé d'un tick, comme dans Dashboard : pas de setState synchrone dans un effet.
    void Promise.resolve().then(() => {
      const saved = Number(localStorage.getItem("juliette-demo-sauce-sales"));
      if (Number.isFinite(saved) && saved > 0) setSoldPortions(Math.floor(saved));
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (storageReady) localStorage.setItem("juliette-demo-sauce-sales", String(soldPortions));
  }, [soldPortions, storageReady]);

  const remainingTomatoes = 120 - soldPortions * TOMATOES_PER_PORTION;
  const remainingOil = 1500 - soldPortions * OIL_GRAMS_PER_PORTION;
  const canSell = remainingTomatoes >= TOMATOES_PER_PORTION && remainingOil >= OIL_GRAMS_PER_PORTION;

  return (
    <section className="recipe-flow" aria-label="Démonstration du lien entre recette et stock">
      <div className="recipe-copy">
        <p className="eyebrow">RECETTES CONNECTÉES AU STOCK</p>
        <h2>Chaque plat vendu met le stock à jour.</h2>
        <p>Valide une portion pour voir les ingrédients déduits.</p>
      </div>
      <div className="recipe-dish">
        <span className="dish-mark">✳</span>
        <span><b>Sauce tomate maison</b><small>{soldPortions} portion{soldPortions > 1 ? "s" : ""} vendue{soldPortions > 1 ? "s" : ""}</small></span>
      </div>
      <span className="recipe-arrow" aria-hidden="true">→</span>
      <div className="ingredient-list">
        <span><i className="ingredient-dot tomato"/><b>3 tomates</b><small>− {soldPortions * TOMATOES_PER_PORTION}</small></span>
        <span><i className="ingredient-dot oil"/><b>Huile d’olive</b><small>− {soldPortions * OIL_GRAMS_PER_PORTION} g</small></span>
      </div>
      <div className="recipe-stock">
        <span className="stock-check">✓</span>
        <span><b>{remainingTomatoes} tomates · {remainingOil} g</b><small>Restant en stock</small></span>
      </div>
      <button className="recipe-action" onClick={() => { setSoldPortions((count) => count + 1); onSale?.(); }} disabled={!canSell}>
        {canSell ? "＋ Simuler une vente" : "Stock insuffisant"}
      </button>
    </section>
  );
}
