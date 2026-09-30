"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { ALLERGENES, COLONNES_FICHE, coutsFiche, euros, tonRatio } from "@/lib/fiches";
import type { Fiche } from "@/lib/fiches";
import type { Produit } from "@/lib/stock";
import Icone from "@/components/Icone";

export default function FichesTechniques() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const [fiches, setFiches] = useState<Fiche[] | null>(null);
  const [produits, setProduits] = useState<Map<string, Produit>>(new Map());
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("toutes");
  const [tri, setTri] = useState<"nom" | "ratio">("nom");

  useEffect(() => {
    let vivant = true;
    const sb = getSupabaseClient()!;
    Promise.all([
      sb.from("fiches_techniques").select(COLONNES_FICHE).eq("etablissement_id", etablissement.id).order("nom"),
      gestion ? sb.from("produits").select("id, nom, unite, prix_unitaire").eq("etablissement_id", etablissement.id) : null,
    ]).then(([f, p]) => {
      if (!vivant) return;
      setFiches((f.data ?? []) as Fiche[]);
      setProduits(new Map(((p?.data ?? []) as Produit[]).map((x) => [x.id, x])));
    });
    return () => {
      vivant = false;
    };
  }, [etablissement.id, gestion]);

  const categories = useMemo(() => [...new Set((fiches ?? []).map((f) => f.categorie?.trim()).filter(Boolean) as string[])].sort(), [fiches]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (fiches ?? [])
      .map((f) => ({ f, c: coutsFiche(f, produits) }))
      .filter(({ f }) => categorie === "toutes" || f.categorie?.trim() === categorie)
      .filter(({ f }) => !q || `${f.nom} ${f.categorie ?? ""} ${(f.ingredients ?? []).map((i) => i.name).join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => (tri === "ratio" ? (b.c.ratio ?? -1) - (a.c.ratio ?? -1) : a.f.nom.localeCompare(b.f.nom)));
  }, [fiches, produits, recherche, categorie, tri]);

  const stats = useMemo(() => {
    const avecRatio = liste.filter((l) => l.c.ratio !== null);
    return {
      moyen: avecRatio.length ? avecRatio.reduce((s, l) => s + l.c.ratio!, 0) / avecRatio.length : null,
      eleves: avecRatio.filter((l) => l.c.ratio! > 35).length,
      sansPrix: liste.filter((l) => !l.f.prix_vente_ttc).length,
    };
  }, [liste]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Établissement</p>
          <h1>Fiches techniques</h1>
          <p>Recettes, grammages, allergènes{gestion ? " et coût matière" : ""}.</p>
        </div>
        {gestion && (
          <Link className="btn btn-primary" href="/fiche-technique/nouvelle">
            + Nouvelle fiche
          </Link>
        )}
      </div>

      {gestion && fiches && fiches.length > 0 && (
        <div className="grid-stats" style={{ marginBottom: 14 }}>
          <div className="card stat">
            <div className="stat-top">Fiches</div>
            <div className="stat-value">{fiches.length}</div>
            <div className="stat-foot">{categories.length} catégorie(s)</div>
          </div>
          <div className="card stat">
            <div className="stat-top">Ratio matière moyen</div>
            <div className="stat-value">{stats.moyen !== null ? `${stats.moyen.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}</div>
            <div className="stat-foot">fiches avec prix de vente</div>
          </div>
          <button className="card stat" onClick={() => setTri(tri === "ratio" ? "nom" : "ratio")}>
            <div className="stat-top">Ratio trop élevé</div>
            <div className="stat-value" style={{ color: stats.eleves ? "var(--red-ink)" : undefined }}>
              {stats.eleves}
            </div>
            <div className="stat-foot">au-dessus de 35 % · {tri === "ratio" ? "tri par ratio ✓" : "trier"}</div>
          </button>
          <div className="card stat">
            <div className="stat-top">Sans prix de vente</div>
            <div className="stat-value">{stats.sansPrix}</div>
            <div className="stat-foot">marge non calculable</div>
          </div>
        </div>
      )}

      <div className="filters">
        <label className="search" style={{ flex: "1 1 240px", background: "var(--card)" }}>
          <Icone nom="recherche" taille={15} />
          <input placeholder="Recette ou ingrédient…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
        <div className="chips">
          {["toutes", ...categories].map((c) => (
            <button key={c} className={`chip${categorie === c ? " on" : ""}`} onClick={() => setCategorie(c)}>
              {c === "toutes" ? "Toutes" : c}
            </button>
          ))}
        </div>
      </div>

      {!fiches ? (
        <div className="people-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 230, borderRadius: 14 }} />
          ))}
        </div>
      ) : !liste.length ? (
        <div className="card empty">
          <b>{fiches.length ? "Aucune fiche ne correspond" : "Aucune fiche technique"}</b>
          {!fiches.length && gestion && "Crée ta première recette : ingrédients, étapes, allergènes et coût matière."}
        </div>
      ) : (
        <div className="people-grid">
          {liste.map(({ f, c }) => (
            <Link key={f.id} href={`/fiche-technique/${f.id}`} className="card recipe-card">
              <span className="recipe-img">{f.images?.[0] ? <img src={f.images[0]} alt="" /> : <Icone nom="cuisine" taille={28} />}</span>
              <span className="recipe-body">
                <small className="eyebrow">{f.categorie ?? "Sans catégorie"}</small>
                <b>{f.nom}</b>
                <small className="hint">
                  {(f.ingredients ?? []).length} ingrédient(s) · {(f.etapes ?? []).length} étape(s)
                  {f.portions && Number(f.portions) !== 1 ? ` · ${Number(f.portions)} portions` : ""}
                </small>
                {(f.allergenes ?? []).length > 0 && (
                  <span className="recipe-allerg" title={(f.allergenes ?? []).map((a) => ALLERGENES[a]?.label).join(", ")}>
                    {(f.allergenes ?? []).map((a) => ALLERGENES[a]?.label ?? a).join(", ")}
                  </span>
                )}
                {gestion && (
                  <span className="recipe-cost">
                    <span>{euros(c.parPortion)} / portion</span>
                    {c.ratio !== null ? <span className={`pill ${tonRatio(c.ratio)}`}>{c.ratio.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %</span> : <span className="hint">prix ?</span>}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
