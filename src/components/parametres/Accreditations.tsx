"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, ROLE_LABEL, useConnecte } from "@/lib/session";
import type { Compte } from "@/lib/session";
import { POSTES } from "@/lib/planning";
import { accesEffectif, LIBELLE_SOURCE, MODULES_ACCES, NIVEAUX, parDefaut } from "@/lib/accreditations";
import type { Regle } from "@/lib/accreditations";

type Onglet = "niveaux" | "personnes";

export default function Accreditations() {
  const { compte, etablissement } = useConnecte();
  const directeur = compte.role === "directeur";
  const sb = getSupabaseClient()!;
  const [onglet, setOnglet] = useState<Onglet>("niveaux");
  const [regles, setRegles] = useState<Regle[] | null>(null);
  const [equipe, setEquipe] = useState<Compte[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vivant = true;
    Promise.all([
      sb.from("accreditations_acces").select("module, autorise, poste, compte_id, niveau").eq("etablissement_id", etablissement.id),
      sb.from("comptes").select("id, etablissement_id, prenom, nom, email, role, statut, poste, avatar_url").eq("etablissement_id", etablissement.id).neq("statut", "parti"),
    ]).then(([r, c]) => {
      if (!vivant) return;
      setRegles((r.data ?? []) as Regle[]);
      setEquipe(((c.data ?? []) as Compte[]).sort((a, b) => nomComplet(a).localeCompare(nomComplet(b))));
    });
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /** Pose (ou retire, valeur null) un réglage pour un niveau hiérarchique ou une personne. */
  async function regler(module: string, cible: { niveau?: string; compte_id?: string }, valeur: boolean | null) {
    const cle = `${module}|${cible.niveau ?? cible.compte_id}`;
    setEnvoi(cle);
    let q = sb.from("accreditations_acces").delete().eq("etablissement_id", etablissement.id).eq("module", module);
    q = cible.niveau ? q.eq("niveau", cible.niveau) : q.eq("compte_id", cible.compte_id!);
    const { error: e1 } = await q;
    const e2 = !e1 && valeur !== null ? (await sb.from("accreditations_acces").insert({ etablissement_id: etablissement.id, module, autorise: valeur, niveau: cible.niveau ?? null, compte_id: cible.compte_id ?? null })).error : null;
    setEnvoi(null);
    if (e1 || e2) setToast("Modification refusée : réservée au directeur");
    recharger();
  }

  async function effacerZones() {
    const { error } = await sb.from("accreditations_acces").delete().eq("etablissement_id", etablissement.id).not("poste", "is", null);
    setToast(error ? "Suppression refusée" : "Anciens réglages par zone effacés");
    recharger();
  }

  const reglesZones = (regles ?? []).filter((r) => r.poste);

  const suivant = (v: boolean | undefined): boolean | null => (v === undefined ? true : v ? false : null);
  const nonDirecteurs = equipe.filter((p) => p.role !== "directeur");
  const personne = nonDirecteurs.find((p) => p.id === choisi) ?? nonDirecteurs[0];

  const sensibles = useMemo(
    () =>
      regles
        ? MODULES_ACCES.filter((m) => m.sensible).map((m) => ({ m, qui: equipe.filter((p) => accesEffectif(p, m.cle, regles).autorise) }))
        : [],
    [regles, equipe],
  );

  if (!directeur) {
    return (
      <div className="card soon-card">
        <h2>Accréditations</h2>
        <p>Seul le directeur règle les accès aux modules.</p>
      </div>
    );
  }

  const groupes = [...new Set(MODULES_ACCES.map((m) => m.groupe))];

  return (
    <>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        Qui voit quel module, selon la hiérarchie. Le directeur voit tout ; responsables et salariés suivent le réglage de leur niveau, sauf exception pour une personne. Les réglages d&apos;un module (paramètres HACCP, historique…) ont leur propre ligne.
      </p>

      {regles && sensibles.length > 0 && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h2>Accès sensibles</h2>
          </div>
          <div className="rows">
            {sensibles.map(({ m, qui }) => (
              <div key={m.cle} className="row">
                <span className="main-txt">
                  <b>{m.label}</b>
                  <small>{qui.map((p) => `${p.prenom ?? ""} (${ROLE_LABEL[p.role].toLowerCase()})`).join(", ") || "personne"}</small>
                </span>
                <span className={`pill ${qui.filter((p) => p.role === "salarie").length ? "t-peach" : "t-mint"}`}>{qui.length} personne(s)</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {reglesZones.length > 0 && (
        <div className="banner" style={{ background: "var(--yellow)", borderColor: "#eedda6" }}>
          <span>
            <b>{reglesZones.length} ancien(s) réglage(s) par zone de travail</b> (hérités de l&apos;ancien site : {[...new Set(reglesZones.map((r) => POSTES[r.poste!]?.label ?? r.poste))].join(", ")}). Ils
            s&apos;appliquent encore quand ni la personne ni son niveau n&apos;ont de réglage.
          </span>
          <button className="btn" onClick={effacerZones}>
            Les effacer
          </button>
        </div>
      )}

      <div className="week-nav">
        <div className="seg seg-inline" role="tablist">
          <button role="tab" aria-selected={onglet === "niveaux"} className={onglet === "niveaux" ? "on" : ""} onClick={() => setOnglet("niveaux")}>
            Par niveau
          </button>
          <button role="tab" aria-selected={onglet === "personnes"} className={onglet === "personnes" ? "on" : ""} onClick={() => setOnglet("personnes")}>
            Par personne
          </button>
        </div>
        <span className="hint">Clique sur une case : défaut → autorisé → refusé → défaut.</span>
      </div>

      {!regles ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />
      ) : onglet === "niveaux" ? (
        <section className="card" style={{ padding: "12px 6px 6px" }}>
          <div className="table-wrap">
            <table className="data acc-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th style={{ textAlign: "center" }}>Directeur</th>
                  {NIVEAUX.map((n) => (
                    <th key={n.cle} style={{ textAlign: "center" }}>
                      {n.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupes.map((g) => [
                  <tr key={g}>
                    <td colSpan={NIVEAUX.length + 2} className="nav-label" style={{ paddingTop: 14 }}>
                      {g}
                    </td>
                  </tr>,
                  ...MODULES_ACCES.filter((m) => m.groupe === g).map((m) => (
                    <tr key={m.cle}>
                      <td>
                        {m.label}
                        {m.sensible && <small className="pill t-peach" style={{ marginLeft: 6 }}>sensible</small>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="acc-cell oui" title="Le directeur a toujours accès à tout" style={{ cursor: "default", opacity: 0.7 }}>
                          ✓
                        </span>
                      </td>
                      {NIVEAUX.map((n) => {
                        const r = regles.find((x) => x.module === m.cle && x.niveau === n.cle);
                        const def = parDefaut(n.cle, m.cle);
                        return (
                          <td key={n.cle} style={{ textAlign: "center" }}>
                            <button
                              className={`acc-cell ${r ? (r.autorise ? "oui" : "non") : "defaut"}`}
                              onClick={() => regler(m.cle, { niveau: n.cle }, suivant(r?.autorise))}
                              disabled={envoi === `${m.cle}|${n.cle}`}
                              title={r ? (r.autorise ? `Autorisé pour les ${n.label.toLowerCase()}s` : `Refusé pour les ${n.label.toLowerCase()}s`) : `Valeur par défaut : ${def ? "autorisé" : "refusé"}`}
                            >
                              {r ? (r.autorise ? "✓" : "✕") : def ? "·✓" : "·"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ padding: "8px 12px" }}>
            <span className="acc-cell oui">✓</span> autorisé · <span className="acc-cell non">✕</span> refusé · <span className="acc-cell defaut">·✓</span> ouvert par défaut ·{" "}
            <span className="acc-cell defaut">·</span> fermé par défaut
          </p>
        </section>
      ) : !nonDirecteurs.length ? (
        <section className="card empty">Personne d&apos;autre que le directeur dans l&apos;équipe.</section>
      ) : (
        <div className="resa-grid" style={{ gridTemplateColumns: "260px minmax(0, 1fr)" }}>
          <section className="card" style={{ padding: 8, alignSelf: "start" }}>
            {nonDirecteurs.map((p) => (
              <button key={p.id} className={`conv${p.id === personne?.id ? " on" : ""}`} onClick={() => setChoisi(p.id)}>
                <span className="avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : initiales(p)}</span>
                <span className="conv-txt">
                  <b style={{ fontSize: 13 }}>{nomComplet(p)}</b>
                  <small className="hint">
                    {ROLE_LABEL[p.role]} · {p.poste ? POSTES[p.poste]?.label : "sans poste"}
                  </small>
                </span>
              </button>
            ))}
          </section>
          {personne && (
            <section className="card">
              <div className="card-head">
                <h2>{nomComplet(personne)}</h2>
                <span className="hint">
                  {ROLE_LABEL[personne.role]} · poste {personne.poste ? POSTES[personne.poste]?.label : "non défini"}
                </span>
              </div>
              <div className="rows">
                {MODULES_ACCES.map((m) => {
                  const eff = accesEffectif(personne, m.cle, regles);
                  const perso = regles.find((x) => x.module === m.cle && x.compte_id === personne.id);
                  return (
                    <div key={m.cle} className="row">
                      <span className={`pill ${eff.autorise ? "t-mint" : "t-lav"}`} style={{ minWidth: 30, justifyContent: "center" }}>
                        {eff.autorise ? "✓" : "✕"}
                      </span>
                      <span className="main-txt">
                        <b>{m.label}</b>
                        <small>{LIBELLE_SOURCE[eff.source]}</small>
                      </span>
                      <span className="seg acc-seg">
                        {([
                          [null, "Suivre son niveau"],
                          [true, "Autoriser"],
                          [false, "Refuser"],
                        ] as const).map(([v, l]) => (
                          <button key={String(v)} className={(perso ? perso.autorise === v : v === null) ? "on" : ""} onClick={() => regler(m.cle, { compte_id: personne.id }, v)} disabled={envoi === `${m.cle}|${personne.id}`}>
                            {l}
                          </button>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
