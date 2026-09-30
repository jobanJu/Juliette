import type { Metadata } from "next";
import Link from "next/link";
import PageLegale, { Info, Section } from "@/components/PageLegale";
import { EDITEUR as E, SOUS_TRAITANTS } from "@/lib/editeur";

export const metadata: Metadata = { title: "Politique de confidentialité · Juliette" };

const S = [
  { id: "roles", titre: "Qui est responsable de quoi" },
  { id: "donnees", titre: "Données que nous traitons" },
  { id: "finalites", titre: "Finalités et bases légales" },
  { id: "durees", titre: "Durées de conservation" },
  { id: "destinataires", titre: "Destinataires et prestataires" },
  { id: "transferts", titre: "Transferts hors de l'Union européenne" },
  { id: "securite", titre: "Sécurité" },
  { id: "stockage", titre: "Cookies et stockage local" },
  { id: "droits", titre: "Vos droits" },
  { id: "contact", titre: "Contact et réclamation" },
];

export default function Confidentialite() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      sommaire={S}
      intro={<p>Cette page explique quelles données personnelles Juliette traite, pourquoi, combien de temps, et comment exercer vos droits, conformément au règlement (UE) 2016/679 (RGPD) et à la loi « Informatique et libertés ».</p>}
    >
      <Section id="roles" titre="1. Qui est responsable de quoi">
        <p>
          <b>Juliette est responsable de traitement</b> pour les données liées à son activité commerciale : visiteurs du site, restaurateurs qui souscrivent, gestion des abonnements, facturation, assistance et sécurité du Service.
          Responsable : <Info v={E.denomination} quoi="Dénomination de l'éditeur" />, <Info v={E.adresse} quoi="Adresse du siège" />.
        </p>
        <p>
          <b>Chaque restaurant est responsable de traitement</b> pour les données qu&apos;il enregistre dans Juliette sur ses salariés, ses clients et ses fournisseurs (planning, pointages, contrats, réservations…). Juliette agit alors
          comme sous-traitant, selon l&apos;<Link href="/sous-traitance">accord de sous-traitance</Link>. Si vous êtes salarié ou client d&apos;un restaurant utilisateur de Juliette, adressez vos demandes à ce restaurant : nous
          l&apos;aiderons à y répondre.
        </p>
      </Section>

      <Section id="donnees" titre="2. Données que nous traitons">
        <ul>
          <li><b>Compte et souscription</b> : prénom, nom, adresse e-mail, mot de passe (conservé uniquement sous forme chiffrée irréversible), nom, ville, pays et code de l&apos;établissement.</li>
          <li>
            <b>Abonnement et facturation</b> : identifiant client et état de l&apos;abonnement, adresse de facturation, numéro de TVA, factures. Les données de carte bancaire sont saisies et conservées par Stripe ; Juliette n&apos;y a jamais
            accès.
          </li>
          <li><b>Échanges</b> : messages adressés à l&apos;assistance et suivi des demandes (par exemple la connexion d&apos;un logiciel de caisse).</li>
          <li><b>Données techniques</b> : journaux de connexion et d&apos;erreurs (date, heure, adresse IP, navigateur), nécessaires à la sécurité et au bon fonctionnement du Service.</li>
        </ul>
        <p>Juliette ne collecte aucune donnée à des fins publicitaires, ne vend aucune donnée et ne pratique aucun profilage.</p>
      </Section>

      <Section id="finalites" titre="3. Finalités et bases légales">
        <div className="table-wrap">
          <table className="data legal-table">
            <thead>
              <tr>
                <th>Finalité</th>
                <th>Base légale</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Créer et gérer le compte, fournir le Service</td><td>Exécution du contrat</td></tr>
              <tr><td>Encaisser l&apos;abonnement, émettre et conserver les factures</td><td>Exécution du contrat ; obligation légale (comptabilité)</td></tr>
              <tr><td>Répondre aux demandes d&apos;assistance</td><td>Exécution du contrat</td></tr>
              <tr><td>Informer des évolutions du Service, des prix et des conditions</td><td>Exécution du contrat ; intérêt légitime</td></tr>
              <tr><td>Assurer la sécurité, prévenir la fraude et les accès non autorisés</td><td>Intérêt légitime</td></tr>
              <tr><td>Répondre aux demandes des autorités</td><td>Obligation légale</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="durees" titre="4. Durées de conservation">
        <ul>
          <li><b>Compte et données de l&apos;établissement</b> : pendant toute la durée de l&apos;abonnement, puis supprimés au plus tard quatre-vingt-dix jours après sa fin (délai de restitution compris).</li>
          <li><b>Inscription non finalisée</b> (paiement non effectué) : trente jours, puis suppression.</li>
          <li><b>Factures et pièces comptables</b> : dix ans, comme l&apos;exige l&apos;article L. 123-22 du Code de commerce.</li>
          <li><b>Échanges avec l&apos;assistance</b> : trois ans après le dernier échange.</li>
          <li><b>Journaux techniques et de sécurité</b> : douze mois au plus.</li>
        </ul>
      </Section>

      <Section id="destinataires" titre="5. Destinataires et prestataires">
        <p>
          Les données sont accessibles aux seules personnes de l&apos;équipe Juliette qui en ont besoin pour leur mission (assistance, facturation, sécurité), tenues à la confidentialité. Elles sont hébergées et traitées par les prestataires
          suivants, liés à Juliette par des engagements de protection des données :
        </p>
        <div className="table-wrap">
          <table className="data legal-table">
            <thead>
              <tr>
                <th>Prestataire</th>
                <th>Rôle</th>
                <th>Localisation</th>
              </tr>
            </thead>
            <tbody>
              {SOUS_TRAITANTS.map((s) => (
                <tr key={s.nom}>
                  <td>{s.nom}</td>
                  <td>{s.role}</td>
                  <td>{s.lieu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Lorsque le restaurant connecte son logiciel de caisse (SumUp, Square…), les ventes sont échangées avec cet éditeur, à la demande et pour le compte du restaurant.</p>
      </Section>

      <Section id="transferts" titre="6. Transferts hors de l'Union européenne">
        <p>
          Les données sont stockées dans l&apos;Union européenne (Irlande) et les traitements serveur s&apos;exécutent en France. Certains prestataires étant des sociétés établies hors de l&apos;Union européenne, un accès depuis l&apos;étranger
          reste possible, notamment pour la maintenance. Ces transferts sont encadrés par le cadre de protection des données UE–États-Unis (Data Privacy Framework) lorsque le prestataire y adhère, et à défaut par les clauses contractuelles
          types adoptées par la Commission européenne.
        </p>
      </Section>

      <Section id="securite" titre="7. Sécurité">
        <ul>
          <li>Connexions chiffrées (HTTPS) et données chiffrées au repos chez l&apos;hébergeur.</li>
          <li>Cloisonnement strict entre établissements, contrôlé par la base de données elle-même : un établissement ne peut jamais lire les données d&apos;un autre.</li>
          <li>Accès au sein de l&apos;établissement selon trois niveaux (directeur, responsable, salarié), réglables module par module.</li>
          <li>Mots de passe conservés sous forme chiffrée irréversible ; clés de logiciels de caisse chiffrées (AES-256-GCM).</li>
          <li>Pointages et relevés HACCP horodatés par le serveur, non modifiables après coup depuis l&apos;appareil.</li>
        </ul>
        <p>En cas de violation de données susceptible d&apos;engendrer un risque pour vos droits, Juliette la notifie à l&apos;autorité compétente et, le cas échéant, aux personnes concernées, dans les délais prévus par le RGPD.</p>
      </Section>

      <Section id="stockage" titre="8. Cookies et stockage local">
        <p>
          Juliette n&apos;utilise aucun cookie publicitaire, aucun outil de mesure d&apos;audience et aucun réseau social intégré. Les seules informations enregistrées sur votre appareil servent à maintenir votre connexion et à retenir vos
          préférences d&apos;affichage (disposition du menu, carte de mise en route masquée…). Elles sont strictement nécessaires au Service et ne requièrent donc pas votre consentement, conformément aux recommandations de la CNIL.
        </p>
      </Section>

      <Section id="droits" titre="9. Vos droits">
        <p>Vous disposez des droits suivants sur les données qui vous concernent :</p>
        <ul>
          <li>droit d&apos;accès et de rectification ;</li>
          <li>droit à l&apos;effacement et à la limitation du traitement ;</li>
          <li>droit d&apos;opposition aux traitements fondés sur l&apos;intérêt légitime ;</li>
          <li>droit à la portabilité des données que vous avez fournies ;</li>
          <li>en France, droit de définir des directives relatives au sort de vos données après votre décès.</li>
        </ul>
        <p>
          La plupart des informations du compte se modifient directement dans Paramètres › Mon compte. Pour toute autre demande, écrivez à <Info v={E.email} quoi="e-mail de contact" />. Nous répondons dans un délai d&apos;un mois, qui peut
          être prolongé de deux mois pour une demande complexe ; une preuve d&apos;identité peut être demandée en cas de doute.
        </p>
      </Section>

      <Section id="contact" titre="10. Contact et réclamation">
        <p>
          Contact pour toute question relative à vos données : <Info v={E.email} quoi="e-mail de contact" />.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la Commission nationale de l&apos;informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07,
          cnil.fr, ou, en Belgique, auprès de l&apos;Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles, autoriteprotectiondonnees.be.
        </p>
      </Section>
    </PageLegale>
  );
}
