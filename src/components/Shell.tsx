"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUPES, MODULES, SECTIONS, moduleDeRoute, pagesDeSection } from "@/lib/modules";
import type { ModuleJuliette, SectionCle } from "@/lib/modules";
import { initiales, nomComplet, ROLE_LABEL, useConnecte, useSession } from "@/lib/session";
import { useDispositionMenu } from "@/lib/preferences";
import Icone from "@/components/Icone";
import type { NomIcone } from "@/components/Icone";
import Marque from "@/components/Marque";

export default function Shell({ children }: { children: ReactNode }) {
  const { compte, etablissement, sites, modules } = useConnecte();
  const { deconnexion, changerEtablissement } = useSession();
  const pathname = usePathname();
  const [recherche, setRecherche] = useState("");
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [sitesOuverts, setSitesOuverts] = useState(false);
  const refSites = useRef<HTMLDivElement>(null);
  const [disposition] = useDispositionMenu();
  const horizontale = disposition === "horizontale";
  const [groupeOuvert, setGroupeOuvert] = useState<string | null>(null);
  const refHnav = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!groupeOuvert) return;
    const fermer = (e: MouseEvent) => {
      if (!refHnav.current?.contains(e.target as Node)) setGroupeOuvert(null);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [groupeOuvert]);

  useEffect(() => {
    if (!sitesOuverts) return;
    const fermer = (e: MouseEvent) => {
      if (!refSites.current?.contains(e.target as Node)) setSitesOuverts(false);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [sitesOuverts]);

  const courant = moduleDeRoute(pathname);

  // Menu allégé : une rubrique regroupée (Équipe, Stock & commandes, Salle) n'occupe qu'une ligne,
  // qui mène à sa première page autorisée. La recherche, elle, retrouve aussi les pages internes.
  type Entree = { cle: string; href: string; label: string; sub: string; icon: NomIcone; groupe: ModuleJuliette["groupe"]; actif: boolean; pret: boolean };
  const entrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const trouve = (m: ModuleJuliette) => !q || m.label.toLowerCase().includes(q) || m.sub.toLowerCase().includes(q);
    const vus = new Set<SectionCle>();
    const liste: Entree[] = [];
    for (const m of MODULES) {
      if (!modules.has(m.module) || m.horsMenu) continue;
      if (m.section && !q) {
        if (vus.has(m.section)) continue;
        vus.add(m.section);
        const s = SECTIONS[m.section];
        liste.push({ cle: m.section, href: m.href, label: s.label, sub: s.sub, icon: s.icon, groupe: m.groupe, actif: courant?.section === m.section, pret: true });
      } else if (trouve(m)) {
        liste.push({ cle: m.module, href: m.href, label: m.label, sub: m.sub, icon: m.icon, groupe: m.groupe, actif: courant?.href === m.href, pret: m.pret });
      }
    }
    return liste;
  }, [modules, recherche, courant]);

  const soeurs = courant?.section ? pagesDeSection(courant.section, modules) : [];
  const messagerie = modules.has("messagerie");

  // Barre du bas (téléphone) : les usages du quotidien, à portée de pouce.
  const barreBas = useMemo(() => {
    const preferes = ["dashboard", "pointeuse", "planning", "messagerie", "commandes-caisse", "haccp", "fiche-technique"];
    return preferes
      .map((cle) => MODULES.find((m) => m.module === cle))
      .filter((m): m is (typeof MODULES)[number] => !!m && modules.has(m.module))
      .slice(0, 4);
  }, [modules]);

  // Tableaux lisibles sur téléphone : chaque cellule reçoit le titre de sa colonne (data-label),
  // que la feuille de style affiche quand le tableau se transforme en fiches.
  const refContenu = useRef<HTMLElement>(null);
  useEffect(() => {
    const racine = refContenu.current;
    if (!racine) return;
    let attente = 0;
    const etiqueter = () => {
      attente = 0;
      for (const table of racine.querySelectorAll<HTMLTableElement>("table.data")) {
        const tetes = table.tHead?.rows[table.tHead.rows.length - 1];
        if (!tetes) continue;
        const labels = [...tetes.cells].map((c) => c.textContent?.trim() ?? "");
        for (const tr of table.tBodies[0]?.rows ?? []) {
          [...tr.cells].forEach((td, i) => {
            if (td.colSpan > 1) td.dataset.groupe = "1";
            else if (labels[i] && td.dataset.label !== labels[i]) td.dataset.label = labels[i];
          });
        }
      }
    };
    const obs = new MutationObserver(() => {
      if (!attente) attente = requestAnimationFrame(etiqueter);
    });
    obs.observe(racine, { childList: true, subtree: true });
    etiqueter();
    return () => {
      obs.disconnect();
      cancelAnimationFrame(attente);
    };
  }, []);
  // Rubrique à onglets (téléphone) : l'onglet de la page ouverte reste visible.
  useEffect(() => {
    document.querySelector(".section-tabs .on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  const aujourdhui = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={`shell${horizontale ? " horizontale" : ""}`}>
      <div className={`scrim${menuOuvert ? " open" : ""}`} onClick={() => setMenuOuvert(false)} />
      <aside className={`sidebar${menuOuvert ? " open" : ""}`} aria-label="Navigation principale">
        <Link href="/dashboard" className="brand" style={{ padding: "0 8px" }}>
          <Marque />Juliette
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
          <Icone nom="recherche" taille={15} />
          <input placeholder="Rechercher un module" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>

        {GROUPES.map((g) => {
          const items = entrees.filter((m) => m.groupe === g);
          if (!items.length) return null;
          return (
            <nav key={g} className="nav-group">
              <div className="nav-label">{g}</div>
              {items.map((m) => (
                <Link key={m.cle} href={m.href} className={`nav-item${m.actif ? " active" : ""}`} title={m.sub} onClick={() => setMenuOuvert(false)}>
                  <span className="ic" aria-hidden>
                    <Icone nom={m.icon} />
                  </span>
                  {m.label}
                  {!m.pret && <span className="soon">bientôt</span>}
                </Link>
              ))}
            </nav>
          );
        })}
        {!entrees.length && <div className="empty">Aucun module trouvé.</div>}

        <div className="profile">
          <Link href="/parametres" className="profile-link" title="Mon compte" onClick={() => setMenuOuvert(false)}>
            <span className="avatar">{compte.avatar_url ? <img src={compte.avatar_url} alt="" /> : initiales(compte)}</span>
            <span className="who">
              <b>{nomComplet(compte)}</b>
              <small>{ROLE_LABEL[compte.role]}</small>
            </span>
          </Link>
          <button className="icon-btn" onClick={deconnexion} title="Se déconnecter" aria-label="Se déconnecter">
            <Icone nom="deconnexion" taille={17} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {horizontale && (
            <nav className="hnav" ref={refHnav} aria-label="Navigation principale">
              <Link href="/dashboard" className="brand hnav-brand">
                <Marque />
              </Link>
              {GROUPES.map((g) => {
                const items = entrees.filter((m) => m.groupe === g);
                if (!items.length) return null;
                const actif = items.some((m) => m.actif);
                if (items.length === 1)
                  return (
                    <Link key={g} href={items[0].href} className={`hnav-btn${actif ? " on" : ""}`}>
                      {items[0].label}
                    </Link>
                  );
                return (
                  <div key={g} className="hnav-groupe">
                    <button className={`hnav-btn${actif ? " on" : ""}`} aria-expanded={groupeOuvert === g} onClick={() => setGroupeOuvert((o) => (o === g ? null : g))}>
                      {g} <span aria-hidden>⌄</span>
                    </button>
                    {groupeOuvert === g && (
                      <div className="hnav-menu" role="menu">
                        {items.map((m) => (
                          <Link key={m.cle} href={m.href} role="menuitem" className={m.actif ? "on" : ""} onClick={() => setGroupeOuvert(null)}>
                            <span className="ic" aria-hidden>
                              <Icone nom={m.icon} />
                            </span>
                            <span>
                              <b>{m.label}</b>
                              <small>{m.sub}</small>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}
          <div className="crumb">
            <button className="icon-btn menu-btn" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu">
              <Icone nom="menu" taille={18} />
            </button>
            <span className="hide-sm">{etablissement.nom}</span>
            <span aria-hidden className="hide-sm" style={{ color: "#cfcad6" }}>/</span>
            {courant?.section && <span className="hide-sm">{SECTIONS[courant.section].label}</span>}
            {courant?.section && <span aria-hidden className="hide-sm" style={{ color: "#cfcad6" }}>/</span>}
            <b>{courant?.label ?? "Juliette"}</b>
          </div>
          <div className="top-right">
            {messagerie && (
              <Link href="/messagerie" className={`btn-messages${courant?.module === "messagerie" ? " on" : ""}`} aria-label="Messagerie" title="Messagerie">
                <Icone nom="mail" />
                <span className="hide-sm">Messages</span>
              </Link>
            )}
            {horizontale ? (
              <Link href="/parametres" className="hnav-profil" title={`${nomComplet(compte)} · ${etablissement.nom}`}>
                <span className="avatar">{compte.avatar_url ? <img src={compte.avatar_url} alt="" /> : initiales(compte)}</span>
                <span className="hide-sm">{etablissement.nom}</span>
              </Link>
            ) : (
              <span className="live">
                <i /> En ligne
              </span>
            )}
            <span className="hide-sm" style={{ textTransform: "capitalize" }}>
              {aujourdhui}
            </span>
          </div>
        </header>
        <main className="content" ref={refContenu}>
          {soeurs.length > 1 && (
            <div className="tabs-scroll print-hide">
              <nav className="haccp-tabs section-tabs" aria-label={SECTIONS[courant!.section!].label}>
                {soeurs.map((m) => (
                  <Link key={m.href} href={m.href} className={courant?.href === m.href ? "on" : ""} aria-current={courant?.href === m.href ? "page" : undefined}>
                    <Icone nom={m.icon} taille={15} /> {m.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
          {children}
        </main>
      </div>

      <nav className="barre-bas" aria-label="Accès rapide">
        {barreBas.map((m) => (
          <Link key={m.href} href={m.href} className={courant?.href === m.href ? "on" : ""}>
            <Icone nom={m.icon} taille={20} />
            {m.module === "dashboard" ? "Accueil" : m.module === "pointeuse" ? "Pointer" : m.module === "messagerie" ? "Messages" : m.module === "commandes-caisse" ? "Commandes" : m.label}
          </Link>
        ))}
        <button onClick={() => setMenuOuvert(true)} className={menuOuvert ? "on" : ""}>
          <Icone nom="menu" taille={20} />
          Menu
        </button>
      </nav>
    </div>
  );
}
