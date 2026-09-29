"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { iso } from "@/lib/planning";
import { formatTemp, nouvelId } from "@/lib/haccp";
import type { CategorieCuisson, Cuisson as Releve, Enregistrement } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  compteId: string;
  categories: CategorieCuisson[];
  liste: Enregistrement<Releve>[];
  suggestions: string[];
  parametres: boolean;
  onConfigurer: () => void;
  onSaved: (message: string) => void;
};

// Points de cuisson : température à cœur relevée à la sonde, comparée au minimum de la catégorie.
export default function Cuisson(p: Props) {
  const [categorie, setCategorie] = useState(p.categories[0]?.id ?? "");
  const [produit, setProduit] = useState("");
  const [valeur, setValeur] = useState("");
  const [action, setAction] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const cat = p.categories.find((c) => c.id === categorie);
  const v = valeur.trim() === "" ? null : Number(valeur.replace(",", "."));
  const conforme = cat && v != null && Number.isFinite(v) ? v >= cat.seuil : null;
  const aujourdhui = iso(new Date());
  const duJour = useMemo(() => p.liste.filter((e) => iso(new Date(e.created_at)) === aujourdhui).slice().reverse(), [p.liste, aujourdhui]);

  async function enregistrer() {
    setErreur(null);
    if (!cat) return setErreur("Choisis une catégorie.");
    if (!produit.trim()) return setErreur("Quel produit as-tu sondé ?");
    if (v == null || !Number.isFinite(v)) return setErreur("Indique la température à cœur.");
    if (!conforme && !action.trim()) return setErreur("Température trop basse : note l'action (ex. cuisson prolongée puis nouveau relevé).");
    const data: Releve = { produit: produit.trim(), categorie: cat.nom, seuil: cat.seuil, valeur: v, conforme: !!conforme, ...(action.trim() ? { action: action.trim() } : {}) };
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_enregistrements").insert({ etablissement_id: p.etablissementId, compte_id: p.compteId, type: "cuisson", data });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé.");
    setProduit("");
    setValeur("");
    setAction("");
    p.onSaved(`${data.produit} : ${formatTemp(v)} à cœur${conforme ? "" : " (hors norme)"}`);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card cuisson-saisie">
        <div className="card-head">
          <h2>🌡 Relevé de cuisson à cœur</h2>
          {p.parametres && (
            <button className="btn" onClick={p.onConfigurer}>
              ⚙ Seuils
            </button>
          )}
        </div>
        <div className="cuisson-cats" role="radiogroup" aria-label="Catégorie">
          {p.categories.map((c) => (
            <button key={c.id} role="radio" aria-checked={categorie === c.id} className={categorie === c.id ? "on" : ""} onClick={() => setCategorie(c.id)}>
              <b>{c.nom}</b>
              <small>≥ {formatTemp(c.seuil)}</small>
            </button>
          ))}
        </div>
        <div className="form-2">
          <div className="field">
            <label htmlFor="cu-produit">Produit</label>
            <input id="cu-produit" value={produit} onChange={(e) => setProduit(e.target.value)} list="cu-produits" placeholder="ex. Suprême de volaille" />
            <datalist id="cu-produits">
              {p.suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="cu-temp">Température à cœur (°C)</label>
            <input id="cu-temp" inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder={cat ? String(cat.seuil) : ""} className={conforme === false ? "invalide" : ""} />
          </div>
        </div>
        {conforme !== null && (
          <span className={`pill ${conforme ? "t-mint" : "t-red"}`} style={{ justifySelf: "start" }}>
            {conforme ? "Conforme" : `Insuffisant : minimum ${formatTemp(cat!.seuil)}`}
          </span>
        )}
        {conforme === false && (
          <div className="field">
            <label htmlFor="cu-action">Action corrective (obligatoire)</label>
            <input id="cu-action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Cuisson prolongée, nouveau relevé…" />
          </div>
        )}
        {erreur && (
          <div className="error" role="alert">
            {erreur}
          </div>
        )}
        <button className="btn btn-primary btn-lg" onClick={enregistrer} disabled={envoi}>
          {envoi ? "Enregistrement…" : "Valider le relevé"}
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Aujourd&apos;hui</h2>
          <span className="pill t-lav">{duJour.length} relevé(s)</span>
        </div>
        {!duJour.length ? (
          <div className="empty">Aucun relevé de cuisson aujourd&apos;hui.</div>
        ) : (
          <div className="rows">
            {duJour.map((e) => (
              <div key={e.id} className="row">
                <span className={`pill ${e.data.conforme ? "t-mint" : "t-red"}`} style={{ minWidth: 64, justifyContent: "center" }}>
                  {formatTemp(e.data.valeur)}
                </span>
                <span className="main-txt">
                  <b>{e.data.produit}</b>
                  <small>
                    {e.data.categorie} · min. {formatTemp(e.data.seuil)} · {e.auteur.split(" ")[0]} {new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    {e.data.action ? ` · ${e.data.action}` : ""}
                  </small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ModalCuisson({ etablissementId, categories, onClose, onSaved }: { etablissementId: string; categories: CategorieCuisson[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [liste, setListe] = useState(categories);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (id: string, c: Partial<CategorieCuisson>) => setListe((l) => l.map((x) => (x.id === id ? { ...x, ...c } : x)));

  async function enregistrer() {
    const propres = liste.filter((c) => c.nom.trim()).map((c) => ({ ...c, nom: c.nom.trim(), seuil: Number(c.seuil) || 63 }));
    if (!propres.length) return setErreur("Garde au moins une catégorie.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("haccp_config").upsert({ etablissement_id: etablissementId, cle: "cuisson", data: propres }, { onConflict: "etablissement_id,cle" });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : il faut l'accréditation « paramètres HACCP ».");
    onSaved("Seuils de cuisson enregistrés");
  }

  return (
    <Modal
      titre="Seuils de cuisson à cœur"
      sousTitre="À aligner sur ton plan de maîtrise sanitaire"
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="plan-list">
        {liste.map((c) => (
          <div key={c.id} className="plan-row" style={{ gridTemplateColumns: "1fr 110px 32px" }}>
            <input value={c.nom} onChange={(e) => maj(c.id, { nom: e.target.value })} aria-label="Catégorie" />
            <input inputMode="decimal" value={c.seuil} onChange={(e) => maj(c.id, { seuil: Number(e.target.value.replace(",", ".")) || 0 })} aria-label="Température minimale" />
            <button className="icon-btn" onClick={() => setListe((l) => l.filter((x) => x.id !== c.id))} aria-label="Retirer">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="btn" style={{ justifySelf: "start" }} onClick={() => setListe((l) => [...l, { id: nouvelId(), nom: "", seuil: 63 }])}>
        + Ajouter une catégorie
      </button>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
