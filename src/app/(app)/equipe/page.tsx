"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, ROLE_LABEL, useConnecte } from "@/lib/session";
import type { Compte } from "@/lib/session";

type Membre = Compte & { telephone: string | null; fonction: string | null; type_contrat: string | null; date_embauche: string | null };

const POSTES: Record<string, string> = { salle: "Salle", cuisine: "Cuisine", plonge: "Plonge", extra: "Extra", management: "Management", bar: "Bar" };
const STATUT: Record<string, [string, string]> = { actif: ["Actif", "t-mint"], invite: ["Invité", "t-yellow"], parti: ["Parti", "t-blue"] };

export default function Equipe() {
  const { etablissement } = useConnecte();
  const [membres, setMembres] = useState<Membre[] | null>(null);
  const [filtre, setFiltre] = useState("");
  const [voirPartis, setVoirPartis] = useState(false);

  useEffect(() => {
    getSupabaseClient()!
      .from("comptes")
      .select("id, etablissement_id, prenom, nom, email, role, statut, poste, avatar_url, telephone, fonction, type_contrat, date_embauche")
      .eq("etablissement_id", etablissement.id)
      .order("prenom")
      .then(({ data }) => setMembres((data ?? []) as Membre[]));
  }, [etablissement.id]);

  const liste = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    return (membres ?? [])
      .filter((m) => voirPartis || m.statut !== "parti")
      .filter((m) => !q || `${nomComplet(m)} ${m.email ?? ""} ${m.fonction ?? ""}`.toLowerCase().includes(q));
  }, [membres, filtre, voirPartis]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Équipe</p>
          <h1>Annuaire du personnel</h1>
          <p>{membres ? `${membres.filter((m) => m.statut !== "parti").length} personne(s) dans l'équipe` : "Chargement…"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={voirPartis} onChange={(e) => setVoirPartis(e.target.checked)} /> Afficher les départs
          </label>
          <label className="search" style={{ width: 220, background: "var(--card)" }}>
            <span aria-hidden>⌕</span>
            <input placeholder="Rechercher" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          </label>
        </div>
      </div>

      <section className="card" style={{ padding: "16px 6px 6px" }}>
        {!membres ? (
          <div style={{ display: "grid", gap: 12, padding: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 38 }} />)}
          </div>
        ) : !liste.length ? (
          <div className="empty">Aucune personne ne correspond.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Nom</th><th>Poste</th><th>Rôle</th><th>Contact</th><th>Contrat</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {liste.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="avatar">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
                        <span style={{ display: "grid", gap: 1 }}>
                          <b style={{ fontWeight: 600 }}>{nomComplet(m)}</b>
                          <small style={{ color: "var(--muted)" }}>{m.fonction ?? ""}</small>
                        </span>
                      </span>
                    </td>
                    <td>{m.poste ? POSTES[m.poste] ?? m.poste : "—"}</td>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td>
                      <span style={{ display: "grid", gap: 1 }}>
                        <span>{m.email ?? "—"}</span>
                        {m.telephone && <small style={{ color: "var(--muted)" }}>{m.telephone}</small>}
                      </span>
                    </td>
                    <td>
                      {m.type_contrat ?? "—"}
                      {m.date_embauche && <small style={{ display: "block", color: "var(--muted)" }}>depuis le {new Date(m.date_embauche).toLocaleDateString("fr-FR")}</small>}
                    </td>
                    <td><span className={`pill ${STATUT[m.statut][1]}`}>{STATUT[m.statut][0]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
