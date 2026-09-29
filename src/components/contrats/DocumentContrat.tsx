"use client";

import { Fragment } from "react";
import { blocs } from "@/lib/contrats";

export type SignaturesContrat = {
  signature_employeur: string | null;
  signe_employeur_at: string | null;
  signature_salarie: string | null;
  signe_salarie_at: string | null;
  empreinte: string | null;
};

const horodatage = (at: string) => new Date(at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Paragraphe avec **gras** en ligne. */
function Para({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*)/g);
  return <p>{morceaux.map((m, i) => (m.startsWith("**") ? <b key={i}>{m.slice(2, -2)}</b> : <Fragment key={i}>{m}</Fragment>))}</p>;
}

// Rendu du contrat (écran et impression A4), avec le bloc de signatures et la preuve d'intégrité.
export default function DocumentContrat({ texte, employeur, salarie, sig }: { texte: string; employeur: string; salarie: string; sig?: SignaturesContrat }) {
  return (
    <article className="contrat-doc">
      {blocs(texte).map((b, i) =>
        b.type === "titre" ? <h1 key={i}>{b.texte}</h1> : b.type === "article" ? <h2 key={i}>{b.texte}</h2> : <Para key={i} texte={b.texte} />,
      )}
      <div className="contrat-signatures">
        <div>
          <small>L&apos;employeur</small>
          <b>{employeur}</b>
          {sig?.signature_employeur ? (
            <>
              <img src={sig.signature_employeur} alt="Signature de l'employeur" />
              <small>Signé électroniquement le {horodatage(sig.signe_employeur_at!)}</small>
            </>
          ) : (
            <span className="contrat-sig-vide" />
          )}
        </div>
        <div>
          <small>Le salarié</small>
          <b>{salarie}</b>
          {sig?.signature_salarie ? (
            <>
              <img src={sig.signature_salarie} alt="Signature du salarié" />
              <small>Signé électroniquement le {horodatage(sig.signe_salarie_at!)}</small>
            </>
          ) : (
            <span className="contrat-sig-vide" />
          )}
        </div>
      </div>
      {sig?.empreinte && (
        <p className="contrat-preuve">
          Empreinte SHA-256 du texte signé : <code>{sig.empreinte}</code>. Document généré et signé via Juliette ; toute modification du texte change cette empreinte.
        </p>
      )}
    </article>
  );
}
