import type { Metadata } from "next";
import Link from "next/link";
import PageLegale, { Info, Section } from "@/components/PageLegale";
import { EDITEUR as E, SOUS_TRAITANTS } from "@/lib/editeur";

export const metadata: Metadata = { title: "Accord de sous-traitance des données · Juliette" };

const S = [
  { id: "objet", titre: "Objet" },
  { id: "description", titre: "Description des traitements" },
  { id: "instructions", titre: "Instructions du responsable de traitement" },
  { id: "confidentialite", titre: "Confidentialité" },
  { id: "securite", titre: "Sécurité des données" },
  { id: "sous-traitants", titre: "Sous-traitants ultérieurs" },
  { id: "droits", titre: "Droits des personnes" },
  { id: "violations", titre: "Violations de données" },
  { id: "assistance", titre: "Analyses d'impact et assistance" },
  { id: "fin", titre: "Sort des données en fin de contrat" },
  { id: "audit", titre: "Documentation et audits" },
  { id: "client", titre: "Obligations du client" },
];

export default function SousTraitance() {
  return (
    <PageLegale
      titre="Accord de sous-traitance des données"
      sommaire={S}
      intro={
        <p>
          Cet accord, conclu en application de l&apos;article 28 du règlement (UE) 2016/679 (RGPD), fait partie intégrante des <Link href="/conditions">conditions générales d&apos;abonnement</Link>. Il lie le Client, responsable de
          traitement, et <Info v={E.denomination} quoi="Dénomination de l'éditeur" /> (« Juliette »), sous-traitant, pour toute la durée de l&apos;abonnement.
        </p>
      }
    >
      <Section id="objet" titre="1. Objet">
        <p>
          Juliette traite, pour le compte du Client, les données personnelles que le Client et ses utilisateurs enregistrent dans le Service. Le présent accord définit les conditions dans lesquelles Juliette effectue ces traitements.
        </p>
      </Section>

      <Section id="description" titre="2. Description des traitements">
        <dl className="legal-fiche">
          <dt>Nature</dt>
          <dd>Hébergement, enregistrement, consultation, organisation, mise à jour, calculs, envoi par e-mail, export et suppression de données, au moyen de l&apos;application Juliette.</dd>
          <dt>Finalités</dt>
          <dd>
            Gestion du personnel (planning, pointage, congés, contrats et documents RH, messagerie interne), hygiène et traçabilité alimentaire, stocks et achats, service en salle et réservations, pilotage de l&apos;activité.
          </dd>
          <dt>Durée</dt>
          <dd>Durée de l&apos;abonnement, augmentée du délai de restitution et de suppression prévu à l&apos;article 10.</dd>
          <dt>Personnes concernées</dt>
          <dd>Salariés, extras, stagiaires et dirigeants du Client ; candidats à l&apos;embauche ; clients du restaurant (réservations, commandes à emporter et livraisons) ; contacts des fournisseurs.</dd>
        </dl>
        <h3>Catégories de données</h3>
        <ul>
          <li><b>Identité et coordonnées</b> : nom, prénom, date de naissance, photo, adresse e-mail, téléphone, adresse postale.</li>
          <li><b>Vie professionnelle</b> : poste, fonction, type et nature du contrat, date d&apos;embauche et de départ, durée du travail, rémunération, primes, acomptes, avantages.</li>
          <li><b>Temps de travail</b> : planning, pointages (arrivées, pauses, départs), corrections et justificatifs, congés et absences.</li>
          <li><b>Documents RH</b> : contrats, avenants, fiches de poste, remises de matériel, avertissements, convocations, certificats, attestations, avec leurs signatures électroniques et leur horodatage.</li>
          <li><b>Numéro de sécurité sociale et nationalité</b>, lorsque le Client les fait figurer dans un contrat de travail.</li>
          <li><b>Communications</b> : messages de la messagerie interne et pièces jointes ; e-mails échangés avec les fournisseurs.</li>
          <li><b>Traçabilité</b> : nom des personnes ayant réalisé un relevé HACCP, une réception ou une déclaration de perte.</li>
          <li><b>Clients du restaurant</b> : nom, téléphone, e-mail, adresse de livraison, nombre de couverts et remarques, qui peuvent comporter une allergie ou un régime alimentaire.</li>
        </ul>
        <p>
          Les allergies et régimes alimentaires peuvent constituer des données de santé au sens de l&apos;article 9 du RGPD. Le numéro de sécurité sociale fait l&apos;objet d&apos;un encadrement particulier. Le Client s&apos;engage à ne
          les enregistrer que lorsque c&apos;est nécessaire (service du client en toute sécurité, obligations déclaratives de l&apos;employeur) et dans le respect des règles qui leur sont propres.
        </p>
      </Section>

      <Section id="instructions" titre="3. Instructions du responsable de traitement">
        <p>
          Juliette ne traite les données que sur instruction documentée du Client. Les présentes conditions, le paramétrage du Service et les actions réalisées par le Client dans l&apos;application constituent ces instructions, y compris en
          ce qui concerne les transferts de données. Si Juliette estime qu&apos;une instruction constitue une violation du RGPD ou d&apos;une autre règle relative à la protection des données, elle en informe immédiatement le Client.
        </p>
        <p>Juliette n&apos;utilise les données du Client pour aucune autre finalité, et notamment pas à des fins commerciales ou publicitaires.</p>
      </Section>

      <Section id="confidentialite" titre="4. Confidentialité">
        <p>
          Les personnes autorisées par Juliette à traiter les données sont soumises à une obligation de confidentialité et n&apos;y accèdent que dans la mesure nécessaire à leur mission (assistance demandée par le Client, maintenance,
          sécurité).
        </p>
      </Section>

      <Section id="securite" titre="5. Sécurité des données">
        <p>Juliette met en œuvre les mesures techniques et organisationnelles prévues à l&apos;article 32 du RGPD, notamment :</p>
        <ul>
          <li>chiffrement des échanges (HTTPS) et chiffrement des données au repos chez l&apos;hébergeur ;</li>
          <li>cloisonnement des établissements appliqué par la base de données elle-même (règles d&apos;accès au niveau des lignes) ;</li>
          <li>contrôle des accès par niveau (directeur, responsable, salarié) et par module, défini par le Client ;</li>
          <li>mots de passe conservés sous forme chiffrée irréversible ; secrets de connexion aux logiciels tiers chiffrés en AES-256-GCM ;</li>
          <li>horodatage serveur des pointages et des enregistrements HACCP, et empreinte des documents signés ;</li>
          <li>hébergement des données dans l&apos;Union européenne ;</li>
          <li>accès administratifs restreints, réservés à l&apos;équipe Juliette et vérifiés côté serveur.</li>
        </ul>
      </Section>

      <Section id="sous-traitants" titre="6. Sous-traitants ultérieurs">
        <p>
          Le Client autorise Juliette à recourir aux sous-traitants ultérieurs ci-dessous. Juliette leur impose, par contrat, des obligations de protection des données équivalentes à celles du présent accord et reste responsable de leur
          respect.
        </p>
        <div className="table-wrap">
          <table className="data legal-table">
            <thead>
              <tr>
                <th>Sous-traitant</th>
                <th>Prestation</th>
                <th>Localisation</th>
                <th>Garanties</th>
              </tr>
            </thead>
            <tbody>
              {SOUS_TRAITANTS.map((s) => (
                <tr key={s.nom}>
                  <td>{s.nom}</td>
                  <td>{s.role}</td>
                  <td>{s.lieu}</td>
                  <td>{s.garanties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Juliette informe le Client de tout ajout ou remplacement d&apos;un sous-traitant ultérieur au moins trente jours à l&apos;avance. Le Client peut s&apos;y opposer pour un motif légitime lié à la protection des données ; à défaut
          d&apos;accord, il peut résilier son abonnement sans frais.
        </p>
        <p>
          Lorsque le Client connecte un service tiers de son choix (logiciel de caisse, par exemple), ce service n&apos;est pas un sous-traitant de Juliette : le Client contracte directement avec lui et Juliette n&apos;échange les données
          que sur son instruction.
        </p>
      </Section>

      <Section id="droits" titre="7. Droits des personnes">
        <p>
          Le Client répond aux demandes des personnes concernées (accès, rectification, effacement, limitation, portabilité, opposition). Le Service lui permet de consulter, corriger, exporter et supprimer les données. Juliette
          l&apos;assiste pour les demandes qu&apos;il ne peut pas traiter seul ; si une personne s&apos;adresse directement à Juliette, sa demande est transmise sans délai au Client.
        </p>
      </Section>

      <Section id="violations" titre="8. Violations de données">
        <p>
          Juliette notifie au Client toute violation de données personnelles dans les meilleurs délais et au plus tard quarante-huit heures après en avoir pris connaissance. La notification décrit la nature de la violation, les catégories
          et le nombre approximatif de personnes et d&apos;enregistrements concernés, ses conséquences probables et les mesures prises ou envisagées. Juliette fournit ensuite toute information utile pour permettre au Client de notifier
          l&apos;autorité de contrôle et, le cas échéant, les personnes concernées.
        </p>
      </Section>

      <Section id="assistance" titre="9. Analyses d'impact et assistance">
        <p>
          Juliette fournit au Client, sur demande, les informations nécessaires à la réalisation d&apos;une analyse d&apos;impact relative à la protection des données et, le cas échéant, à la consultation préalable de l&apos;autorité de
          contrôle.
        </p>
      </Section>

      <Section id="fin" titre="10. Sort des données en fin de contrat">
        <p>
          À la fin de l&apos;abonnement, Juliette restitue au Client, à sa demande formulée dans les trente jours, ses données dans un format courant. Elle supprime ensuite toutes les données et leurs copies dans un délai maximal de
          quatre-vingt-dix jours, y compris dans les sauvegardes à l&apos;expiration de leur cycle de rotation, sauf obligation légale de conservation. Elle confirme la suppression par écrit sur demande.
        </p>
      </Section>

      <Section id="audit" titre="11. Documentation et audits">
        <p>
          Juliette met à la disposition du Client la documentation nécessaire pour démontrer le respect de ses obligations. Le Client peut faire réaliser un audit, une fois par an, par lui-même ou par un auditeur indépendant tenu au secret,
          avec un préavis de trente jours et à ses frais. L&apos;audit porte sur les seuls traitements réalisés pour le Client et ne doit pas compromettre la sécurité ni la confidentialité des données des autres clients.
        </p>
      </Section>

      <Section id="client" titre="12. Obligations du client">
        <ul>
          <li>Fournir des instructions conformes au RGPD et disposer d&apos;une base légale pour chaque traitement.</li>
          <li>Informer les personnes concernées, en particulier ses salariés, des traitements réalisés avec Juliette (pointage, planning, contrats, messagerie) et, le cas échéant, consulter ses représentants du personnel.</li>
          <li>Tenir son registre des activités de traitement et limiter les données saisies à ce qui est nécessaire.</li>
          <li>Attribuer les accès avec soin et retirer ceux des personnes qui quittent l&apos;établissement.</li>
        </ul>
        <p>
          Contact de Juliette pour toute question relative au présent accord : <Info v={E.email} quoi="e-mail de contact" />.
        </p>
      </Section>
    </PageLegale>
  );
}
