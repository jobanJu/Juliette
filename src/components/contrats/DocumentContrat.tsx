"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { blocs } from "@/lib/contrats";
import type { Bloc } from "@/lib/contrats";

export type SignaturesContrat = {
  signature_employeur: string | null;
  signe_employeur_at: string | null;
  signature_salarie: string | null;
  signe_salarie_at: string | null;
  empreinte: string | null;
};

// Page A4 imprimée : 210 × 297 mm, marges 16 mm (côtés, haut) et 24 mm en bas (pied de page).
const MM = 96 / 25.4;
const HAUTEUR_UTILE = (297 - 16 - 24) * MM;

const horodatage = (at: string) => new Date(at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Texte avec **gras** en ligne. */
function Riche({ texte }: { texte: string }) {
  return (
    <>
      {texte.split(/(\*\*[^*]+\*\*)/g).map((m, i) => (m.startsWith("**") ? <b key={i}>{m.slice(2, -2)}</b> : <Fragment key={i}>{m}</Fragment>))}
    </>
  );
}

function Signature({ role, nom, image, le, mention = "Lu et approuvé" }: { role: string; nom: string; image: string | null; le: string | null; mention?: string }) {
  return (
    <div className="contrat-sig">
      <small>{role}</small>
      <b>{nom}</b>
      {image ? (
        <>
          <span className="contrat-sig-lu">{mention}</span>
          <img src={image} alt={`Signature : ${role}`} />
          <small>Signé électroniquement le {horodatage(le!)}</small>
        </>
      ) : (
        <>
          <span className="contrat-sig-ligne">Date : </span>
          <span className="contrat-sig-mention">Mention manuscrite « {mention} » puis signature :</span>
          <span className="contrat-sig-vide" />
        </>
      )}
    </div>
  );
}

/** Initiales d'un nom : « Diane Test » → « D.T. » */
export function initialesDe(nom: string) {
  return nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((m) => m[0]!.toUpperCase() + ".")
    .join("");
}

type Unite = { cle: string; contenu: ReactNode; /** titre d'article : ne jamais le laisser seul en bas de page */ colle?: boolean };

/** Découpe le texte en unités insécables (un titre, un paragraphe, un encadré…). */
type OptionsSignature = { roleSalarie: string | null; mentionSalarie: string };

function unites(texte: string, employeur: string, salarie: string, sig: SignaturesContrat | undefined, feminin: boolean, opt: OptionsSignature): Unite[] {
  const liste = blocs(texte);
  const res: Unite[] = [];
  // Anciens contrats (mise en page précédente) : bandeau d'en-tête conservé.
  const entete = texte.includes("\n| ") ? (
    <div className="contrat-entete">
      <b>{employeur}</b>
      <span>
        {texte.startsWith("# Avenant") ? "Avenant au contrat de travail" : "Contrat de travail"} · {salarie}
      </span>
    </div>
  ) : null;
  for (let i = 0; i < liste.length; i++) {
    const b = liste[i];
    const cle = `u${i}`;
    if (b.type === "titre") {
      const sous = liste[i + 1]?.type === "soustitre" ? (liste[++i] as Extract<Bloc, { type: "soustitre" }>) : null;
      res.push({
        cle,
        contenu: (
          <>
            {entete}
            <h1>{b.texte}</h1>
            {sous && <p className="contrat-sous">{sous.texte}</p>}
          </>
        ),
      });
    } else if (b.type === "partie") {
      const groupe: Extract<Bloc, { type: "partie" }>[] = [];
      while (liste[i]?.type === "partie") groupe.push(liste[i++] as Extract<Bloc, { type: "partie" }>);
      i--;
      res.push({
        cle,
        contenu: (
          <div className="contrat-parties">
            {groupe.map((p) => (
              <section key={p.titre}>
                <h3>{p.titre}</h3>
                {p.lignes.map((l, j) => (
                  <p key={j}>
                    <Riche texte={l} />
                  </p>
                ))}
              </section>
            ))}
          </div>
        ),
      });
    } else if (b.type === "soustitre") res.push({ cle, contenu: <p className="contrat-sous">{b.texte}</p> });
    else if (b.type === "bref")
      res.push({
        cle,
        contenu: (
          <section className="contrat-bref">
            <h3>En bref</h3>
            <dl>
              {b.lignes.map(([l, v]) => (
                <Fragment key={l}>
                  <dt>{l}</dt>
                  <dd>{v}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ),
      });
    else if (b.type === "article") res.push({ cle, colle: true, contenu: <h2>{b.texte}</h2> }); else if (b.type === "liste")
      res.push({
        cle,
        contenu: (
          <>
            {b.intro && (
              <p>
                <Riche texte={b.intro} />
              </p>
            )}
            <ul>
              {b.items.map((x, j) => (
                <li key={j}>
                  <Riche texte={x} />
                </li>
              ))}
            </ul>
          </>
        ),
      });
    else
      res.push({
        cle,
        contenu: (
          <p>
            <Riche texte={b.texte} />
          </p>
        ),
      });
  }
  res.push({
    cle: "signatures",
    contenu: (
      <>
        <div className={`contrat-signatures${opt.roleSalarie === null ? " seule" : ""}`}>
          <Signature role="Pour l'employeur" nom={employeur} image={sig?.signature_employeur ?? null} le={sig?.signe_employeur_at ?? null} mention={opt.roleSalarie === null ? "Signature et cachet" : "Lu et approuvé"} />
          {opt.roleSalarie !== null && <Signature role={opt.roleSalarie || (feminin ? "La salariée" : "Le salarié")} nom={salarie} image={sig?.signature_salarie ?? null} le={sig?.signe_salarie_at ?? null} mention={opt.mentionSalarie} />}
        </div>
        {sig?.empreinte && (
          <p className="contrat-preuve">
            Empreinte SHA-256 du texte signé : <code>{sig.empreinte}</code>. Document généré et signé via Juliette ; toute modification du texte change cette empreinte.
          </p>
        )}
      </>
    ),
  });
  return res;
}

/** Répartit les unités sur des pages A4 d'après leurs hauteurs mesurées. */
function paginer(hauteurs: number[], colle: boolean[]) {
  const pages: number[][] = [[]];
  let occupe = 0;
  hauteurs.forEach((h, i) => {
    const besoin = h + (colle[i] && i + 1 < hauteurs.length ? hauteurs[i + 1] : 0);
    if (occupe > 0 && occupe + besoin > HAUTEUR_UTILE) {
      pages.push([]);
      occupe = 0;
    }
    pages[pages.length - 1].push(i);
    occupe += h;
  });
  return pages;
}

function PiedDePage({ n, total, paraphe, initiales, salarieSigne }: { n: number; total: number; paraphe: boolean; initiales: { employeur?: string; salarie?: string }; salarieSigne: boolean }) {
  return (
    <footer className="contrat-pied">
      <span>
        Page {n} / {total}
      </span>
      {paraphe && (
        <span className="contrat-pied-paraphes">
          Initiales employeur <i>{initiales.employeur}</i>
          {salarieSigne && (
            <>
              {" "}
              Initiales salarié <i>{initiales.salarie}</i>
            </>
          )}
        </span>
      )}
    </footer>
  );
}

// Contrat : à l'écran, un document continu ; à l'impression, des pages A4 découpées par Juliette,
// chacune avec son pied de page (numéro et cases de paraphe), quel que soit le navigateur.
export default function DocumentContrat({
  texte,
  employeur,
  salarie,
  sig,
  paraphe = true,
  feminin = false,
  signataires,
  roleSalarie = "",
  mentionSalarie = "Lu et approuvé",
}: {
  texte: string;
  employeur: string;
  salarie: string;
  sig?: SignaturesContrat;
  paraphe?: boolean;
  feminin?: boolean;
  /** Noms des signataires, pour reporter leurs initiales sur chaque page une fois signé. */
  signataires?: { employeur: string; salarie: string };
  /** Libellé du bloc salarié ; null = seul l'employeur signe (certificat, attestation…). */
  roleSalarie?: string | null;
  mentionSalarie?: string;
}) {
  // Signature électronique : les initiales du signataire sont reportées sur chaque page.
  const initiales = {
    employeur: sig?.signature_employeur && signataires ? initialesDe(signataires.employeur) : undefined,
    salarie: sig?.signature_salarie && signataires ? initialesDe(signataires.salarie) : undefined,
  };
  const liste = useMemo(() => unites(texte, employeur, salarie, sig, feminin, { roleSalarie, mentionSalarie }), [texte, employeur, salarie, sig, feminin, roleSalarie, mentionSalarie]);
  const mesure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][] | null>(null);

  useLayoutEffect(() => {
    let vivant = true;
    const calculer = () => {
      const noeuds = mesure.current ? [...mesure.current.children] : [];
      if (!vivant || noeuds.length !== liste.length) return;
      setPages(paginer(noeuds.map((n) => (n as HTMLElement).offsetHeight), liste.map((u) => !!u.colle)));
    };
    document.fonts.ready.then(calculer);
    return () => {
      vivant = false;
    };
  }, [liste]);

  return (
    <>
      <article className="contrat-doc">
        {liste.map((u) => (
          <Fragment key={u.cle}>{u.contenu}</Fragment>
        ))}
        {paraphe && (
          <div className="contrat-paraphe" aria-hidden>
            {initiales.employeur || initiales.salarie
              ? `Initiales reportées sur chaque page : employeur ${initiales.employeur ?? "—"} · salarié ${initiales.salarie ?? "—"}`
              : "À l'impression, chaque page porte les cases d'initiales de l'employeur et du salarié."}
          </div>
        )}
      </article>

      {/* Version imprimée : mesure hors écran, puis pages A4. */}
      <div className="contrat-imprime" aria-hidden>
        <div ref={mesure} className="contrat-doc contrat-feuille contrat-mesure">
          {liste.map((u) => (
            <div key={u.cle} className="contrat-unite">
              {u.contenu}
            </div>
          ))}
        </div>
        {pages?.map((p, n) => (
          <section key={n} className="contrat-page">
            <div className="contrat-doc contrat-feuille">
              {p.map((i) => (
                <div key={liste[i].cle} className="contrat-unite">
                  {liste[i].contenu}
                </div>
              ))}
            </div>
            <PiedDePage n={n + 1} total={pages.length} paraphe={paraphe} initiales={initiales} salarieSigne={roleSalarie !== null} />
          </section>
        ))}
      </div>
    </>
  );
}

/** Imprime uniquement le contrat (A4 portrait), quelle que soit la page autour, sous son nom. */
export function imprimerContrat(nomFichier?: string) {
  // Le titre de la page devient le nom proposé pour le PDF (« Enregistrer au format PDF »).
  const titre = document.title;
  if (nomFichier) document.title = nomFichier;
  document.body.classList.add("imprime-contrat");
  const fin = () => {
    document.title = titre;
    document.body.classList.remove("imprime-contrat");
    window.removeEventListener("afterprint", fin);
  };
  window.addEventListener("afterprint", fin);
  window.print();
}
