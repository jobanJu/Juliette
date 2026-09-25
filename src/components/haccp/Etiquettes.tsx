"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { ajouterJours, depuisIso, iso } from "@/lib/planning";
import { DLC_RAPIDES, joursRestants, numeroLot } from "@/lib/haccp";
import type { Enregistrement, Etiquette } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  etablissementNom: string;
  compteId: string;
  initiales: string;
  liste: Enregistrement<Etiquette>[];
  onSaved: (message: string) => void;
};

const CONSERVATIONS = ["0 / +3 °C", "0 / +4 °C", "−18 °C", "Ambiant"];

export default function Etiquettes(p: Props) {
  const [produit, setProduit] = useState("");
  const [quantite, setQuantite] = useState("");
  const [jours, setJours] = useState(3);
  const [conservation, setConservation] = useState(CONSERVATIONS[0]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aImprimer, setAImprimer] = useState<Enregistrement<Etiquette> | null>(null);
  const [voirTout, setVoirTout] = useState(false);

  // Impression : on affiche l'étiquette seule, puis on ouvre la boîte d'impression.
  useEffect(() => {
    if (!aImprimer) return;
    document.body.classList.add("imprime-etiquette");
    const fin = () => {
      document.body.classList.remove("imprime-etiquette");
      setAImprimer(null);
    };
    window.addEventListener("afterprint", fin, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", fin);
      document.body.classList.remove("imprime-etiquette");
    };
  }, [aImprimer]);

  async function creer(imprimer: boolean) {
    setErreur(null);
    if (!produit.trim()) return setErreur("Quel produit ?");
    setEnvoi(true);
    const auj = iso(new Date());
    const data: Etiquette = {
      produit: produit.trim(),
      lot: numeroLot(p.initiales),
      fabrique_le: new Date().toISOString(),
      dlc: ajouterJours(auj, jours),
      jours,
      ...(quantite.trim() ? { quantite: quantite.trim() } : {}),
      conservation,
    };
    const { data: cree, error } = await getSupabaseClient()!
      .from("haccp_enregistrements")
      .insert({ etablissement_id: p.etablissementId, compte_id: p.compteId, type: "tracabilite", data })
      .select("id, type, data, compte_id, auteur, created_at, updated_at")
      .single();
    setEnvoi(false);
    if (error || !cree) return setErreur("Enregistrement refusé.");
    setProduit("");
    setQuantite("");
    p.onSaved(`Étiquette créée : ${data.produit} (lot ${data.lot})`);
    if (imprimer) setAImprimer(cree as Enregistrement<Etiquette>);
  }

  const aujourdhui = iso(new Date());
  const visibles = p.liste.filter((e) => voirTout || e.data.dlc >= ajouterJours(aujourdhui, -1)).sort((a, b) => a.data.dlc.localeCompare(b.data.dlc));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card">
        <div className="card-head">
          <h2>Nouvelle étiquette</h2>
          <span className="hint">Préparations maison, produits décongelés ou déconditionnés</span>
        </div>
        <div className="form-2">
          <div className="field">
            <label htmlFor="e-produit">Produit</label>
            <input id="e-produit" value={produit} onChange={(e) => setProduit(e.target.value)} placeholder="Ex. : sauce tomate maison" />
          </div>
          <div className="field">
            <label htmlFor="e-qte">Quantité (facultatif)</label>
            <input id="e-qte" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="Ex. : 2 L, 12 portions" />
          </div>
        </div>
        <div className="form-2" style={{ marginTop: 10 }}>
          <div className="field">
            <label>À consommer dans</label>
            <div className="chips">
              {DLC_RAPIDES.map((j) => (
                <button key={j} className={`chip${jours === j ? " on" : ""}`} onClick={() => setJours(j)}>
                  J+{j}
                </button>
              ))}
              <input className="chip-input" type="number" min={0} max={365} value={DLC_RAPIDES.includes(jours) ? "" : jours} placeholder="autre" onChange={(e) => setJours(Math.max(0, Number(e.target.value) || 0))} aria-label="Nombre de jours" />
            </div>
            <span className="hint">
              DLC : <b>{depuisIso(ajouterJours(aujourdhui, jours)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</b>
            </span>
          </div>
          <div className="field">
            <label>Conservation</label>
            <div className="chips">
              {CONSERVATIONS.map((c) => (
                <button key={c} className={`chip${conservation === c ? " on" : ""}`} onClick={() => setConservation(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        {erreur && (
          <div className="error" role="alert" style={{ marginTop: 10 }}>
            {erreur}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => creer(false)} disabled={envoi}>
            Enregistrer sans imprimer
          </button>
          <button className="btn btn-primary" onClick={() => creer(true)} disabled={envoi}>
            ⎙ Enregistrer et imprimer
          </button>
        </div>
      </section>

      <section className="card" style={{ padding: "16px 6px 6px" }}>
        <div className="card-head" style={{ padding: "0 12px" }}>
          <h2>Produits étiquetés</h2>
          <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={voirTout} onChange={(e) => setVoirTout(e.target.checked)} /> Afficher les DLC passées
          </label>
        </div>
        {!visibles.length ? (
          <div className="empty">Aucun produit étiqueté en cours.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Fabriqué</th>
                  <th>DLC</th>
                  <th>Par</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => {
                  const r = joursRestants(e.data.dlc, aujourdhui);
                  return (
                    <tr key={e.id}>
                      <td>
                        <b style={{ fontWeight: 600 }}>{e.data.produit}</b>
                        {e.data.quantite && <small className="justif">{e.data.quantite}</small>}
                      </td>
                      <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>{e.data.lot}</td>
                      <td>{new Date(e.data.fabrique_le).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>
                        <span className={`pill ${r < 0 ? "t-red" : r === 0 ? "t-peach" : r === 1 ? "t-yellow" : "t-mint"}`}>
                          {r < 0 ? "Dépassée — à jeter" : r === 0 ? "Aujourd'hui" : r === 1 ? "Demain" : depuisIso(e.data.dlc).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      </td>
                      <td className="hint">{e.auteur}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn" style={{ height: 30 }} onClick={() => setAImprimer(e)}>
                          ⎙
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {aImprimer && (
        <div className="etiquette-print" aria-hidden>
          <b className="et-produit">{aImprimer.data.produit}</b>
          {aImprimer.data.quantite && <span>{aImprimer.data.quantite}</span>}
          <span>
            Fabriqué le {new Date(aImprimer.data.fabrique_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          <b className="et-dlc">DLC {depuisIso(aImprimer.data.dlc).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}</b>
          <span>
            {aImprimer.data.conservation} · Lot {aImprimer.data.lot}
          </span>
          <small>
            {p.etablissementNom} · {aImprimer.auteur}
          </small>
        </div>
      )}
    </div>
  );
}
