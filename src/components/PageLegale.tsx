import Link from "next/link";
import type { ReactNode } from "react";
import Marque from "@/components/Marque";
import { DATE_CONDITIONS } from "@/lib/editeur";

export const PAGES_LEGALES = [
  { href: "/mentions-legales", titre: "Mentions légales" },
  { href: "/conditions", titre: "Conditions générales d'abonnement" },
  { href: "/confidentialite", titre: "Politique de confidentialité" },
  { href: "/sous-traitance", titre: "Accord de sous-traitance des données" },
];

/** Valeur de l'identité de l'éditeur, ou marqueur visible tant qu'elle n'est pas renseignée. */
export function Info({ v, quoi }: { v: string | null; quoi: string }) {
  return v ? <>{v}</> : <mark className="a-completer">{quoi} (à compléter)</mark>;
}

// Mise en page commune des pages légales : en-tête, sommaire, texte et liens entre les pages.
export default function PageLegale({ titre, intro, sommaire, children }: { titre: string; intro?: ReactNode; sommaire: { id: string; titre: string }[]; children: ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-haut">
        <Link href="/" className="brand">
          <Marque />Juliette
        </Link>
        <Link href="/souscription" className="btn">
          Créer mon établissement
        </Link>
      </header>
      <main className="legal-corps">
        <p className="eyebrow">Informations légales</p>
        <h1>{titre}</h1>
        <p className="legal-date">En vigueur au {DATE_CONDITIONS}</p>
        {intro && <div className="legal-intro">{intro}</div>}
        <nav className="legal-sommaire" aria-label="Sommaire">
          <b>Sommaire</b>
          <ol>
            {sommaire.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.titre}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="legal-texte">{children}</article>
      </main>
      <footer className="legal-pied">
        <nav aria-label="Pages légales">
          {PAGES_LEGALES.map((p) => (
            <Link key={p.href} href={p.href}>
              {p.titre}
            </Link>
          ))}
        </nav>
        <span className="hint">© {new Date().getFullYear()} Juliette</span>
      </footer>
    </div>
  );
}

export function Section({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2>{titre}</h2>
      {children}
    </section>
  );
}
