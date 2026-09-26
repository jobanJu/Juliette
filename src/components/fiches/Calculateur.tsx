"use client";

import { useEffect, useMemo, useState } from "react";
import { analyserRestes, coutIngredient, coutsFiche, euros, manquesPour, qte, tonRatio, uniteNormale } from "@/lib/fiches";
import type { Produit } from "@/lib/stock";
import type { Fiche } from "@/lib/fiches";

type Props = {
  fiche: Fiche;
  /** Stock disponible des ingrédients reliés au catalogue (responsables uniquement). */
  stock?: Map<string, { quantite: number | null; unite: string }>;
  /** Catalogue avec les tarifs fournisseurs : active le coût matière en direct (responsables). */
  produits?: Map<string, Produit>;
  /** Facteur à appliquer aux quantités de la recette (1 = la recette telle quelle). */
  onFacteur: (facteur: number) => void;
};

type Dispo = { valeur: string; unite: string };

/** Unités proposées pour saisir ce qu'on a, dans la même famille que l'unité de la recette. */
function unitesPossibles(u: string) {
  const f = uniteNormale(u);
  if (f.famille === "masse") return ["g", "kg"];
  if (f.famille === "volume") return ["ml", "cl", "L"];
  return [u];
}

/** L'unité de la recette elle-même, écrite comme dans la liste (« gr » → g, « l » → L…). */
function uniteParDefaut(u: string) {
  const f = uniteNormale(u);
  if (f.famille === "masse") return f.facteur >= 1 ? "kg" : "g";
  if (f.famille === "volume") return f.facteur >= 1 ? "L" : f.facteur >= 0.01 ? "cl" : "ml";
  return u;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

export default function Calculateur({ fiche, stock, produits, onFacteur }: Props) {
  const base = Number(fiche.portions) > 0 ? Number(fiche.portions) : 1;
  const ingredients = useMemo(() => (fiche.ingredients ?? []).map((ing, k) => ({ ing, k })).filter(({ ing }) => Number(ing.qty) > 0), [fiche.ingredients]);

  const [mode, setMode] = useState<"portions" | "restes">("portions");
  const [portions, setPortions] = useState("");
  const [dispo, setDispo] = useState<Record<number, Dispo>>({});
  const [ajuste, setAjuste] = useState("");
  const [entieres, setEntieres] = useState(true);

  // Pour chaque ingrédient renseigné : combien de recettes complètes il permet.
  const analyse = useMemo(() => {
    const saisis: Record<number, { valeur: number; unite: string } | undefined> = {};
    for (const [k, d] of Object.entries(dispo)) if (d.valeur.trim() !== "") saisis[Number(k)] = { valeur: Number(d.valeur.replace(",", ".")), unite: d.unite };
    const a = analyserRestes(fiche.ingredients ?? [], saisis, base, entieres);
    // Les ingrédients sans quantité ne comptent pas dans le calcul.
    return { ...a, lignes: a.lignes.filter((l) => Number(l.ing.qty) > 0) };
  }, [fiche.ingredients, dispo, entieres, base]);

  const portionsAjustees = ajuste.trim() !== "" ? Number(ajuste.replace(",", ".")) : null;
  const facteur =
    mode === "portions"
      ? portions.trim() && Number(portions.replace(",", ".")) > 0
        ? Number(portions.replace(",", ".")) / base
        : 1
      : portionsAjustees !== null && portionsAjustees > 0
        ? portionsAjustees / base
        : analyse.maxRecettes !== null && analyse.maxRecettes > 0
          ? analyse.maxRecettes
          : 1;

  useEffect(() => onFacteur(facteur), [facteur, onFacteur]);

  function remplirStock() {
    if (!stock) return;
    const n: Record<number, Dispo> = { ...dispo };
    for (const { ing, k } of ingredients) {
      const s = ing.productId ? stock.get(ing.productId) : undefined;
      if (s?.quantite != null && s.quantite > 0) n[k] = { valeur: String(arrondi(s.quantite)).replace(".", ","), unite: s.unite };
    }
    setDispo(n);
  }

  const couts = produits ? coutsFiche(fiche, produits) : null;
  const portionsFaites = base * facteur;
  const coutProduction = couts ? couts.total * facteur : null;

  const peutRemplir = !!stock && ingredients.some(({ ing }) => ing.productId && (stock.get(ing.productId)?.quantite ?? 0) > 0);
  const manques = manquesPour(analyse.lignes, facteur);

  return (
    <section className="card calc print-hide">
      <div className="card-head">
        <h2>Calculateur</h2>
        <div className="seg seg-2" style={{ width: 290 }}>
          <button className={mode === "portions" ? "on" : ""} onClick={() => setMode("portions")}>
            Par portions
          </button>
          <button className={mode === "restes" ? "on" : ""} onClick={() => setMode("restes")}>
            Avec ce qu&apos;il me reste
          </button>
        </div>
      </div>

      {mode === "portions" ? (
        <label className="scale">
          Je veux faire
          <input inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} placeholder={qte(base)} aria-label="Nombre de portions voulu" />
          portion(s) — la recette de base en donne {qte(base)}.
        </label>
      ) : (
        <>
          <p className="hint" style={{ margin: "0 0 10px" }}>
            Indique ce que tu as. Laisse vide ce que tu as en quantité suffisante.
            {peutRemplir && (
              <>
                {" "}
                <button className="link-btn" onClick={remplirStock}>
                  Remplir avec le stock
                </button>
              </>
            )}
          </p>
          <div className="calc-list">
            {analyse.lignes.map(({ ing, k, recettes }) => {
              const d = dispo[k] ?? { valeur: "", unite: uniteParDefaut(ing.unit) };
              const limitant = analyse.limitant?.k === k;
              return (
                <div key={k} className={`calc-row${limitant ? " limitant" : ""}`}>
                  <span className="main-txt" style={{ minWidth: 0 }}>
                    <b>{ing.name}</b>
                    <small className="hint">
                      recette : {qte(Number(ing.qty))} {ing.unit}
                      {recettes !== null ? ` · de quoi faire ${qte(arrondi(recettes * base))} portion(s)` : ""}
                    </small>
                  </span>
                  <span className="calc-input">
                    <input inputMode="decimal" value={d.valeur} onChange={(e) => setDispo((x) => ({ ...x, [k]: { ...d, valeur: e.target.value } }))} placeholder="j'ai…" aria-label={`Quantité disponible de ${ing.name}`} />
                    {unitesPossibles(ing.unit).length > 1 ? (
                      <select value={d.unite} onChange={(e) => setDispo((x) => ({ ...x, [k]: { ...d, unite: e.target.value } }))} aria-label="Unité">
                        {unitesPossibles(ing.unit).map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <i>{ing.unit}</i>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {!analyse.renseignes.length ? (
            <p className="hint" style={{ marginTop: 10 }}>Renseigne au moins un ingrédient pour lancer le calcul.</p>
          ) : (
            <div className="calc-result">
              <div>
                <span className="hint">Tu peux faire au maximum</span>
                <b>
                  {qte(arrondi((analyse.maxRecettes ?? 0) * base))} portion{(analyse.maxRecettes ?? 0) * base > 1 ? "s" : ""}
                </b>
                <small className="hint">
                  soit {qte(arrondi(analyse.maxRecettes ?? 0))} fois la recette · limité par <b>{analyse.limitant?.ing.name}</b>
                </small>
              </div>
              <div className="calc-adjust">
                <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={entieres} onChange={(e) => setEntieres(e.target.checked)} /> Portions entières
                </label>
                <label className="scale">
                  Ajuster à
                  <input inputMode="decimal" value={ajuste} onChange={(e) => setAjuste(e.target.value)} placeholder={qte(arrondi((analyse.maxRecettes ?? 0) * base))} aria-label="Portions à préparer" />
                  portion(s)
                </label>
                {ajuste && (
                  <button className="link-btn" onClick={() => setAjuste("")}>
                    Revenir au maximum
                  </button>
                )}
              </div>
            </div>
          )}

          {manques.length > 0 && (
            <div className="banner" style={{ margin: "10px 0 0", background: "var(--yellow)", borderColor: "#eedda6" }}>
              <span>
                <b>Il te manque :</b>{" "}
                {manques.map((m) => `${qte(arrondi(m.manque))} ${m.ing.unit} de ${m.ing.name}`).join(", ")}
              </span>
            </div>
          )}
          {analyse.renseignes.length > 0 && !manques.length && (
            <p className="hint" style={{ marginTop: 10 }}>
              Il te restera :{" "}
              {analyse.renseignes
                .map((l) => ({ l, reste: l.dispoRecette! - Number(l.ing.qty) * facteur }))
                .filter(({ reste }) => reste > 0.0001)
                .map(({ l, reste }) => `${qte(arrondi(reste))} ${l.ing.unit} de ${l.ing.name}`)
                .join(", ") || "rien, tout est utilisé"}
              .
            </p>
          )}
        </>
      )}

      {couts && produits && (
        <div className="calc-cost">
          <div className="calc-cost-head">
            <span>
              <span className="hint">Coût matière de cette production</span>
              <b>{euros(coutProduction!)}</b>
              <small className="hint">
                {qte(Math.round(portionsFaites * 100) / 100)} portion(s) · {euros(couts.parPortion)} / portion
              </small>
            </span>
            {couts.prixHT !== null && (
              <span style={{ textAlign: "right" }}>
                <span className="hint">Chiffre d&apos;affaires HT attendu</span>
                <b>{euros(couts.prixHT * portionsFaites)}</b>
                <small>
                  <span className={`pill ${tonRatio(couts.ratio)}`}>ratio {couts.ratio!.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span> · marge {euros(couts.marge! * portionsFaites)}
                </small>
              </span>
            )}
          </div>
          <table className="data calc-cost-table">
            <tbody>
              {(fiche.ingredients ?? []).map((ing, k) => {
                const c = coutIngredient(ing, produits);
                const p = ing.productId ? produits.get(ing.productId) : undefined;
                return (
                  <tr key={k}>
                    <td>{ing.name}</td>
                    <td className="hint" style={{ whiteSpace: "nowrap" }}>
                      {qte(Math.round(Number(ing.qty) * facteur * 100) / 100)} {ing.unit}
                    </td>
                    <td className="hint">
                      {c.source === "stock" && p?.prix_unitaire != null ? (
                        <span title="Prix du catalogue : il suit le tarif du fournisseur">
                          <span className="pill t-mint">tarif {p.fournisseur ?? "fournisseur"}</span> {euros(Number(p.prix_unitaire))}/{p.unite}
                        </span>
                      ) : c.source === "manuel" ? (
                        <span className="pill t-lav" title="Prix saisi dans la fiche : relie l'ingrédient au stock pour suivre le tarif fournisseur">prix saisi</span>
                      ) : (
                        <span className="pill t-yellow" title={c.probleme}>
                          {c.probleme}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{c.cout !== null ? euros(c.cout * facteur) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!couts.complet && <p className="hint" style={{ color: "var(--yellow-ink)", margin: "6px 0 0" }}>Des prix manquent : le coût réel est plus élevé.</p>}
        </div>
      )}
    </section>
  );
}
