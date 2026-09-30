"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icone from "@/components/Icone";
import { FAQ, GUIDES, PREMIERS_PAS } from "@/lib/aide";
import type { Guide } from "@/lib/aide";
import { useConnecte } from "@/lib/session";

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const texteDe = (g: Guide) => sansAccents([g.titre, g.resume, g.pour, ...g.etapes.flatMap((e) => [e.titre, e.texte]), ...(g.astuces ?? [])].join(" "));

export default function Aide() {
  const { compte, modules } = useConnecte();
  const [q, setQ] = useState("");
  const directeur = compte.role === "directeur";

  // On n'explique que les modules auxquels la personne a accès.
  const guides = useMemo(() => {
    const visibles = GUIDES.filter((g) => !g.href || [...modules].some((m) => g.href === `/${m}` || (m === "commandes-caisse" && g.href === "/commandes-clients")) || g.id === "parametres");
    return directeur ? [PREMIERS_PAS, ...visibles] : visibles;
  }, [modules, directeur]);

  const recherche = sansAccents(q.trim());
  const trouves = recherche ? guides.filter((g) => texteDe(g).includes(recherche)) : guides;
  const faq = recherche ? FAQ.filter((f) => sansAccents(f.q + " " + f.r).includes(recherche)) : FAQ;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Centre d&apos;aide</p>
          <h1>Comment utiliser Juliette</h1>
          <p>Un guide pas à pas pour chaque module{directeur ? ", et la mise en route complète de ton établissement" : ""}.</p>
        </div>
      </div>

      <label className="search aide-recherche">
        <Icone nom="recherche" taille={16} />
        <input placeholder="Rechercher : inventaire, contrat, frigo, import Excel…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher dans l'aide" />
      </label>

      <div className="aide">
        <nav className="aide-sommaire" aria-label="Sommaire de l'aide">
          {trouves.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              <Icone nom={g.icone} taille={15} />
              {g.id === "premiers-pas" ? "Premiers pas" : g.titre}
            </a>
          ))}
          {faq.length > 0 && (
            <a href="#questions">
              <Icone nom="aide" taille={15} />
              Questions fréquentes
            </a>
          )}
        </nav>

        <div className="aide-contenu">
          {!trouves.length && !faq.length && (
            <div className="card empty">
              <b>Aucun résultat pour « {q} »</b>
              Essaie un autre mot, ou écris à l&apos;équipe Juliette depuis la messagerie.
            </div>
          )}

          {trouves.map((g) => (
            <section key={g.id} id={g.id} className={`card aide-guide${g.id === "premiers-pas" ? " aide-premiers" : ""}`}>
              <header>
                <span className="chip-ic t-lav">
                  <Icone nom={g.icone} taille={18} />
                </span>
                <div>
                  <h2>{g.titre}</h2>
                  <small>Pour : {g.pour}</small>
                </div>
                {g.href && (
                  <Link href={g.href} className="btn aide-ouvrir">
                    Ouvrir
                  </Link>
                )}
              </header>
              <p className="aide-resume">{g.resume}</p>
              <ol className="aide-etapes">
                {g.etapes.map((e) => (
                  <li key={e.titre}>
                    <b>{e.titre}</b>
                    <span>{e.texte}</span>
                  </li>
                ))}
              </ol>
              {g.astuces?.map((a) => (
                <p key={a} className="aide-astuce">
                  <Icone nom="astuce" taille={15} /> {a}
                </p>
              ))}
            </section>
          ))}

          {faq.length > 0 && (
            <section id="questions" className="card aide-guide">
              <header>
                <span className="chip-ic t-lav">
                  <Icone nom="aide" taille={18} />
                </span>
                <div>
                  <h2>Questions fréquentes</h2>
                </div>
              </header>
              <div className="aide-faq">
                {faq.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.r}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
