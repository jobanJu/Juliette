"use client";

import { useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { lirePieceJointe } from "@/lib/messagerie";
import { ALLERGENES, coutIngredient, coutsFiche, euros, TVA_RESTAURATION, tonRatio } from "@/lib/fiches";
import type { Fiche, Ingredient } from "@/lib/fiches";
import type { Produit } from "@/lib/stock";

type Props = {
  etablissementId: string;
  compteId: string;
  fiche?: Fiche;
  produits: Produit[];
  categories: string[];
  onAnnuler: () => void;
  onSaved: (id: string, message: string) => void;
};

type Ligne = Ingredient & { cle: string };

// Mots-clés → allergènes probables : une aide à la saisie, jamais une décision automatique.
const INDICES: [RegExp, string][] = [
  [/farine|pain|pâte|pate|brioche|biscuit|chapelure|panko|blé|ble|seigle|orge|semoule|boulgour|couscous|bière|biere|crêpe|crepe|gaufre/i, "gluten"],
  [/crevette|homard|crabe|langoustine|gambas|écrevisse/i, "crustaces"],
  [/œuf|oeuf|mayonnaise|mayo/i, "oeufs"],
  [/anchois|saumon|thon|cabillaud|merlu|poisson|sardine|colin|limande/i, "poissons"],
  [/arachide|cacahu/i, "arachides"],
  [/soja|tofu|edamame/i, "soja"],
  [/lait|beurre|crème|creme|fromage|parmesan|mozzarella|burrata|cheddar|maroilles|feta|chèvre|chevre|yaourt|mascarpone|cream cheese|emmental|comté|comte/i, "lait"],
  [/noix|noisette|amande|pignon|pistache|cajou|pécan|pecan|macadamia|nutella|praliné|praline/i, "fruits_coque"],
  [/céleri|celeri/i, "celeri"],
  [/moutarde/i, "moutarde"],
  [/sésame|sesame|tahin/i, "sesame"],
  [/vin|vinaigre|sulfite|cidre|porto/i, "sulfites"],
  [/lupin/i, "lupin"],
  [/moule|huître|huitre|calamar|seiche|poulpe|coquille|escargot/i, "mollusques"],
];

const cle = () => Math.random().toString(36).slice(2, 9);
const num = (s: string) => Number(String(s).replace(",", "."));

export default function EditeurFiche(p: Props) {
  const f = p.fiche;
  const [nom, setNom] = useState(f?.nom ?? "");
  const [categorie, setCategorie] = useState(f?.categorie ?? "");
  const [format, setFormat] = useState(f?.format ?? "");
  const [portions, setPortions] = useState(f?.portions != null ? String(f.portions) : "1");
  const [prix, setPrix] = useState(f?.prix_vente_ttc != null ? String(f.prix_vente_ttc).replace(".", ",") : "");
  const [tva, setTva] = useState(f?.tva_pct != null ? Number(f.tva_pct) : 10);
  const [lignes, setLignes] = useState<Ligne[]>(() => (f?.ingredients?.length ? f.ingredients : [{ name: "", qty: 0, unit: "g" }]).map((i) => ({ ...i, cle: cle() })));
  const [etapes, setEtapes] = useState<string[]>(() => (f?.etapes?.length ? f.etapes : [""]));
  const [accompagnement, setAccompagnement] = useState(f?.accompagnement ?? "");
  const [note, setNote] = useState(f?.note ?? "");
  const [allergenes, setAllergenes] = useState<Set<string>>(() => new Set(f?.allergenes ?? []));
  const [images, setImages] = useState<string[]>(f?.images ?? []);
  const [recherche, setRecherche] = useState<{ cle: string; q: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  const parId = useMemo(() => new Map(p.produits.map((x) => [x.id, x])), [p.produits]);
  const ingredients: Ingredient[] = lignes.filter((l) => l.name.trim()).map(({ cle: _c, ...i }) => ({ ...i, name: i.name.trim() })); // eslint-disable-line @typescript-eslint/no-unused-vars
  const couts = coutsFiche({ ingredients, portions: num(portions) || 1, prix_vente_ttc: prix ? num(prix) : null, tva_pct: tva }, parId);

  const suggestions = useMemo(() => {
    const texte = lignes.map((l) => l.name).join(" ");
    return [...new Set(INDICES.filter(([re]) => re.test(texte)).map(([, a]) => a))].filter((a) => !allergenes.has(a));
  }, [lignes, allergenes]);

  const maj = (k: string, c: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.cle === k ? { ...l, ...c } : l)));

  function lier(k: string, pr: Produit) {
    maj(k, { name: pr.nom, productId: pr.id, unit: pr.unite === "kg" ? "g" : pr.unite === "L" ? "cl" : pr.unite, prixManuel: undefined });
    setRecherche(null);
  }

  async function ajouterPhotos(fichiers: FileList) {
    for (const fi of Array.from(fichiers).slice(0, 3 - images.length)) {
      try {
        const pj = await lirePieceJointe(fi);
        if (pj.kind === "image") setImages((im) => [...im, pj.dataUrl]);
      } catch (e) {
        setErreur((e as Error).message);
      }
    }
  }

  async function enregistrer() {
    setErreur(null);
    if (!nom.trim()) return setErreur("Donne un nom à la fiche.");
    const nbPortions = num(portions);
    if (!Number.isFinite(nbPortions) || nbPortions <= 0) return setErreur("Nombre de portions invalide.");
    const prixVente = prix.trim() ? num(prix) : null;
    if (prixVente !== null && (!Number.isFinite(prixVente) || prixVente < 0)) return setErreur("Prix de vente invalide.");
    if (ingredients.some((i) => !Number.isFinite(Number(i.qty)) || Number(i.qty) < 0)) return setErreur("Chaque ingrédient doit avoir une quantité.");
    setEnvoi(true);
    const ligne = {
      etablissement_id: p.etablissementId,
      nom: nom.trim(),
      categorie: categorie.trim() || null,
      format: format.trim() || null,
      portions: nbPortions,
      prix_vente_ttc: prixVente,
      tva_pct: tva,
      ingredients: ingredients.map((i) => ({ ...i, qty: Number(i.qty), ...(i.rendement ? { rendement: Number(i.rendement) } : {}), ...(i.prixManuel != null && !Number.isNaN(Number(i.prixManuel)) ? { prixManuel: Number(i.prixManuel) } : {}) })),
      etapes: etapes.map((e) => e.trim()).filter(Boolean),
      accompagnement: accompagnement.trim() || null,
      note: note.trim() || null,
      allergenes: [...allergenes],
      images,
    };
    const sb = getSupabaseClient()!;
    const r = f ? await sb.from("fiches_techniques").update(ligne).eq("id", f.id).select("id").single() : await sb.from("fiches_techniques").insert({ ...ligne, created_by: p.compteId }).select("id").single();
    setEnvoi(false);
    if (r.error || !r.data) return setErreur("Enregistrement refusé : réservé aux responsables.");
    p.onSaved(r.data.id, f ? "Fiche enregistrée" : "Fiche créée");
  }

  const resultats = recherche && recherche.q.trim().length >= 2 ? p.produits.filter((x) => x.nom.toLowerCase().includes(recherche.q.trim().toLowerCase())).slice(0, 7) : [];

  return (
    <div className="editeur">
      <div className="page-head">
        <div>
          <p className="eyebrow">Fiches techniques</p>
          <h1>{f ? `Modifier « ${f.nom} »` : "Nouvelle fiche"}</h1>
        </div>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={p.onAnnuler} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </span>
      </div>
      {erreur && (
        <div className="error" role="alert" style={{ marginBottom: 14 }}>
          {erreur}
        </div>
      )}

      <div className="editeur-grid">
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <section className="card" style={{ display: "grid", gap: 12 }}>
            <div className="form-2">
              <div className="field">
                <label htmlFor="f-nom">Nom *</label>
                <input id="f-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Carbonade flamande" autoFocus={!f} />
              </div>
              <div className="field">
                <label htmlFor="f-cat">Catégorie</label>
                <input id="f-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)} list="categories-fiches" placeholder="Plat, Sauce, Dessert…" />
                <datalist id="categories-fiches">
                  {p.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="form-2">
              <div className="field">
                <label htmlFor="f-portions">La recette donne (portions)</label>
                <input id="f-portions" inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-format">Format / contenant</label>
                <input id="f-format" value={format} onChange={(e) => setFormat(e.target.value)} placeholder="Ex. : assiette creuse, biberon 20 cl" />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Ingrédients</h2>
              <span className="hint">Relie un ingrédient au stock pour que son prix suive le catalogue</span>
            </div>
            <div className="ing-list">
              <div className="ing-row ing-head">
                <span>Ingrédient</span>
                <span>Quantité</span>
                <span>Unité</span>
                <span title="Pourcentage réellement utilisé après épluchage, cuisson…">Rendement</span>
                <span>Prix (€/kg, €/L, €/u)</span>
                <span style={{ textAlign: "right" }}>Coût</span>
                <span />
              </div>
              {lignes.map((l) => {
                const lie = l.productId ? parId.get(l.productId) : undefined;
                const c = coutIngredient(l, parId);
                return (
                  <div key={l.cle} className="ing-row">
                    <span style={{ position: "relative", minWidth: 0 }}>
                      {lie ? (
                        <span className="ing-lie" title="Relié au produit du stock">
                          <b>{lie.nom}</b>
                          <button className="icon-btn" onClick={() => maj(l.cle, { productId: undefined })} aria-label="Délier du stock" title="Délier du stock">
                            ⛓
                          </button>
                        </span>
                      ) : (
                        <input
                          value={l.name}
                          onChange={(e) => {
                            maj(l.cle, { name: e.target.value });
                            setRecherche({ cle: l.cle, q: e.target.value });
                          }}
                          onBlur={() => setTimeout(() => setRecherche((r) => (r?.cle === l.cle ? null : r)), 150)}
                          placeholder="Ingrédient ou produit du stock"
                          aria-label="Ingrédient"
                        />
                      )}
                      {recherche?.cle === l.cle && resultats.length > 0 && (
                        <span className="suggest">
                          {resultats.map((pr) => (
                            <button key={pr.id} onMouseDown={(e) => e.preventDefault()} onClick={() => lier(l.cle, pr)}>
                              {pr.nom} <small className="hint">{pr.prix_unitaire != null ? `${euros(Number(pr.prix_unitaire))}/${pr.unite}` : pr.unite}</small>
                            </button>
                          ))}
                        </span>
                      )}
                    </span>
                    <input inputMode="decimal" value={l.qty ? String(l.qty).replace(".", ",") : ""} onChange={(e) => maj(l.cle, { qty: num(e.target.value) })} aria-label="Quantité" />
                    <input value={l.unit} onChange={(e) => maj(l.cle, { unit: e.target.value })} list="unites-fiche" aria-label="Unité" />
                    <span className="with-suffix">
                      <input inputMode="decimal" value={l.rendement ?? ""} placeholder="100" onChange={(e) => maj(l.cle, { rendement: e.target.value === "" ? undefined : num(e.target.value) })} aria-label="Rendement" />
                      <i>%</i>
                    </span>
                    {lie?.prix_unitaire != null ? (
                      <span className="hint" style={{ fontSize: 11.5 }}>
                        stock : {euros(Number(lie.prix_unitaire))}/{lie.unite}
                      </span>
                    ) : (
                      <input inputMode="decimal" value={l.prixManuel ?? ""} onChange={(e) => maj(l.cle, { prixManuel: e.target.value === "" ? undefined : num(e.target.value) })} placeholder="—" aria-label="Prix" />
                    )}
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }} title={c.probleme}>
                      {c.cout !== null ? euros(c.cout) : <span className="pill t-yellow">?</span>}
                    </span>
                    <button className="icon-btn" onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))} aria-label="Retirer l'ingrédient">
                      ✕
                    </button>
                  </div>
                );
              })}
              <datalist id="unites-fiche">
                {["g", "kg", "cl", "ml", "L", "pièce", "botte", "tranche", "c. à soupe"].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => setLignes((ls) => [...ls, { name: "", qty: 0, unit: "g", cle: cle() }])}>
              + Ingrédient
            </button>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Étapes</h2>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {etapes.map((e, i) => (
                <div key={i} className="etape-row">
                  <span className="etape-num">{i + 1}</span>
                  <textarea value={e} onChange={(x) => setEtapes((es) => es.map((y, k) => (k === i ? x.target.value : y)))} rows={2} placeholder="Décris l'étape" aria-label={`Étape ${i + 1}`} />
                  <span style={{ display: "grid" }}>
                    <button className="icon-btn" disabled={i === 0} onClick={() => setEtapes((es) => { const c = [...es]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} aria-label="Monter">
                      ↑
                    </button>
                    <button className="icon-btn" onClick={() => setEtapes((es) => es.filter((_, k) => k !== i))} aria-label="Retirer">
                      ✕
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => setEtapes((es) => [...es, ""])}>
              + Étape
            </button>
          </section>

          <section className="card" style={{ display: "grid", gap: 12 }}>
            <div className="form-2">
              <div className="field">
                <label htmlFor="f-acc">Accompagnement / utilisé dans</label>
                <input id="f-acc" value={accompagnement} onChange={(e) => setAccompagnement(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-note">Note / dressage</label>
                <input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          </section>
        </div>

        <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <section className="card cost-card">
            <div className="card-head">
              <h2>Coût & marge</h2>
            </div>
            <div className="form-2">
              <div className="field">
                <label htmlFor="f-prix">Prix de vente TTC</label>
                <span className="with-suffix">
                  <input id="f-prix" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="—" />
                  <i>€</i>
                </span>
              </div>
              <div className="field">
                <label htmlFor="f-tva">TVA</label>
                <select id="f-tva" value={tva} onChange={(e) => setTva(Number(e.target.value))}>
                  {TVA_RESTAURATION.map((t) => (
                    <option key={t} value={t}>
                      {t.toLocaleString("fr-FR")} %
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <dl className="cost-list">
              <dt>Coût total recette</dt>
              <dd>{euros(couts.total)}</dd>
              <dt>Coût par portion</dt>
              <dd>
                <b>{euros(couts.parPortion)}</b>
              </dd>
              {couts.prixHT !== null && (
                <>
                  <dt>Prix de vente HT</dt>
                  <dd>{euros(couts.prixHT)}</dd>
                  <dt>Marge brute / portion</dt>
                  <dd>{euros(couts.marge!)}</dd>
                  <dt>Coefficient</dt>
                  <dd>× {couts.coefficient ? couts.coefficient.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}</dd>
                  <dt>Ratio matière</dt>
                  <dd>
                    <span className={`pill ${tonRatio(couts.ratio)}`}>{couts.ratio!.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>
                  </dd>
                </>
              )}
            </dl>
            {!couts.complet && <p className="hint" style={{ color: "var(--yellow-ink)" }}>Certains ingrédients n&apos;ont pas de prix : le coût est sous-estimé.</p>}
            <p className="hint">Repère : un ratio matière autour de 25–30 % du prix HT.</p>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Allergènes</h2>
            </div>
            {suggestions.length > 0 && (
              <div className="banner" style={{ margin: "0 0 10px", padding: "8px 10px", fontSize: 12 }}>
                <span>Probables d&apos;après les ingrédients : {suggestions.map((a) => ALLERGENES[a].label).join(", ")}</span>
                <button className="btn" style={{ height: 28 }} onClick={() => setAllergenes((s) => new Set([...s, ...suggestions]))}>
                  Ajouter
                </button>
              </div>
            )}
            <div className="chips">
              {Object.entries(ALLERGENES).map(([k, a]) => (
                <button
                  key={k}
                  className={`chip${allergenes.has(k) ? " on" : ""}`}
                  onClick={() =>
                    setAllergenes((s) => {
                      const n = new Set(s);
                      if (n.has(k)) n.delete(k);
                      else n.add(k);
                      return n;
                    })
                  }
                >
                  {a.icone} {a.label}
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Photos</h2>
              <span className="hint">{images.length} / 3</span>
            </div>
            <div className="photo-grid">
              {images.map((src, i) => (
                <span key={i} className="photo">
                  <img src={src} alt="" />
                  <button onClick={() => setImages((im) => im.filter((_, k) => k !== i))} aria-label="Retirer la photo">
                    ✕
                  </button>
                </span>
              ))}
              {images.length < 3 && (
                <button className="photo photo-add" onClick={() => fichierRef.current?.click()}>
                  + Photo
                </button>
              )}
            </div>
            <input ref={fichierRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && ajouterPhotos(e.target.files)} />
          </section>
        </aside>
      </div>
    </div>
  );
}
