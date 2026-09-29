"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { MODULES, SECTIONS } from "@/lib/modules";
import { MODULES_ESSENTIELS, ROLE_LABEL } from "@/lib/session";
import type { Role } from "@/lib/session";
import { CAISSES, caisse } from "@/lib/caisses";

// Console de l'équipe Juliette : hors menu, accessible aux seuls membres de equipe_juliette
// (vérifié côté serveur à chaque appel). Pour tout autre compte, elle se présente comme une page
// introuvable.

type Ligne = {
  id: string;
  nom: string;
  code: string;
  ville: string | null;
  pays: "FR" | "BE";
  created_at: string;
  modules_masques: string[];
  comptes_actifs: number;
  invites: number;
  directeur: string | null;
  directeur_email: string | null;
  derniere_activite: string | null;
  formule: string;
  fin_essai: string | null;
  suspendu: boolean;
  caisse_logiciel: string | null;
  caisse_statut: string;
};

type Detail = {
  etablissement: { id: string; nom: string; code: string; ville: string | null; pays: "FR" | "BE"; adresse: string | null; telephone: string | null; email_contact: string | null; siret: string | null; created_at: string; modules_masques: string[] };
  reglages: { formule: string; fin_essai: string | null; suspendu: boolean; motif_suspension: string | null; caisse_note: string | null; notes: string | null } | null;
  caisse: { logiciel: string; statut: string; identifiant: string | null; derniere_synchro: string | null; derniere_erreur: string | null; demande_at: string } | null;
  comptes: { id: string; prenom: string | null; nom: string | null; email: string | null; role: Role; statut: string; created_at: string }[];
  usage: { outils: number; emails: number; contrats: number; ventes: number };
};

const FORMULES: Record<string, string> = { essai: "Essai", essentiel: "Essentiel", pro: "Pro", premium: "Premium", offert: "Offert" };
const CAISSE: Record<string, { label: string; ton: string }> = {
  aucune: { label: "Aucune", ton: "t-lav" },
  demandee: { label: "Demandée", ton: "t-yellow" },
  en_cours: { label: "En cours", ton: "t-blue" },
  connectee: { label: "Connectée", ton: "t-mint" },
  erreur: { label: "Erreur", ton: "t-red" },
};


async function appel<T>(chemin: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const { data } = await getSupabaseClient()!.auth.getSession();
  const r = await fetch(chemin, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" } }).catch(() => null);
  if (!r) return { ok: false, status: 0, data: null };
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => null)) as T | null };
}

const depuis = (at: string | null) => {
  if (!at) return "jamais";
  const j = Math.floor((Date.now() - new Date(at).getTime()) / 864e5);
  return j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : `il y a ${j} j`;
};

