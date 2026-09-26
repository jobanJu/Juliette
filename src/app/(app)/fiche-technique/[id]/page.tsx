"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { ALLERGENES, COLONNES_FICHE, coutIngredient, coutsFiche, euros, qte, tonRatio } from "@/lib/fiches";
import type { Fiche } from "@/lib/fiches";
import type { Produit } from "@/lib/stock";
import EditeurFiche from "@/components/fiches/EditeurFiche";
import Calculateur from "@/components/fiches/Calculateur";
import { useStock } from "@/lib/useStock";

export default function PageFiche() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const nouvelle = id === "nouvelle";

  const [fiche, setFiche] = useState<Fiche | null | undefined>(nouvelle ? null : undefined);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [edition, setEdition] = useState(nouvelle);
  const [version, setVersion] = useState(0);
  const [facteur, setFacteur] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [supprimer, setSupprimer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const sb = getSupabaseClient()!;
    Promise.all([
      nouvelle ? null : sb.from("fiches_techniques").select(COLONNES_FICHE).eq("id", id).eq("etablissement_id", etablissement.id).maybeSingle(),
      gestion ? sb.from("produits").select("id, nom, unite, prix_unitaire, fournisseur").eq("etablissement_id", etablissement.id).order("nom") : null,
      sb.from("fiches_techniques").select("categorie").eq("etablissement_id", etablissement.id),
    ]).then(([f, p, c]) => {
      if (!vivant) return;
      if (f) setFiche((f.data as Fiche | null) ?? null);
      setProduits((p?.data ?? []) as Produit[]);
      setCategories([...new Set(((c.data ?? []) as { categorie: string | null }[]).map((x) => x.categorie?.trim()).filter(Boolean) as string[])].sort());
    });
    return () => {
      vivant = false;
    };
  }, [id, nouvelle, etablissement.id, gestion, version]);

  // Tarifs toujours à jour : on relit le catalogue quand on revient sur l'onglet.
  useEffect(() => {
    const retour = () => document.visibilityState === "visible" && !edition && setVersion((v) => v + 1);
    document.addEventListener("visibilitychange", retour);
    return () => document.removeEventListener("visibilitychange", retour);
  }, [edition]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const parId = useMemo(() => new Map(produits.map((x) => [x.id, x])), [produits]);
  const { d: stockD, stocks } = useStock(etablissement.id);
  const stockIngredients = useMemo(() => {
    if (!gestion || !stockD) return undefined;
    const m = new Map<string, { quantite: number | null; unite: string }>();
    for (const p of stockD.produits) m.set(p.id, { quantite: stocks.get(p.id)?.quantite ?? null, unite: p.unite });
    return m;
  }, [gestion, stockD, stocks]);

  if (edition && gestion) {
    return (
      <EditeurFiche
        etablissementId={etablissement.id}
        compteId={compte.id}
        fiche={fiche ?? undefined}
        produits={produits}
        categories={categories}
        onAnnuler={() => (nouvelle ? router.push("/fiche-technique") : setEdition(false))}
        onSaved={(nid, m) => {
          setToast(m);
          setEdition(false);
          if (nouvelle) router.replace(`/fiche-technique/${nid}`);
          else setVersion((v) => v + 1);
        }}
      />
    );
  }

  if (fiche === undefined) return <div className="skeleton" style={{ height: 360, borderRadius: 14 }} />;
  if (fiche === null) {
    return (
      <div className="card soon-card">
        <h1>Fiche introuvable</h1>
        <p>Cette fiche n&apos;existe pas ou a été supprimée.</p>
        <p style={{ marginTop: 18 }}>
          <Link className="btn" href="/fiche-technique">
            Retour aux fiches
          </Link>
        </p>
      </div>
    );
  }

  const base = Number(fiche.portions) > 0 ? Number(fiche.portions) : 1;
  const couts = coutsFiche(fiche, parId);

  async function dupliquer() {
    const { id: _i, created_at: _c, updated_at: _u, ...copie } = fiche!; // eslint-disable-line @typescript-eslint/no-unused-vars
    const { data, error } = await getSupabaseClient()!
      .from("fiches_techniques")
      .insert({ ...copie, nom: `${fiche!.nom} (copie)`, etablissement_id: etablissement.id, created_by: compte.id })
      .select("id")
      .single();
    if (error || !data) return setToast("Duplication refusée");
    router.push(`/fiche-technique/${data.id}`);
  }

  async function effacer() {
    const { error } = await getSupabaseClient()!.from("fiches_techniques").delete().eq("id", fiche!.id);
    if (error) return setToast("Suppression refusée");
    router.replace("/fiche-technique");
  }

  return (
    <div className="fiche-view">
      <Link href="/fiche-technique" className="back-link print-hide">
        ← Fiches techniques
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">{fiche.categorie ?? "Fiche technique"}</p>
          <h1>{fiche.nom}</h1>
          <p>
            {[fiche.format, `recette pour ${qte(base)} portion${base > 1 ? "s" : ""}`, fiche.accompagnement && `avec ${fiche.accompagnement}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="toolbar print-hide">
          <button className="btn" onClick={() => window.print()}>
            ⎙ Imprimer
          </button>
          {gestion && (
            <>
              <button className="btn" onClick={dupliquer}>
                ⧉ Dupliquer
              </button>
              <button className="btn btn-primary" onClick={() => setEdition(true)}>
                ✎ Modifier
              </button>
            </>
          )}
        </span>
      </div>

      <div className="fiche-grid">
        <div style={{ display: "grid", gap: 14, alignContent: "start", minWidth: 0 }}>
          <Calculateur fiche={fiche} stock={stockIngredients} produits={gestion ? parId : undefined} onFacteur={setFacteur} />
          <section className="card">
            <div className="card-head">
              <h2>Ingrédients</h2>
              {facteur !== 1 && (
                <span className="pill t-lav">
                  × {facteur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} · {qte(Math.round(base * facteur * 100) / 100)} portion(s)
                </span>
              )}
            </div>
            {!(fiche.ingredients ?? []).length ? (
              <div className="empty">Aucun ingrédient.</div>
            ) : (
              <table className="data">
                <tbody>
                  {fiche.ingredients.map((i, k) => {
                    const c = gestion ? coutIngredient(i, parId) : null;
                    return (
                      <tr key={k}>
                        <td style={{ width: 110, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          <b>{qte(Number(i.qty) * facteur)}</b> {i.unit}
                        </td>
                        <td>
                          {i.name}
                          {i.rendement && i.rendement !== 100 ? <small className="hint"> · rendement {i.rendement} %</small> : null}
                        </td>
                        {gestion && <td style={{ textAlign: "right", whiteSpace: "nowrap" }} className="hint">{c?.cout != null ? euros(c.cout * facteur) : "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Préparation</h2>
            </div>
            {!(fiche.etapes ?? []).length ? (
              <div className="empty">Aucune étape.</div>
            ) : (
              <ol className="etapes">
                {fiche.etapes.map((e, k) => (
                  <li key={k}>{e}</li>
                ))}
              </ol>
            )}
            {fiche.note && <p className="request-note" style={{ marginTop: 12 }}>{fiche.note}</p>}
          </section>
        </div>

        <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
          {(fiche.images ?? []).length > 0 && (
            <section className="card" style={{ padding: 10 }}>
              <img className="fiche-photo" src={fiche.images[photo] ?? fiche.images[0]} alt={fiche.nom} />
              {fiche.images.length > 1 && (
                <div className="photo-thumbs print-hide">
                  {fiche.images.map((src, k) => (
                    <button key={k} className={k === photo ? "on" : ""} onClick={() => setPhoto(k)}>
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2>Allergènes</h2>
            </div>
            {!(fiche.allergenes ?? []).length ? (
              <p className="hint">Aucun allergène déclaré. Vérifie les ingrédients avant de l&apos;afficher en salle.</p>
            ) : (
              <div className="chips">
                {fiche.allergenes.map((a) => (
                  <span key={a} className="chip on" style={{ cursor: "default" }}>
                    {ALLERGENES[a]?.icone} {ALLERGENES[a]?.label ?? a}
                  </span>
                ))}
              </div>
            )}
          </section>

          {gestion && (
            <section className="card print-hide">
              <div className="card-head">
                <h2>Coût & marge</h2>
              </div>
              <dl className="cost-list">
                <dt>Coût par portion</dt>
                <dd>
                  <b>{euros(couts.parPortion)}</b>
                </dd>
                <dt>Prix de vente</dt>
                <dd>{fiche.prix_vente_ttc ? `${euros(Number(fiche.prix_vente_ttc))} TTC` : "—"}</dd>
                {couts.prixHT !== null && (
                  <>
                    <dt>Marge brute</dt>
                    <dd>{euros(couts.marge!)}</dd>
                    <dt>Coefficient</dt>
                    <dd>× {couts.coefficient?.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) ?? "—"}</dd>
                    <dt>Ratio matière</dt>
                    <dd>
                      <span className={`pill ${tonRatio(couts.ratio)}`}>{couts.ratio!.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>
                    </dd>
                  </>
                )}
              </dl>
              {!couts.complet && <p className="hint" style={{ color: "var(--yellow-ink)" }}>Des prix manquent : coût sous-estimé.</p>}
              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                {!supprimer ? (
                  <button className="btn btn-danger-ghost" onClick={() => setSupprimer(true)}>
                    Supprimer la fiche
                  </button>
                ) : (
                  <span style={{ display: "flex", gap: 8 }}>
                    <button className="btn" onClick={() => setSupprimer(false)}>
                      Garder
                    </button>
                    <button className="btn btn-danger" onClick={effacer}>
                      Confirmer
                    </button>
                  </span>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
