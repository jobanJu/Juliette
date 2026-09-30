"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { ajouterJours, iso } from "@/lib/planning";
import { useStock } from "@/lib/useStock";
import { euros, formatQte, MOTIFS_PERTE } from "@/lib/stock";
import type { Perte, Produit } from "@/lib/stock";
import Icone from "@/components/Icone";

const PERIODES = [7, 30, 90] as const;

export default function Pertes() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const { d, produitParId, stocks, recharger } = useStock(etablissement.id);

  const [periode, setPeriode] = useState<(typeof PERIODES)[number]>(30);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const valeur = useMemo(() => (p: Perte) => Number(p.valeur) * Number(produitParId.get(p.produit_id)?.prix_unitaire ?? 0), [produitParId]);

  const [aujourdhui] = useState(() => iso(new Date()));
  const periodeListe = useMemo(() => {
    const depuis = ajouterJours(aujourdhui, -(periode - 1));
    return (d?.pertes ?? []).filter((p) => p.date >= depuis);
  }, [d, periode, aujourdhui]);

  const stats = useMemo(() => {
    const total = periodeListe.reduce((s, p) => s + valeur(p), 0);
    const parMotif = Object.keys(MOTIFS_PERTE).map((k) => ({ k, v: periodeListe.filter((p) => p.motif === k).reduce((s, p) => s + valeur(p), 0), n: periodeListe.filter((p) => p.motif === k).length }));
    const parProduit = new Map<string, number>();
    for (const p of periodeListe) parProduit.set(p.produit_id, (parProduit.get(p.produit_id) ?? 0) + valeur(p));
    const top = [...parProduit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, parMotif, top };
  }, [periodeListe, valeur]);

  async function supprimer(p: Perte) {
    const { error } = await getSupabaseClient()!.from("pertes").delete().eq("id", p.id);
    setToast(error ? "Suppression refusée" : "Perte supprimée");
    recharger();
  }

  const maxMotif = Math.max(1, ...stats.parMotif.map((m) => m.v));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Stock & achats</p>
          <h1>Pertes</h1>
          <p>Casse, DLC, erreurs, retours : chaque perte sort du stock et se chiffre en euros.</p>
        </div>
        <div className="seg seg-inline">
          {PERIODES.map((j) => (
            <button key={j} className={periode === j ? "on" : ""} onClick={() => setPeriode(j)}>
              {j} jours
            </button>
          ))}
        </div>
      </div>

      {!d ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      ) : (
        <>
          {gestion && (
            <FormPerte
              etablissementId={etablissement.id}
              compteId={compte.id}
              produits={d.produits}
              stock={(id) => stocks.get(id)?.quantite ?? null}
              onSaved={(m) => {
                setToast(m);
                recharger();
              }}
            />
          )}

          <div className="grid-2" style={{ marginTop: 14 }}>
            <section className="card">
              <div className="card-head">
                <h2>Par motif</h2>
                <b style={{ fontSize: 18 }}>{euros(stats.total)}</b>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {stats.parMotif.map((m) => (
                  <div key={m.k} className="motif-bar">
                    <span>
                      <span className="dot" style={{ background: MOTIFS_PERTE[m.k].couleur, marginRight: 7 }} />
                      {MOTIFS_PERTE[m.k].label}
                    </span>
                    <span className="bar" style={{ height: 8 }}>
                      <i style={{ width: `${(m.v / maxMotif) * 100}%`, background: MOTIFS_PERTE[m.k].couleur }} />
                    </span>
                    <b>{m.v ? euros(m.v) : "—"}</b>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <div className="card-head">
                <h2>Produits les plus perdus</h2>
              </div>
              {!stats.top.length ? (
                <div className="empty">Aucune perte sur la période.</div>
              ) : (
                <div className="rows">
                  {stats.top.map(([id, v], i) => (
                    <div key={id} className="row">
                      <span className="chip-ic t-red">{i + 1}</span>
                      <span className="main-txt">
                        <b>{produitParId.get(id)?.nom ?? "Produit supprimé"}</b>
                        <small>{periodeListe.filter((p) => p.produit_id === id).length} déclaration(s)</small>
                      </span>
                      <span className="right">{euros(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="card" style={{ marginTop: 14, padding: "16px 6px 6px" }}>
            <div className="card-head" style={{ padding: "0 12px" }}>
              <h2>Déclarations · {periode} derniers jours</h2>
            </div>
            {!periodeListe.length ? (
              <div className="empty">Aucune perte déclarée sur la période.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Produit</th>
                      <th style={{ textAlign: "right" }}>Quantité</th>
                      <th style={{ textAlign: "right" }}>Valeur</th>
                      <th>Motif</th>
                      {gestion && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {periodeListe.map((p) => {
                      const pr = produitParId.get(p.produit_id);
                      return (
                        <tr key={p.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{new Date(p.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
                          <td>
                            <b style={{ fontWeight: 600 }}>{pr?.nom ?? "Produit supprimé"}</b>
                            {p.precision && <small className="justif">{p.precision}</small>}
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatQte(p.valeur, pr?.unite)}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{pr?.prix_unitaire ? euros(valeur(p)) : <span className="hint">prix ?</span>}</td>
                          <td>
                            <span className="pill" style={{ background: MOTIFS_PERTE[p.motif]?.couleur + "33", color: "var(--ink-2)" }}>
                              {MOTIFS_PERTE[p.motif]?.label ?? p.motif}
                            </span>
                          </td>
                          {gestion && (
                            <td style={{ textAlign: "right" }}>
                              <button className="icon-btn" onClick={() => supprimer(p)} aria-label="Supprimer" title="Supprimer (erreur de saisie)">
                                <Icone nom="supprimer" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {!gestion && <p className="hint" style={{ marginTop: 10 }}>La déclaration des pertes est réservée aux responsables : signale-leur la perte.</p>}
        </>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function FormPerte({ etablissementId, compteId, produits, stock, onSaved }: { etablissementId: string; compteId: string; produits: Produit[]; stock: (id: string) => number | null; onSaved: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [choisi, setChoisi] = useState<Produit | null>(null);
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("dlc");
  const [precision, setPrecision] = useState("");
  const [date, setDate] = useState(() => iso(new Date()));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const suggestions = q.trim() && !choisi ? produits.filter((p) => p.nom.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const v = Number(quantite.replace(",", "."));

  async function declarer() {
    setErreur(null);
    if (!choisi) return setErreur("Choisis le produit.");
    if (!Number.isFinite(v) || v <= 0) return setErreur("Indique la quantité perdue.");
    if (motif === "autre" && !precision.trim()) return setErreur("Précise le motif.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!
      .from("pertes")
      .insert({ etablissement_id: etablissementId, produit_id: choisi.id, date, valeur: v, motif, precision: precision.trim() || null, created_by: compteId });
    setEnvoi(false);
    if (error) return setErreur("Déclaration refusée : réservée aux responsables.");
    onSaved(`Perte déclarée : ${formatQte(v, choisi.unite)} de ${choisi.nom}`);
    setChoisi(null);
    setQ("");
    setQuantite("");
    setPrecision("");
  }

  const st = choisi ? stock(choisi.id) : null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Déclarer une perte</h2>
      </div>
      <div className="perte-form">
        <div className="field" style={{ position: "relative" }}>
          <label htmlFor="pe-produit">Produit</label>
          {choisi ? (
            <div className="chosen">
              <b>{choisi.nom}</b>
              <small className="hint">{st != null ? `stock ${formatQte(st, choisi.unite)}` : choisi.unite}</small>
              <button className="icon-btn" onClick={() => setChoisi(null)} aria-label="Changer de produit">
                ✕
              </button>
            </div>
          ) : (
            <input id="pe-produit" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" autoComplete="off" />
          )}
          {suggestions.length > 0 && (
            <div className="suggest">
              {suggestions.map((p) => (
                <button key={p.id} onClick={() => setChoisi(p)}>
                  {p.nom} <small className="hint">{p.unite}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="pe-qte">Quantité{choisi ? ` (${choisi.unite})` : ""}</label>
          <input id="pe-qte" inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pe-date">Date</label>
          <input id="pe-date" type="date" value={date} max={iso(new Date())} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Motif</label>
        <div className="chips">
          {Object.entries(MOTIFS_PERTE).map(([k, m]) => (
            <button key={k} className={`chip${motif === k ? " on" : ""}`} onClick={() => setMotif(k)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "1 1 260px" }}>
          <label htmlFor="pe-prec">{motif === "autre" ? "Précision *" : "Précision (facultatif)"}</label>
          <input id="pe-prec" value={precision} onChange={(e) => setPrecision(e.target.value)} placeholder="Ex. : bac tombé en service" maxLength={200} />
        </div>
        <span className="hint" style={{ paddingBottom: 12 }}>
          {choisi?.prix_unitaire && Number.isFinite(v) && v > 0 ? `≈ ${euros(v * Number(choisi.prix_unitaire))}` : ""}
        </span>
        <button className="btn btn-primary" style={{ height: 44 }} onClick={declarer} disabled={envoi}>
          {envoi ? "Enregistrement…" : "Déclarer"}
        </button>
      </div>
      {erreur && (
        <div className="error" role="alert" style={{ marginTop: 10 }}>
          {erreur}
        </div>
      )}
    </section>
  );
}
