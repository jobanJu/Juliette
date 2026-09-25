"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { formatDuree } from "@/lib/planning";
import { formatTemp, REFROID_DUREE_MAX_MIN, REFROID_TEMP_FIN, refroidissementConforme } from "@/lib/haccp";
import type { Enregistrement, Refroidissement } from "@/lib/haccp";

type Props = {
  etablissementId: string;
  compteId: string;
  liste: Enregistrement<Refroidissement>[];
  enCoursSeulement?: boolean;
  onSaved: (message: string) => void;
};

export default function Refroidissements(p: Props) {
  const [produit, setProduit] = useState("");
  const [temp, setTemp] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  const enCours = p.liste.filter((r) => !r.data.fin_at);
  const termines = p.liste.filter((r) => r.data.fin_at);

  async function demarrer() {
    setErreur(null);
    const t = Number(temp.replace(",", "."));
    if (!produit.trim()) return setErreur("Quel produit refroidis-tu ?");
    if (!Number.isFinite(t)) return setErreur("Indique la température à cœur au départ.");
    setEnvoi(true);
    const data: Refroidissement = { produit: produit.trim(), debut_at: new Date().toISOString(), temp_debut: t };
    const { error } = await getSupabaseClient()!.from("haccp_enregistrements").insert({ etablissement_id: p.etablissementId, compte_id: p.compteId, type: "refroidissement", data });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé.");
    setProduit("");
    setTemp("");
    p.onSaved(`Refroidissement lancé : ${data.produit}`);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card">
        <div className="card-head">
          <h2>Refroidissements en cours</h2>
          <span className="hint">
            Règle : de +63 °C à {formatTemp(REFROID_TEMP_FIN)} à cœur en moins de {formatDuree(REFROID_DUREE_MAX_MIN)}
          </span>
        </div>
        {!enCours.length ? (
          <p className="hint" style={{ margin: "0 0 12px" }}>
            Aucun refroidissement en cours.
          </p>
        ) : (
          <div className="rows" style={{ marginBottom: 12 }}>
            {enCours.map((r) => (
              <EnCours key={r.id} r={r} maintenant={maintenant} onSaved={p.onSaved} />
            ))}
          </div>
        )}
        <div className="refroid-form">
          <input value={produit} onChange={(e) => setProduit(e.target.value)} placeholder="Produit (ex. : sauce bolognaise, 5 L)" aria-label="Produit" />
          <span className="temp-input" style={{ maxWidth: 150 }}>
            <input inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="65" aria-label="Température de départ" />
            <span>°C</span>
          </span>
          <button className="btn btn-primary" onClick={demarrer} disabled={envoi}>
            ▶ Lancer le chrono
          </button>
        </div>
        {erreur && (
          <div className="error" role="alert" style={{ marginTop: 10 }}>
            {erreur}
          </div>
        )}
      </section>

      {!p.enCoursSeulement && (
        <section className="card" style={{ padding: "16px 6px 6px" }}>
          <div className="card-head" style={{ padding: "0 12px" }}>
            <h2>Historique</h2>
          </div>
          {!termines.length ? (
            <div className="empty">Aucun refroidissement terminé sur la période.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Durée</th>
                    <th>Résultat</th>
                    <th>Par</th>
                  </tr>
                </thead>
                <tbody>
                  {termines.map((r) => {
                    const ok = refroidissementConforme(r.data);
                    const d = (new Date(r.data.fin_at!).getTime() - new Date(r.data.debut_at).getTime()) / 60000;
                    return (
                      <tr key={r.id}>
                        <td>
                          <b style={{ fontWeight: 600 }}>{r.data.produit}</b>
                          {r.data.action && <small className="justif">Action : {r.data.action}</small>}
                        </td>
                        <td>
                          {new Date(r.data.debut_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {formatTemp(r.data.temp_debut)}
                        </td>
                        <td>
                          {new Date(r.data.fin_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {formatTemp(r.data.temp_fin!)}
                        </td>
                        <td>{formatDuree(d)}</td>
                        <td>
                          <span className={`pill ${ok ? "t-mint" : "t-red"}`}>{ok ? "Conforme" : "Non conforme"}</span>
                        </td>
                        <td className="hint">{r.auteur}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EnCours({ r, maintenant, onSaved }: { r: Enregistrement<Refroidissement>; maintenant: number; onSaved: (m: string) => void }) {
  const [temp, setTemp] = useState("");
  const [action, setAction] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const ecoule = (maintenant - new Date(r.data.debut_at).getTime()) / 60000;
  const reste = REFROID_DUREE_MAX_MIN - ecoule;
  const t = Number(temp.replace(",", "."));
  const echec = temp.trim() !== "" && Number.isFinite(t) && refroidissementConforme({ ...r.data, fin_at: new Date(maintenant).toISOString(), temp_fin: t }) === false;

  async function terminer() {
    setErreur(null);
    if (!Number.isFinite(t) || temp.trim() === "") return setErreur("Température à cœur ?");
    if (echec && !action.trim()) return setErreur("Non conforme : indique l'action (produit jeté, recuit…).");
    setEnvoi(true);
    const fin = new Date().toISOString();
    const data: Refroidissement = { ...r.data, fin_at: fin, temp_fin: t, conforme: refroidissementConforme({ ...r.data, fin_at: fin, temp_fin: t }) ?? false, ...(action.trim() ? { action: action.trim() } : {}) };
    const { error } = await getSupabaseClient()!.from("haccp_enregistrements").update({ data }).eq("id", r.id);
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé.");
    onSaved(`${r.data.produit} : refroidissement ${data.conforme ? "conforme" : "non conforme"}`);
  }

  return (
    <div className="refroid-row">
      <span className="main-txt">
        <b>{r.data.produit}</b>
        <small>
          lancé à {new Date(r.data.debut_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à {formatTemp(r.data.temp_debut)} · {r.auteur}
        </small>
      </span>
      <span className={`pill ${reste < 0 ? "t-red" : reste < 30 ? "t-peach" : "t-lav"}`}>{reste < 0 ? `Dépassé de ${formatDuree(-reste)}` : `Reste ${formatDuree(reste)}`}</span>
      <span className="temp-input" style={{ maxWidth: 190 }}>
        <input inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="Temp. à cœur" aria-label="Température finale" />
        <span>°C</span>
        <button className="btn btn-primary" onClick={terminer} disabled={envoi}>
          Terminer
        </button>
      </span>
      {echec && <input className="temp-action-input" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action corrective" style={{ flexBasis: "100%" }} />}
      {erreur && <small className="temp-err" style={{ flexBasis: "100%" }}>{erreur}</small>}
    </div>
  );
}
