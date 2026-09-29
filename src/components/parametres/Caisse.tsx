"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { CAISSES, caisse, STATUTS_CAISSE } from "@/lib/caisses";

type Connexion = { logiciel: string; statut: string; identifiant: string | null; derniere_synchro: string | null; derniere_erreur: string | null; demande_at: string };

async function appeler(chemin: string, corps: Record<string, unknown>) {
  const { data } = await getSupabaseClient()!.auth.getSession();
  const r = await fetch(chemin, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify(corps) }).catch(() => null);
  const json = r ? ((await r.json().catch(() => ({}))) as { message?: string; statut?: string; importees?: number }) : {};
  return { ok: !!r?.ok, ...json };
}

// Paramètres → Caisse : le client choisit son logiciel de caisse. SumUp et Square se connectent
// avec une clé ; les autres passent par une demande traitée par l'équipe Juliette.
export default function Caisse({ onToast }: { onToast: (m: string) => void }) {
  const { etablissement, compte } = useConnecte();
  const directeur = compte.role === "directeur";
  const sb = getSupabaseClient()!;
  const [cx, setCx] = useState<Connexion | null | undefined>(undefined);
  const [choix, setChoix] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nbVentes, setNbVentes] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    sb.from("caisse_connexions")
      .select("logiciel, statut, identifiant, derniere_synchro, derniere_erreur, demande_at")
      .eq("etablissement_id", etablissement.id)
      .maybeSingle()
      .then(({ data }) => setCx((data as Connexion) ?? null));
    sb.from("ventes_caisse")
      .select("id", { count: "exact", head: true })
      .eq("etablissement_id", etablissement.id)
      .then(({ count }) => setNbVentes(count ?? 0));
  }, [sb, etablissement.id, version]);

  const c = caisse(choix);

  async function connecter() {
    if (!c) return;
    setErreur(null);
    if (c.mode === "api" && !champs.cle?.trim()) return setErreur("Colle la clé d'accès.");
    setEnvoi(true);
    const r = await appeler("/api/caisse/connecter", { etablissementId: etablissement.id, logiciel: c.cle, cle: champs.cle, identifiant: champs.identifiant });
    setEnvoi(false);
    if (!r.ok) return setErreur(r.message ?? "Connexion refusée.");
    setChoix(null);
    setChamps({});
    onToast(r.statut === "demandee" ? "Demande envoyée à l'équipe Juliette" : r.statut === "connectee" ? `${c.nom} connecté : ${r.importees ?? 0} vente(s) importée(s)` : `Connecté, mais l'import a échoué : ${r.message ?? ""}`);
    recharger();
  }

  async function synchroniser() {
    setEnvoi(true);
    const r = await appeler("/api/caisse/synchroniser", { etablissementId: etablissement.id });
    setEnvoi(false);
    onToast(r.ok ? `${r.importees ?? 0} vente(s) importée(s) ou mises à jour` : r.message ?? "Import impossible");
    recharger();
  }

  async function deconnecter() {
    if (!confirm("Déconnecter la caisse ? Les ventes déjà importées restent dans Juliette.")) return;
    setEnvoi(true);
    const r = await appeler("/api/caisse/deconnecter", { etablissementId: etablissement.id });
    setEnvoi(false);
    onToast(r.ok ? "Caisse déconnectée" : "Déconnexion refusée");
    recharger();
  }

  if (cx === undefined) return <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />;
  const actuelle = caisse(cx?.logiciel);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {cx && actuelle && (
        <section className="card caisse-etat">
          <div className="card-head">
            <h2>🖥 {actuelle.nom}</h2>
            <span className={`pill ${STATUTS_CAISSE[cx.statut]?.ton ?? "t-lav"}`}>{STATUTS_CAISSE[cx.statut]?.label ?? cx.statut}</span>
          </div>
          {actuelle.mode === "api" ? (
            <p className="hint" style={{ margin: 0 }}>
              {cx.derniere_synchro ? `Dernier import : ${new Date(cx.derniere_synchro).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Pas encore d'import."} · {nbVentes ?? "…"} vente(s) dans Juliette · import automatique chaque nuit
              {cx.identifiant ? ` · compte ${cx.identifiant}` : ""}
            </p>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              Demande envoyée le {new Date(cx.demande_at).toLocaleDateString("fr-FR")}. L&apos;équipe Juliette te recontacte pour activer la connexion avec {actuelle.nom}.
            </p>
          )}
          {cx.derniere_erreur && <div className="error">{cx.derniere_erreur}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actuelle.mode === "api" && (
              <button className="btn btn-primary" onClick={synchroniser} disabled={envoi}>
                ⟳ Importer maintenant
              </button>
            )}
            {directeur && (
              <button className="btn btn-danger-ghost" onClick={deconnecter} disabled={envoi}>
                {actuelle.mode === "api" ? "Déconnecter" : "Annuler la demande"}
              </button>
            )}
          </div>
        </section>
      )}

      {directeur && (
        <section className="card">
          <div className="card-head">
            <h2>{cx ? "Changer de logiciel de caisse" : "Connecter ma caisse"}</h2>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>
            Les ventes de ta caisse alimentent la Finance (chiffre d&apos;affaires, prévisions). Choisis ton logiciel :
          </p>
          <div className="caisse-choix">
            {CAISSES.map((k) => (
              <button key={k.cle} className={`caisse-carte${choix === k.cle ? " on" : ""}`} onClick={() => { setChoix(k.cle); setChamps({}); setErreur(null); }}>
                <b>{k.nom}</b>
                <small>{k.mode === "api" ? "⚡ Connexion immédiate" : "🤝 Sur demande"}</small>
              </button>
            ))}
          </div>

          {c && (
            <div className="caisse-etapes">
              <ol>
                {c.etapes.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ol>
              {c.mode === "api" ? (
                c.champs?.map((f) => (
                  <div key={f.cle} className="field">
                    <label htmlFor={`cx-${f.cle}`}>{f.label}</label>
                    <input id={`cx-${f.cle}`} type={f.secret ? "password" : "text"} autoComplete="off" value={champs[f.cle] ?? ""} onChange={(e) => setChamps({ ...champs, [f.cle]: e.target.value })} />
                    {f.aide && <small className="hint">{f.aide}</small>}
                  </div>
                ))
              ) : (
                <div className="field">
                  <label htmlFor="cx-note">{c.cle === "autre" ? "Nom du logiciel" : "N° client / identifiant chez l'éditeur (facultatif)"}</label>
                  <input id="cx-note" value={champs.identifiant ?? ""} onChange={(e) => setChamps({ ...champs, identifiant: e.target.value })} />
                </div>
              )}
              {c.mode === "api" && <p className="hint" style={{ margin: 0 }}>🔒 La clé est vérifiée auprès de {c.nom}, puis chiffrée. Personne ne peut la relire, pas même l&apos;équipe Juliette.</p>}
              {erreur && (
                <div className="error" role="alert">
                  {erreur}
                </div>
              )}
              <button className="btn btn-primary" onClick={connecter} disabled={envoi} style={{ justifySelf: "start" }}>
                {envoi ? "Connexion…" : c.mode === "api" ? `Connecter ${c.nom}` : "Envoyer la demande"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
