import type { Metadata } from "next";
import Link from "next/link";
import PageLegale, { Info, Section } from "@/components/PageLegale";
import { EDITEUR as E, HEBERGEURS } from "@/lib/editeur";

export const metadata: Metadata = { title: "Mentions légales · Juliette" };

const S = [
  { id: "editeur", titre: "Éditeur du site" },
  { id: "hebergement", titre: "Hébergement" },
  { id: "propriete", titre: "Propriété intellectuelle" },
  { id: "donnees", titre: "Données personnelles et cookies" },
  { id: "responsabilite", titre: "Responsabilité" },
  { id: "droit", titre: "Droit applicable" },
];

export default function MentionsLegales() {
  return (
    <PageLegale titre="Mentions légales" sommaire={S} intro={<p>Informations prévues par l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique.</p>}>
      <Section id="editeur" titre="1. Éditeur du site">
        <dl className="legal-fiche">
          <dt>Éditeur</dt>
          <dd><Info v={E.denomination} quoi="Dénomination ou nom" /></dd>
          <dt>Forme juridique</dt>
          <dd>
            <Info v={E.formeJuridique} quoi="Forme juridique" />
            {E.capital && <>, au capital de {E.capital}</>}
          </dd>
          <dt>Siège</dt>
          <dd><Info v={E.adresse} quoi="Adresse du siège" /></dd>
          <dt>Immatriculation</dt>
          <dd><Info v={E.immatriculation} quoi="SIREN ou RCS" /></dd>
          <dt>TVA intracommunautaire</dt>
          <dd><Info v={E.numeroTva} quoi="Numéro de TVA" /></dd>
          <dt>Directeur de la publication</dt>
          <dd><Info v={E.directeurPublication} quoi="Nom du directeur de la publication" /></dd>
          <dt>Contact</dt>
          <dd>
            <Info v={E.email} quoi="Adresse e-mail" />
            {E.telephone && <> · {E.telephone}</>}
          </dd>
        </dl>
      </Section>

      <Section id="hebergement" titre="2. Hébergement">
        <p>
          <b>Application et site :</b> {HEBERGEURS.site.nom}, {HEBERGEURS.site.adresse} ({HEBERGEURS.site.site}) ; {HEBERGEURS.site.lieu}.
        </p>
        <p>
          <b>Données :</b> {HEBERGEURS.donnees.nom}, {HEBERGEURS.donnees.adresse} ({HEBERGEURS.donnees.site}) ; {HEBERGEURS.donnees.lieu}.
        </p>
      </Section>

      <Section id="propriete" titre="3. Propriété intellectuelle">
        <p>
          Le site et l&apos;application Juliette, leur code, leur structure, leurs textes, leurs modèles de documents, leur logo et leurs éléments graphiques sont protégés par le droit d&apos;auteur et le droit des marques. Toute reproduction, représentation ou
          adaptation, totale ou partielle, sans autorisation écrite de l&apos;éditeur est interdite, sous réserve des droits d&apos;usage accordés aux clients par les{" "}
          <Link href="/conditions">conditions générales d&apos;abonnement</Link>.
        </p>
        <p>Les données et documents saisis par les clients dans Juliette restent leur propriété.</p>
      </Section>

      <Section id="donnees" titre="4. Données personnelles et cookies">
        <p>
          Le traitement des données personnelles est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>. Pour les données que les restaurants enregistrent sur leurs salariés et leurs clients, Juliette agit comme
          sous-traitant, dans les conditions de l&apos;<Link href="/sous-traitance">accord de sous-traitance</Link>.
        </p>
        <p>
          Juliette n&apos;utilise aucun cookie publicitaire ni outil de mesure d&apos;audience. Le seul stockage sur l&apos;appareil sert à maintenir la connexion et à retenir des préférences d&apos;affichage ; il est strictement nécessaire au
          service et ne demande donc pas de consentement.
        </p>
      </Section>

      <Section id="responsabilite" titre="5. Responsabilité">
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des informations publiées sur le site. Les modèles de contrats, de documents RH et d&apos;enregistrements HACCP proposés dans l&apos;application sont des aides à la rédaction : ils
          ne remplacent pas un conseil juridique, social ou sanitaire adapté à la situation de chaque établissement.
        </p>
        <p>Les liens vers des sites tiers (administrations, banques, éditeurs de logiciels) sont fournis pour information ; l&apos;éditeur n&apos;est pas responsable de leur contenu.</p>
      </Section>

      <Section id="droit" titre="6. Droit applicable">
        <p>Les présentes mentions sont soumises au droit français.</p>
      </Section>
    </PageLegale>
  );
}
