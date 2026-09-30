"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { coutsFiche, tonRatio } from "@/lib/fiches";
import type { Fiche } from "@/lib/fiches";
import { ETAT_CARTE, euros, ficheDe, ingredientsPortion, trierCategories } from "@/lib/salle";
import type { ArticleCarte, TableSalle } from "@/lib/salle";
import type { Produit } from "@/lib/stock";
import Icone from "@/components/Icone";

type Props = {
  etablissementId: string;
  carte: ArticleCarte[];
  tables: TableSalle[];
  fiches: Fiche[];
  produits: Map<string, Produit>;
  onChange: (m?: string) => void;
};

export default function Carte(p: Props) {
  const sb = getSupabaseClient()!;
  const [article, setArticle] = useState<ArticleCarte | "nouveau" | null>(null);
  const [table, setTable] = useState<TableSalle | "nouvelle" | null>(null);
  const [synchro, setSynchro] = useState(false);

  const categories = useMemo(() => [...new Set(p.carte.map((a) => a.categorie))].sort(trierCategories), [p.carte]);

  async function etat(a: ArticleCarte, e: ArticleCarte["etat_stock"]) {
    const { error } = await sb.from("menu_salle").update({ etat_stock: e }).eq("id", a.id);
    p.onChange(error ? "Modification refusée" : `${a.nom} : ${ETAT_CARTE[e].label.toLowerCase()}`);
  }

  // Reporte sur la carte les ingrédients et le coût des fiches techniques : c'est ce que la base
  // décompte du stock à l'envoi, même quand le serveur n'a pas accès au catalogue.
  async function synchroniser() {
    setSynchro(true);
    let n = 0;
    for (const a of p.carte) {
      const fiche = ficheDe(a, p.fiches);
      if (!fiche) continue;
      const ingredients = ingredientsPortion(a, p.fiches, p.produits);
      const c = coutsFiche({ ...fiche, prix_vente_ttc: a.prix_centimes / 100 }, p.produits);
      const cout = Math.round(c.parPortion * 100);
      const ratio = c.ratio !== null ? Math.round(c.ratio * 100) / 100 : null;
      if (JSON.stringify(ingredients) === JSON.stringify(a.ingredients) && cout === a.cout_matiere_centimes) continue;
      const { error } = await sb.from("menu_salle").update({ ingredients, cout_matiere_centimes: cout, ratio_matiere: ratio }).eq("id", a.id);
      if (!error) n++;
    }
    setSynchro(false);
    p.onChange(n ? `${n} article(s) mis à jour depuis les fiches techniques` : "La carte est déjà à jour");
  }

  const sansFiche = p.carte.filter((a) => a.categorie !== "Boisson" && !ficheDe(a, p.fiches)).length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: "16px 6px 6px" }}>
        <div className="card-head" style={{ padding: "0 12px", flexWrap: "wrap" }}>
          <h2>La carte · {p.carte.length} article(s)</h2>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={synchroniser} disabled={synchro} title="Ingrédients décomptés du stock et coût matière, repris des fiches techniques">
              {synchro ? "Mise à jour…" : "↻ Synchroniser avec les fiches"}
            </button>
            <button className="btn btn-primary" onClick={() => setArticle("nouveau")}>
              + Article
            </button>
          </span>
        </div>
        {sansFiche > 0 && <p className="hint" style={{ padding: "0 12px" }}>{sansFiche} plat(s) sans fiche technique : leurs ingrédients ne sont pas décomptés du stock à la vente.</p>}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Article</th>
                <th style={{ textAlign: "right" }}>Prix</th>
                <th>Fiche technique</th>
                <th>Disponibilité</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => [
                <tr key={cat}>
                  <td colSpan={4} className="nav-label" style={{ paddingTop: 14 }}>
                    {cat}
                  </td>
                </tr>,
                ...p.carte
                  .filter((a) => a.categorie === cat)
                  .map((a) => {
                    const f = ficheDe(a, p.fiches);
                    const c = f ? coutsFiche({ ...f, prix_vente_ttc: a.prix_centimes / 100 }, p.produits) : null;
                    return (
                      <tr key={a.id} className="clickable" onClick={() => setArticle(a)}>
                        <td>
                          <b style={{ fontWeight: 600 }}>{a.nom}</b>
                          {a.composition && <small className="justif">{a.composition}</small>}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{euros(a.prix_centimes)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {f ? (
                            <Link href={`/fiche-technique/${f.id}`} className="hint" style={{ whiteSpace: "nowrap" }}>
                              <Icone nom="cuisine" /> liée{c?.ratio != null && p.produits.size > 0 ? <span className={`pill ${tonRatio(c.ratio)}`} style={{ marginLeft: 6 }}>{c.ratio.toFixed(0)} %</span> : null}
                            </Link>
                          ) : (
                            <span className="hint">—</span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select className="select-sm" value={a.etat_stock} onChange={(e) => etat(a, e.target.value as ArticleCarte["etat_stock"])} aria-label={`Disponibilité ${a.nom}`}>
                            {Object.entries(ETAT_CARTE).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  }),
              ])}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Tables · {p.tables.filter((t) => t.active).length} active(s) · {p.tables.filter((t) => t.active).reduce((s, t) => s + t.couverts_max, 0)} places</h2>
          <button className="btn btn-primary" onClick={() => setTable("nouvelle")}>
            + Table
          </button>
        </div>
        <div className="chips">
          {p.tables.map((t) => (
            <button key={t.id} className={`chip${t.active ? "" : " chip-off"}`} onClick={() => setTable(t)}>
              {t.nom} · {t.couverts_max} pl.{t.active ? "" : " (inactive)"}
            </button>
          ))}
        </div>
      </section>

      {article && <ModalArticle etablissementId={p.etablissementId} article={article === "nouveau" ? undefined : article} categories={categories} ordre={p.carte.length} onClose={() => setArticle(null)} onSaved={(m) => { setArticle(null); p.onChange(m); }} />}
      {table && <ModalTableConfig etablissementId={p.etablissementId} table={table === "nouvelle" ? undefined : table} ordre={p.tables.length} onClose={() => setTable(null)} onSaved={(m) => { setTable(null); p.onChange(m); }} />}
    </div>
  );
}

function ModalArticle({ etablissementId, article, categories, ordre, onClose, onSaved }: { etablissementId: string; article?: ArticleCarte; categories: string[]; ordre: number; onClose: () => void; onSaved: (m: string) => void }) {
  const [nom, setNom] = useState(article?.nom ?? "");
  const [categorie, setCategorie] = useState(article?.categorie ?? "Plat");
  const [prix, setPrix] = useState(article ? String(article.prix_centimes / 100).replace(".", ",") : "");
  const [composition, setComposition] = useState(article?.composition ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const sb = getSupabaseClient()!;

  async function enregistrer() {
    const p = Number(prix.replace(",", "."));
    if (!nom.trim()) return setErreur("Le nom est obligatoire.");
    if (!Number.isFinite(p) || p < 0) return setErreur("Prix invalide.");
    setEnvoi(true);
    const ligne = { etablissement_id: etablissementId, nom: nom.trim(), categorie: categorie.trim() || "Carte", prix_centimes: Math.round(p * 100), composition: composition.trim() || null };
    const { error } = article ? await sb.from("menu_salle").update(ligne).eq("id", article.id) : await sb.from("menu_salle").insert({ ...ligne, ordre });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onSaved(article ? "Article modifié" : "Article ajouté à la carte");
  }

  async function supprimer() {
    const { error } = await sb.from("menu_salle").delete().eq("id", article!.id);
    if (error) return setErreur("Suppression refusée.");
    onSaved("Article retiré de la carte");
  }

  return (
    <Modal
      titre={article ? article.nom : "Nouvel article"}
      sousTitre="Le nom doit être celui de la fiche technique pour décompter le stock"
      onClose={onClose}
      pied={
        <>
          {article && (
            <span style={{ marginRight: "auto" }}>
              {!suppr ? (
                <button className="btn btn-danger-ghost" onClick={() => setSuppr(true)}>
                  Retirer
                </button>
              ) : (
                <button className="btn btn-danger" onClick={supprimer}>
                  Confirmer
                </button>
              )}
            </span>
          )}
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="a-nom">Nom</label>
        <input id="a-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus={!article} />
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="a-cat">Catégorie</label>
          <input id="a-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)} list="cats-carte" />
          <datalist id="cats-carte">
            {[...new Set(["Entrée", "Plat", "Dessert", "Boisson", ...categories])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="a-prix">Prix TTC (€)</label>
          <input id="a-prix" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="a-comp">Description (facultatif)</label>
        <input id="a-comp" value={composition} onChange={(e) => setComposition(e.target.value)} />
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}

function ModalTableConfig({ etablissementId, table, ordre, onClose, onSaved }: { etablissementId: string; table?: TableSalle; ordre: number; onClose: () => void; onSaved: (m: string) => void }) {
  const [nom, setNom] = useState(table?.nom ?? "");
  const [places, setPlaces] = useState(String(table?.couverts_max ?? 4));
  const [active, setActive] = useState(table?.active ?? true);
  const [erreur, setErreur] = useState<string | null>(null);
  const sb = getSupabaseClient()!;

  async function enregistrer() {
    const n = Number(places);
    if (!nom.trim()) return setErreur("Donne un nom ou un numéro à la table.");
    if (!Number.isInteger(n) || n < 1 || n > 40) return setErreur("Entre 1 et 40 places.");
    const ligne = { etablissement_id: etablissementId, nom: nom.trim(), couverts_max: n, active };
    const { error } = table ? await sb.from("tables_salle").update(ligne).eq("id", table.id) : await sb.from("tables_salle").insert({ ...ligne, ordre });
    if (error) return setErreur(error.code === "23505" ? "Une table porte déjà ce nom." : "Enregistrement refusé.");
    onSaved(table ? "Table modifiée" : `Table ${ligne.nom} ajoutée`);
  }

  return (
    <Modal
      titre={table ? `Table ${table.nom}` : "Nouvelle table"}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="form-2">
        <div className="field">
          <label htmlFor="t-nom">Nom / numéro</label>
          <input id="t-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="12, Terrasse 3…" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="t-places">Places</label>
          <input id="t-places" inputMode="numeric" value={places} onChange={(e) => setPlaces(e.target.value)} />
        </div>
      </div>
      {table && (
        <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Table en service (décoche pour la masquer du plan de salle)
        </label>
      )}
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
