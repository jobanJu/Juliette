"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { initiales, nomComplet, ROLE_LABEL, useConnecte } from "@/lib/session";
import { ORDRE_POSTES, POSTES } from "@/lib/planning";
import { anciennete, chargerMembres, FONCTIONS, NATURES, STATUTS, TYPES_CONTRAT } from "@/lib/personnel";
import type { Membre } from "@/lib/personnel";
import ModalNouveau from "@/components/equipe/ModalNouveau";
import Icone from "@/components/Icone";

type Onglet = "actifs" | "invites" | "partis";

export default function Equipe() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const [membres, setMembres] = useState<Membre[] | null>(null);
  const [version, setVersion] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [onglet, setOnglet] = useState<Onglet>("actifs");
  const [poste, setPoste] = useState("tous");
  const [ajout, setAjout] = useState(false);

  useEffect(() => {
    let actif = true;
    chargerMembres(etablissement.id).then((data) => actif && setMembres(data ?? []));
    return () => {
      actif = false;
    };
  }, [etablissement.id, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  const compte_ = useMemo(() => {
    const m = membres ?? [];
    return { actifs: m.filter((x) => x.statut === "actif").length, invites: m.filter((x) => x.statut === "invite").length, partis: m.filter((x) => x.statut === "parti").length };
  }, [membres]);

  const liste = useMemo(() => {
    const statut = onglet === "actifs" ? "actif" : onglet === "invites" ? "invite" : "parti";
    const q = recherche.trim().toLowerCase();
    return (membres ?? [])
      .filter((m) => m.statut === statut)
      .filter((m) => poste === "tous" || (m.poste ?? "aucun") === poste)
      .filter((m) => !q || `${nomComplet(m)} ${m.email ?? ""} ${FONCTIONS[m.fonction ?? ""] ?? ""} ${m.telephone ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => ORDRE_POSTES.indexOf(a.poste ?? "") - ORDRE_POSTES.indexOf(b.poste ?? "") || nomComplet(a).localeCompare(nomComplet(b)));
  }, [membres, onglet, poste, recherche]);

  const heuresContrat = useMemo(
    () => (membres ?? []).filter((m) => m.statut !== "parti").reduce((s, m) => s + Number(m.heures_contrat ?? 0), 0),
    [membres],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Équipe</p>
          <h1>Gestion du personnel</h1>
          <p>
            {membres
              ? `${compte_.actifs} actif(s)${compte_.invites ? ` · ${compte_.invites} invitation(s) en attente` : ""} · ${heuresContrat} h contractuelles par semaine`
              : "Chargement…"}
          </p>
        </div>
        {gestion && (
          <button className="btn btn-primary" onClick={() => setAjout(true)}>
            + Ajouter un collaborateur
          </button>
        )}
      </div>

      <div className="week-nav">
        <div className="seg seg-inline" role="tablist">
          {(
            [
              ["actifs", "Actifs", compte_.actifs],
              ["invites", "Invités", compte_.invites],
              ["partis", "Départs", compte_.partis],
            ] as const
          ).map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={onglet === k} className={onglet === k ? "on" : ""} onClick={() => setOnglet(k)}>
              {l} <span className="seg-count">{n}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="select-sm" value={poste} onChange={(e) => setPoste(e.target.value)} aria-label="Filtrer par poste">
            <option value="tous">Tous les postes</option>
            {ORDRE_POSTES.map((k) => (
              <option key={k} value={k}>
                {POSTES[k].label}
              </option>
            ))}
            <option value="aucun">Sans poste</option>
          </select>
          <label className="search" style={{ width: 230, background: "var(--card)" }}>
            <Icone nom="recherche" taille={15} />
            <input placeholder="Nom, fonction, téléphone…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
        </div>
      </div>

      {!membres ? (
        <div className="people-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 150, borderRadius: 14 }} />
          ))}
        </div>
      ) : !liste.length ? (
        <div className="card empty">
          <b>{recherche || poste !== "tous" ? "Aucune personne ne correspond" : onglet === "invites" ? "Aucune invitation en attente" : onglet === "partis" ? "Aucun départ enregistré" : "Personne dans l'équipe"}</b>
          {onglet === "actifs" && gestion && !recherche && "Ajoute un premier collaborateur pour démarrer."}
        </div>
      ) : (
        <div className="people-grid">
          {liste.map((m) => (
            <Link key={m.id} href={`/equipe/${m.id}`} className="card person-card">
              <div className="person-top">
                <span className="avatar avatar-lg">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
                <span className="who">
                  <b>
                    {nomComplet(m)}
                    {m.id === compte.id ? " (moi)" : ""}
                  </b>
                  <small>{FONCTIONS[m.fonction ?? ""] ?? ROLE_LABEL[m.role]}</small>
                </span>
              </div>
              <div className="person-tags">
                {m.poste && <span className={`pill ${POSTES[m.poste]?.ton ?? "t-lav"}`}>{POSTES[m.poste]?.label ?? m.poste}</span>}
                {m.role !== "salarie" && <span className="pill t-lav">{ROLE_LABEL[m.role]}</span>}
                {m.statut !== "actif" && <span className={`pill ${STATUTS[m.statut].ton}`}>{STATUTS[m.statut].label}</span>}
              </div>
              <div className="person-meta">
                <span>
                  {[NATURES[m.nature_contrat ?? ""], TYPES_CONTRAT[m.type_contrat ?? ""]?.label].filter(Boolean).join(" · ") || "Contrat non renseigné"}
                </span>
                <span>{m.statut === "parti" ? `Parti le ${m.date_depart ? new Date(m.date_depart + "T00:00").toLocaleDateString("fr-FR") : "?"}` : anciennete(m.date_embauche) ?? ""}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {ajout && (
        <ModalNouveau
          etablissementId={etablissement.id}
          code={etablissement.code}
          nomEtablissement={etablissement.nom}
          monRole={compte.role}
          emailsExistants={(membres ?? []).map((m) => (m.email ?? "").toLowerCase()).filter(Boolean)}
          onClose={() => setAjout(false)}
          onCree={() => {
            setOnglet("invites");
            recharger();
          }}
        />
      )}
    </>
  );
}
