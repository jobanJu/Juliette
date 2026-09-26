"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { COLONNES_BON, euros, ingredientsPortion, totalBon } from "@/lib/salle";
import CartePicker, { ajouterLigne } from "@/components/salle/CartePicker";
import type { ArticleCarte, Bon, LigneBon, TableSalle } from "@/lib/salle";
import type { Fiche } from "@/lib/fiches";
import type { Produit } from "@/lib/stock";

type Props = {
  etablissementId: string;
  compteId: string;
  compteNom: string;
  /** null = comptoir / à emporter */
  table: TableSalle | null;
  bons: Bon[];
  carte: ArticleCarte[];
  fiches: Fiche[];
  produits: Map<string, Produit>;
  onClose: () => void;
  onChange: (message?: string) => void;
};

const depuis = (iso: string, maintenant: number) => {
  const m = Math.floor((maintenant - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

export default function ModalTable(p: Props) {
  const sb = getSupabaseClient()!;
  const nomTable = p.table ? `Table ${p.table.nom}` : "Comptoir / à emporter";
  const brouillonExistant = p.bons.find((b) => b.statut === "en_cours");
  const envoyes = p.bons.filter((b) => b.statut === "envoyee").sort((a, b) => a.created_at.localeCompare(b.created_at));

  const [lignes, setLignes] = useState<LigneBon[]>(brouillonExistant?.lignes ?? []);
  const [couverts, setCouverts] = useState(String(brouillonExistant?.couverts ?? envoyes[0]?.couverts ?? Math.min(2, p.table?.couverts_max ?? 2)));
  const [note, setNote] = useState(brouillonExistant?.note ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [encaisser, setEncaisser] = useState(false);
  const [annuler, setAnnuler] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [p]);


  const changer = (i: number, d: number) => setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, quantite: l.quantite + d } : l)).filter((l) => l.quantite > 0));

  /** Complète chaque ligne avec les ingrédients à décompter (fiche technique ou carte). */
  function avecIngredients(ls: LigneBon[]): LigneBon[] {
    return ls.map((l) => {
      const a = p.carte.find((x) => x.id === l.produitId);
      if (!a) return l;
      const ingredients = ingredientsPortion(a, p.fiches, p.produits);
      return ingredients.length ? { ...l, ingredients } : l;
    });
  }

  async function envoyer() {
    setErreur(null);
    const c = Number(couverts);
    if (!lignes.length) return setErreur("Ajoute au moins un article.");
    if (!Number.isInteger(c) || c < 1 || c > 40) return setErreur("Nombre de couverts entre 1 et 40.");
    setEnvoi(true);
    const contenu = { couverts: c, lignes: avecIngredients(lignes), note: note.trim() || null, updated_at: new Date().toISOString() };
    let id = brouillonExistant?.id;
    if (id) {
      const { error } = await sb.from("commandes_salle").update(contenu).eq("id", id);
      if (error) return fin("Enregistrement refusé.");
    } else {
      const { data, error } = await sb
        .from("commandes_salle")
        .insert({ ...contenu, etablissement_id: p.etablissementId, table_id: p.table?.id ?? null, table_nom: p.table?.nom ?? "Comptoir", statut: "en_cours", cree_par: p.compteId, cree_par_nom: p.compteNom })
        .select(COLONNES_BON)
        .single();
      if (error || !data) return fin("Enregistrement refusé.");
      id = data.id;
    }
    // Le passage à « envoyee » déclenche, côté base, le décompte des ingrédients dans le stock.
    const { error } = await sb.from("commandes_salle").update({ statut: "envoyee", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return fin("Envoi refusé.");
    setLignes([]);
    setNote("");
    setEnvoi(false);
    p.onChange(`Bon envoyé en cuisine · ${nomTable}`);
  }

  function fin(msg: string) {
    setEnvoi(false);
    setErreur(msg);
  }

  async function garderBrouillon() {
    if (!lignes.length) return p.onClose();
    setEnvoi(true);
    const contenu = { couverts: Number(couverts) || 1, lignes, note: note.trim() || null, updated_at: new Date().toISOString() };
    const { error } = brouillonExistant
      ? await sb.from("commandes_salle").update(contenu).eq("id", brouillonExistant.id)
      : await sb.from("commandes_salle").insert({ ...contenu, etablissement_id: p.etablissementId, table_id: p.table?.id ?? null, table_nom: p.table?.nom ?? "Comptoir", statut: "en_cours", cree_par: p.compteId, cree_par_nom: p.compteNom });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé.");
    p.onChange("Commande gardée en brouillon");
  }

  async function annulerBon(id: string) {
    setEnvoi(true);
    const { error } = await sb.from("commandes_salle").update({ statut: "annulee", updated_at: new Date().toISOString() }).eq("id", id);
    setEnvoi(false);
    setAnnuler(null);
    if (error) return setErreur("Annulation refusée.");
    if (id === brouillonExistant?.id) setLignes([]);
    p.onChange("Bon annulé : le stock est recrédité");
  }

  async function encaisserTable() {
    setEnvoi(true);
    const ids = envoyes.map((b) => b.id);
    const e1 = ids.length ? (await sb.from("commandes_salle").update({ statut: "terminee", updated_at: new Date().toISOString() }).in("id", ids)).error : null;
    const e2 = brouillonExistant ? (await sb.from("commandes_salle").update({ statut: "annulee", updated_at: new Date().toISOString() }).eq("id", brouillonExistant.id)).error : null;
    setEnvoi(false);
    if (e1 || e2) return setErreur("Encaissement refusé.");
    p.onChange(`${nomTable} encaissée et libérée`);
  }

  const totalEnvoye = envoyes.reduce((s, b) => s + totalBon(b), 0);
  const totalBrouillon = totalBon({ lignes });

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className="modal pos" role="dialog" aria-modal="true" aria-label={nomTable}>
        <div className="modal-head">
          <div>
            <h2>{nomTable}</h2>
            <p>
              {envoyes.length ? `${envoyes.length} bon(s) en cours · ouverte depuis ${depuis(envoyes[0].created_at, maintenant)}` : "Nouvelle commande"}
              {p.table ? ` · ${p.table.couverts_max} places` : ""}
            </p>
          </div>
          <button className="icon-btn" onClick={p.onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="pos-body">
          <CartePicker carte={p.carte} onAjouter={(a) => setLignes((ls) => ajouterLigne(ls, a))} />

          <section className="pos-ticket">
            {envoyes.map((b, i) => (
              <div key={b.id} className="ticket-bon">
                <div className="ticket-head">
                  <b>
                    Bon {i + 1} · {new Date(b.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </b>
                  <span className={`pill ${b.servi_at ? "t-mint" : "t-peach"}`}>{b.servi_at ? "Servi" : "En cuisine"}</span>
                </div>
                {b.lignes.map((l, k) => (
                  <div key={k} className="ticket-line muted-line">
                    <span>
                      {l.quantite} × {l.nom}
                    </span>
                    <span>{euros(l.quantite * l.prixCentimes)}</span>
                  </div>
                ))}
                {b.note && <small className="hint">« {b.note} »</small>}
                {annuler === b.id ? (
                  <span style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button className="btn" style={{ height: 28 }} onClick={() => setAnnuler(null)}>
                      Garder
                    </button>
                    <button className="btn btn-danger" style={{ height: 28 }} onClick={() => annulerBon(b.id)} disabled={envoi}>
                      Annuler ce bon
                    </button>
                  </span>
                ) : (
                  <button className="link-btn" style={{ color: "var(--red-ink)" }} onClick={() => setAnnuler(b.id)}>
                    Annuler ce bon
                  </button>
                )}
              </div>
            ))}

            <div className="ticket-bon ticket-draft">
              <div className="ticket-head">
                <b>{envoyes.length ? "Suite de la commande" : "Commande"}</b>
                <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Couverts
                  <input className="chip-input" style={{ width: 56 }} inputMode="numeric" value={couverts} onChange={(e) => setCouverts(e.target.value)} aria-label="Couverts" />
                </label>
              </div>
              {!lignes.length ? (
                <p className="hint" style={{ margin: "6px 0" }}>Touche un article de la carte pour l&apos;ajouter.</p>
              ) : (
                lignes.map((l, i) => (
                  <div key={i} className="ticket-line">
                    <span className="qty-ctrl">
                      <button onClick={() => changer(i, -1)} aria-label="Retirer un">
                        −
                      </button>
                      <b>{l.quantite}</b>
                      <button onClick={() => changer(i, 1)} aria-label="Ajouter un">
                        +
                      </button>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>{l.nom}</span>
                    <span>{euros(l.quantite * l.prixCentimes)}</span>
                  </div>
                ))
              )}
              <input className="ticket-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note pour la cuisine (cuissons, allergies…)" maxLength={200} />
            </div>

            {erreur && (
              <div className="error" role="alert">
                {erreur}
              </div>
            )}

            <div className="ticket-total">
              <span>Total table</span>
              <b>{euros(totalEnvoye + totalBrouillon)}</b>
            </div>

            <div className="ticket-actions">
              <button className="btn btn-primary" onClick={envoyer} disabled={envoi || !lignes.length} style={{ height: 46 }}>
                {envoi ? "…" : `Envoyer en cuisine${lignes.length ? ` · ${euros(totalBrouillon)}` : ""}`}
              </button>
              {lignes.length > 0 && (
                <button className="btn" onClick={garderBrouillon} disabled={envoi}>
                  Garder en brouillon
                </button>
              )}
              {envoyes.length > 0 &&
                (!encaisser ? (
                  <button className="btn" onClick={() => setEncaisser(true)} disabled={envoi || lignes.length > 0} title={lignes.length ? "Envoie ou vide la suite en cours d'abord" : undefined}>
                    Encaisser et libérer la table
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={encaisserTable} disabled={envoi}>
                    Confirmer l&apos;encaissement de {euros(totalEnvoye)}
                  </button>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
