"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUPES, MODULES, moduleDeRoute } from "@/lib/modules";
import { initiales, nomComplet, ROLE_LABEL, useConnecte, useSession } from "@/lib/session";

export default function Shell({ children }: { children: ReactNode }) {
  const { compte, etablissement, sites, modules } = useConnecte();
  const { deconnexion, changerEtablissement } = useSession();
  const pathname = usePathname();
  const [recherche, setRecherche] = useState("");
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [sitesOuverts, setSitesOuverts] = useState(false);
  const refSites = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sitesOuverts) return;
    const fermer = (e: MouseEvent) => {
      if (!refSites.current?.contains(e.target as Node)) setSitesOuverts(false);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [sitesOuverts]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return MODULES.filter((m) => modules.has(m.module)).filter(
      (m) => !q || m.label.toLowerCase().includes(q) || m.sub.toLowerCase().includes(q),
    );
  }, [modules, recherche]);

  const courant = moduleDeRoute(pathname);
  const aujourdhui = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="shell">
      <div className={`scrim${menuOuvert ? " open" : ""}`} onClick={() => setMenuOuvert(false)} />
      <aside className={`sidebar${menuOuvert ? " open" : ""}`} aria-label="Navigation principale">
        <Link href="/dashboard" className="brand" style={{ padding: "0 8px" }}>
          <span className="brand-mark">J</span>Juliette
        </Link>

        <div className="popover" ref={refSites}>
          <button
            className="site-switch"
            onClick={() => sites.length > 1 && setSitesOuverts((o) => !o)}
            aria-expanded={sitesOuverts}
            style={{ cursor: sites.length > 1 ? "pointer" : "default" }}
          >
            <span className="site-icon">{etablissement.nom[0]?.toUpperCase()}</span>
            <span className="site-text">
              <b>{etablissement.nom}</b>
              <small>
                {etablissement.ville ?? "—"} · {etablissement.code}
              </small>
            </span>
            {sites.length > 1 && <span style={{ color: "var(--muted)" }}>⌄</span>}
          </button>
          {sitesOuverts && (
            <div className="popover-menu" role="menu">
              {sites.map((s) => (
                <button key={s.etablissement.id} role="menuitem" onClick={() => changerEtablissement(s.etablissement.id)}>
                  <b style={{ fontSize: 12.5 }}>{s.etablissement.nom}</b>
                  <small>
                    {s.etablissement.ville ?? "—"} · {ROLE_LABEL[s.compte.role]}
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="search">
          <span aria-hidden>⌕</span>
          <input placeholder="Rechercher un module" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>

        {GROUPES.map((g) => {
          const items = visibles.filter((m) => m.groupe === g);
          if (!items.length) return null;
          return (
            <nav key={g} className="nav-group">
              <div className="nav-label">{g}</div>
              {items.map((m) => (
                <Link key={m.href} href={m.href} className={`nav-item${courant?.href === m.href ? " active" : ""}`} title={m.sub} onClick={() => setMenuOuvert(false)}>
                  <span className="ic" aria-hidden>
                    {m.icon}
                  </span>
                  {m.label}
                  {!m.pret && <span className="soon">bientôt</span>}
                </Link>
              ))}
            </nav>
          );
        })}
        {!visibles.length && <div className="empty">Aucun module trouvé.</div>}

        <div className="profile">
          <span className="avatar">{compte.avatar_url ? <img src={compte.avatar_url} alt="" /> : initiales(compte)}</span>
          <span className="who">
            <b>{nomComplet(compte)}</b>
            <small>{ROLE_LABEL[compte.role]}</small>
          </span>
          <button className="icon-btn" onClick={deconnexion} title="Se déconnecter" aria-label="Se déconnecter">
            ⎋
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            <button className="icon-btn menu-btn" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu">
              ☰
            </button>
            <span className="hide-sm">{etablissement.nom}</span>
            <span aria-hidden style={{ color: "#cfcad6" }}>/</span>
            <b>{courant?.label ?? "Juliette"}</b>
          </div>
          <div className="top-right">
            <span className="live">
              <i /> En ligne
            </span>
            <span className="hide-sm" style={{ textTransform: "capitalize" }}>
              {aujourdhui}
            </span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