export default function Console() {
  const [acces, setAcces] = useState<"verif" | "oui" | "non">("verif");
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [pays, setPays] = useState<"tous" | "FR" | "BE">("tous");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(0);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    appel<{ etablissements: Ligne[] }>("/api/console/etablissements").then((r) => {
      if (!r.ok) return setAcces("non");
      setAcces("oui");
      setMaintenant(Date.now());
      setLignes(r.data?.etablissements ?? []);
    });
  }, [version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (lignes ?? []).filter((l) => (pays === "tous" || l.pays === pays) && (!q || `${l.nom} ${l.code} ${l.ville ?? ""} ${l.directeur ?? ""} ${l.directeur_email ?? ""}`.toLowerCase().includes(q)));
  }, [lignes, recherche, pays]);

  const stats = useMemo(() => {
    const l = lignes ?? [];
    const mois = new Date();
    mois.setDate(1);
    return {
      total: l.length,
      actifs7j: l.filter((x) => x.derniere_activite && maintenant - new Date(x.derniere_activite).getTime() < 7 * 864e5).length,
      comptes: l.reduce((t, x) => t + Number(x.comptes_actifs), 0),
      nouveaux: l.filter((x) => new Date(x.created_at) >= mois).length,
      be: l.filter((x) => x.pays === "BE").length,
      caisses: l.filter((x) => x.caisse_statut === "connectee").length,
    };
  }, [lignes, maintenant]);

  if (acces === "verif") return <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />;
  if (acces === "non")
    return (
      <div className="card soon-card">
        <h1>Page introuvable</h1>
        <p>Ce module n&apos;existe pas.</p>
        <p style={{ marginTop: 18 }}>
          <Link className="btn" href="/dashboard">
            Retour au tableau de bord
          </Link>
        </p>
      </div>
    );

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Équipe Juliette · console interne</p>
          <h1>Clients</h1>
          <p>Suivi des établissements, paramétrage de leur interface, formule, connexion caisse et notes internes. Rien de ce qui est noté ici n&apos;est visible par le client.</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={recharger}>
            ⟳ Actualiser
          </button>
        </div>
      </div>

      <div className="grid-stats" style={{ marginBottom: 14 }}>
        {[
          ["Établissements", stats.total, `${stats.nouveaux} ce mois-ci`],
          ["Actifs (7 jours)", stats.actifs7j, `sur ${stats.total}`],
          ["Comptes actifs", stats.comptes, "tous établissements"],
          ["Belgique", stats.be, `${stats.caisses} caisse(s) connectée(s)`],
        ].map(([t, v, s]) => (
          <div key={String(t)} className="card stat">
            <div className="stat-top">{t}</div>
            <div className="stat-value">{v}</div>
            <div className="stat-foot">{s}</div>
          </div>
        ))}
      </div>

      <div className="mail-barre">
        <div className="seg seg-inline" role="tablist">
          {(["tous", "FR", "BE"] as const).map((p) => (
            <button key={p} role="tab" aria-selected={pays === p} className={pays === p ? "on" : ""} onClick={() => setPays(p)}>
              {p === "tous" ? "Tous" : p === "FR" ? "🇫🇷 France" : "🇧🇪 Belgique"}
            </button>
          ))}
        </div>
        <label className="search" style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <span aria-hidden>⌕</span>
          <input placeholder="Nom, code, ville, directeur…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
      </div>

      <section className="card" style={{ padding: "12px 6px 6px" }}>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Établissement</th>
                <th>Directeur</th>
                <th>Équipe</th>
                <th>Formule</th>
                <th>Caisse</th>
                <th>Activité</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.id}>
                  <td>
                    <b style={{ fontWeight: 650 }}>{l.nom}</b> {l.suspendu && <span className="pill t-red">suspendu</span>}
                    <small className="justif">
                      {l.pays === "BE" ? "🇧🇪" : "🇫🇷"} {l.code} · {l.ville ?? "—"} · depuis le {new Date(l.created_at).toLocaleDateString("fr-FR")}
                    </small>
                  </td>
                  <td>
                    {l.directeur || "—"}
                    <small className="justif">{l.directeur_email ?? ""}</small>
                  </td>
                  <td>
                    {l.comptes_actifs} actif(s){Number(l.invites) ? ` · ${l.invites} invité(s)` : ""}
                  </td>
                  <td>
                    {FORMULES[l.formule] ?? l.formule}
                    {l.fin_essai && <small className="justif">fin d&apos;essai {new Date(l.fin_essai + "T12:00").toLocaleDateString("fr-FR")}</small>}
                  </td>
                  <td>
                    <span className={`pill ${CAISSE[l.caisse_statut]?.ton ?? "t-lav"}`}>{l.caisse_logiciel ? `${caisse(l.caisse_logiciel)?.nom ?? l.caisse_logiciel} · ` : ""}{CAISSE[l.caisse_statut]?.label ?? l.caisse_statut}</span>
                  </td>
                  <td>{depuis(l.derniere_activite)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn" style={{ height: 32 }} onClick={() => setChoisi(l.id)}>
                      Gérer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibles.length && <div className="empty">Aucun établissement.</div>}
      </section>

      {choisi && (
        <Fiche
          id={choisi}
          onClose={() => setChoisi(null)}
          onSaved={(m) => {
            setToast(m);
            recharger();
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function Fiche({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (m: string) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [masques, setMasques] = useState<Set<string>>(new Set());
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    appel<Detail>(`/api/console/etablissements/${id}`).then((r) => {
      if (!r.ok || !r.data) return setErreur("Lecture impossible.");
      setD(r.data);
      const g = r.data.reglages;
      setF({
        pays: r.data.etablissement.pays,
        formule: g?.formule ?? "essai",
        fin_essai: g?.fin_essai ?? "",
        suspendu: g?.suspendu ?? false,
        motif_suspension: g?.motif_suspension ?? "",
        caisse_logiciel: r.data.caisse?.logiciel ?? "",
        caisse_statut: r.data.caisse?.statut ?? "aucune",
        caisse_note: g?.caisse_note ?? "",
        notes: g?.notes ?? "",
      });
      setMasques(new Set(r.data.etablissement.modules_masques ?? []));
    });
  }, [id]);

  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    const r = await appel(`/api/console/etablissements/${id}`, { method: "PATCH", body: JSON.stringify({ ...f, modules_masques: [...masques] }) });
    setEnvoi(false);
    if (!r.ok) return setErreur("Enregistrement refusé.");
    onSaved(`${d?.etablissement.nom} mis à jour`);
    onClose();
  }

  const champ = (k: string, label: string, type = "text") => (
    <div className="field">
      <label htmlFor={`cs-${k}`}>{label}</label>
      <input id={`cs-${k}`} type={type} value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal console-fiche" role="dialog" aria-modal="true" aria-label="Fiche établissement">
        <div className="modal-head">
          <div>
            <h2>{d?.etablissement.nom ?? "…"}</h2>
            {d && (
              <p>
                {d.etablissement.code} · {d.etablissement.ville ?? "—"} · {d.etablissement.siret ?? "SIRET non renseigné"}
              </p>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {!d ? (
            erreur ? <div className="error">{erreur}</div> : <div className="skeleton" style={{ height: 240, borderRadius: 12 }} />
          ) : (
            <>
              <div className="console-usage">
                <span>
                  <b>{d.comptes.filter((c) => c.statut === "actif").length}</b> comptes actifs
                </span>
                <span>
                  <b>{d.usage.contrats}</b> contrats
                </span>
                <span>
                  <b>{d.usage.outils}</b> outils externes
                </span>
                <span>
                  <b>{d.usage.emails}</b> e-mails reçus
                </span>
              </div>

              <h3 className="console-h">Formule et statut</h3>
              <div className="form-2">
                <div className="field">
                  <label htmlFor="cs-formule">Formule</label>
                  <select id="cs-formule" value={String(f.formule)} onChange={(e) => set("formule", e.target.value)}>
                    {Object.entries(FORMULES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {champ("fin_essai", "Fin de l'essai", "date")}
              </div>
              <div className="form-2">
                <div className="field">
                  <label htmlFor="cs-pays">Pays</label>
                  <select id="cs-pays" value={String(f.pays)} onChange={(e) => set("pays", e.target.value)}>
                    <option value="FR">🇫🇷 France</option>
                    <option value="BE">🇧🇪 Belgique</option>
                  </select>
                </div>
                <label className="coupure-toggle" style={{ alignSelf: "end" }}>
                  <input type="checkbox" checked={!!f.suspendu} onChange={(e) => set("suspendu", e.target.checked)} />
                  <span>
                    <b>Suspendre l&apos;accès</b>
                    <small>L&apos;équipe du client voit « accès suspendu »</small>
                  </span>
                </label>
              </div>
              {!!f.suspendu && champ("motif_suspension", "Motif (interne)")}

              <h3 className="console-h">Connexion caisse</h3>
              <div className="form-2">
                <div className="field">
                  <label htmlFor="cs-caisse">Logiciel de caisse</label>
                  <select id="cs-caisse" value={String(f.caisse_logiciel)} onChange={(e) => set("caisse_logiciel", e.target.value)}>
                    <option value="">—</option>
                    {CAISSES.map((c) => (
                      <option key={c.cle} value={c.cle}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="cs-caisse-statut">État</label>
                  <select id="cs-caisse-statut" value={String(f.caisse_statut)} onChange={(e) => set("caisse_statut", e.target.value)}>
                    {Object.entries(CAISSE).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {d.caisse && (
                <p className="hint" style={{ margin: 0 }}>
                  Demandée le {new Date(d.caisse.demande_at).toLocaleDateString("fr-FR")}
                  {d.caisse.identifiant ? ` · identifiant ${d.caisse.identifiant}` : ""}
                  {d.caisse.derniere_synchro ? ` · dernier import ${new Date(d.caisse.derniere_synchro).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : ""} · {d.usage.ventes} vente(s) importée(s)
                  {d.caisse.derniere_erreur ? ` · erreur : ${d.caisse.derniere_erreur}` : ""}
                </p>
              )}
              {champ("caisse_note", "Note technique (identifiant marchand, contact éditeur…)")}

              <h3 className="console-h">Modules visibles pour le client</h3>
              <div className="modules-choix">
                {MODULES.filter((m) => !MODULES_ESSENTIELS.includes(m.module)).map((m) => {
                  const actif = !masques.has(m.module);
                  return (
                    <label key={m.module} className={`module-choix${actif ? " on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={actif}
                        onChange={() =>
                          setMasques((s) => {
                            const n = new Set(s);
                            if (actif) n.add(m.module);
                            else n.delete(m.module);
                            return n;
                          })
                        }
                      />
                      <span className="main-txt">
                        <b>{m.label}</b>
                        <small>{m.section ? SECTIONS[m.section].label : m.groupe}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <h3 className="console-h">Équipe du client</h3>
              <div className="rows">
                {d.comptes.map((c) => (
                  <div key={c.id} className="row">
                    <span className="main-txt">
                      <b>{[c.prenom, c.nom].filter(Boolean).join(" ") || c.email}</b>
                      <small>
                        {ROLE_LABEL[c.role]} · {c.email ?? "sans e-mail"} · {c.statut}
                      </small>
                    </span>
                  </div>
                ))}
              </div>

              <h3 className="console-h">Notes internes</h3>
              <div className="field">
                <textarea rows={4} value={String(f.notes ?? "")} onChange={(e) => set("notes", e.target.value)} placeholder="Historique des échanges, besoins, relances…" aria-label="Notes internes" />
              </div>
              {erreur && (
                <div className="error" role="alert">
                  {erreur}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={envoi}>
            Fermer
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi || !d}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
