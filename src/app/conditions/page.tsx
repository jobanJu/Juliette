import type { Metadata } from "next";
import Link from "next/link";
import PageLegale, { Info, Section } from "@/components/PageLegale";
import { EDITEUR as E } from "@/lib/editeur";

export const metadata: Metadata = { title: "Conditions générales d'abonnement · Juliette" };

const S = [
  { id: "objet", titre: "Objet et champ d'application" },
  { id: "definitions", titre: "Définitions" },
  { id: "souscription", titre: "Souscription et essai gratuit" },
  { id: "service", titre: "Description du service" },
  { id: "prix", titre: "Prix, facturation et paiement" },
  { id: "duree", titre: "Durée et résiliation" },
  { id: "obligations", titre: "Obligations du client" },
  { id: "documents", titre: "Modèles de documents et conformité" },
  { id: "disponibilite", titre: "Disponibilité et assistance" },
  { id: "donnees", titre: "Données du client" },
  { id: "rgpd", titre: "Protection des données personnelles" },
  { id: "responsabilite", titre: "Responsabilité" },
  { id: "propriete", titre: "Propriété intellectuelle" },
  { id: "confidentialite", titre: "Confidentialité" },
  { id: "force-majeure", titre: "Force majeure" },
  { id: "modification", titre: "Modification des conditions" },
  { id: "droit", titre: "Droit applicable et litiges" },
];

export default function Conditions() {
  return (
    <PageLegale
      titre="Conditions générales d'abonnement"
      sommaire={S}
      intro={
        <p>
          Ces conditions régissent l&apos;abonnement au service Juliette entre <Info v={E.denomination} quoi="Dénomination de l'éditeur" /> (« l&apos;Éditeur ») et le professionnel qui y souscrit (« le Client »). Elles sont acceptées lors de la
          souscription, en cochant la case prévue à cet effet.
        </p>
      }
    >
      <Section id="objet" titre="1. Objet et champ d'application">
        <p>
          Les présentes conditions définissent les modalités d&apos;accès et d&apos;utilisation de Juliette, logiciel en ligne de gestion des établissements de restauration, fourni sous forme d&apos;abonnement. Elles prévalent sur tout autre
          document du Client, notamment ses conditions générales d&apos;achat.
        </p>
        <p>
          Juliette est destiné exclusivement aux professionnels agissant pour les besoins de leur activité (restaurants, bars, cafés, traiteurs et établissements assimilés), établis en France ou en Belgique. Le Client déclare souscrire en
          qualité de professionnel ; les dispositions du Code de la consommation relatives au droit de rétractation ne s&apos;appliquent pas.
        </p>
      </Section>

      <Section id="definitions" titre="2. Définitions">
        <ul>
          <li><b>Service</b> : l&apos;application Juliette, accessible en ligne, et l&apos;ensemble de ses modules.</li>
          <li><b>Établissement</b> : un point de vente du Client, identifié dans Juliette par un code d&apos;établissement.</li>
          <li><b>Utilisateurs</b> : les personnes auxquelles le Client ouvre un accès (direction, responsables, salariés).</li>
          <li><b>Données du Client</b> : toutes les informations et tous les fichiers saisis ou importés dans le Service par le Client ou ses Utilisateurs.</li>
        </ul>
      </Section>

      <Section id="souscription" titre="3. Souscription et essai gratuit">
        <p>
          La souscription s&apos;effectue en ligne. Le Client renseigne son établissement et le compte de son directeur, accepte les présentes conditions, puis enregistre un moyen de paiement auprès de Stripe, prestataire de paiement de
          l&apos;Éditeur. L&apos;Établissement est ouvert automatiquement dès la validation du moyen de paiement.
        </p>
        <p>
          Lorsqu&apos;une période d&apos;essai est proposée, sa durée est indiquée avant la souscription. Aucun montant n&apos;est prélevé pendant l&apos;essai. À son terme, l&apos;abonnement payant démarre automatiquement, sauf résiliation
          effectuée avant la fin de l&apos;essai. Un seul essai est accordé par Client.
        </p>
        <p>Le Client garantit l&apos;exactitude des informations fournies, notamment ses informations de facturation et son numéro de TVA.</p>
      </Section>

      <Section id="service" titre="4. Description du service">
        <p>
          Le Service comprend, selon les modules activés par le Client : la gestion du personnel (pointage, planning, congés, contrats et documents RH), le suivi HACCP, la gestion des stocks, des pertes, des commandes fournisseurs et des
          réceptions, la prise de commande en salle et les réservations, les fiches techniques, le suivi financier et les outils associés. Le détail des fonctionnalités est présenté sur le site et dans le <Link href="/aide">centre d&apos;aide</Link>.
        </p>
        <p>
          L&apos;Éditeur fait évoluer le Service en continu. Il peut ajouter, modifier ou retirer des fonctionnalités, à condition de ne pas réduire de manière substantielle les fonctions essentielles pour lesquelles le Client a souscrit.
        </p>
        <p>
          Les connexions à des services tiers (logiciel de caisse, prestataire d&apos;e-mail, grossistes) dépendent de ces tiers. L&apos;Éditeur ne garantit pas leur disponibilité ni le maintien de leurs interfaces.
        </p>
      </Section>

      <Section id="prix" titre="5. Prix, facturation et paiement">
        <p>
          Le prix de l&apos;abonnement est celui affiché au moment de la souscription. Il est exprimé hors taxes et s&apos;entend par Établissement et par période de facturation. La TVA au taux en vigueur s&apos;y ajoute. Pour un Client
          établi dans un autre État membre de l&apos;Union européenne et disposant d&apos;un numéro de TVA valide, la facture est émise hors taxe, la TVA étant autoliquidée par le Client.
        </p>
        <p>
          L&apos;abonnement est payable d&apos;avance, au début de chaque période, par prélèvement automatique sur le moyen de paiement enregistré. Les factures sont disponibles à tout moment dans Paramètres › Abonnement.
        </p>
        <p>
          En cas de défaut de paiement, Stripe procède à de nouvelles tentatives et le Client en est informé. Si le paiement n&apos;est pas régularisé, l&apos;accès à l&apos;Établissement est suspendu jusqu&apos;au règlement, sans que cette
          suspension n&apos;entraîne la suppression des Données du Client. Conformément à l&apos;article L. 441-10 du Code de commerce, toute somme impayée à l&apos;échéance porte de plein droit intérêt au taux appliqué par la Banque centrale
          européenne à son opération de refinancement la plus récente, majoré de dix points, ainsi qu&apos;une indemnité forfaitaire pour frais de recouvrement de 40 €.
        </p>
        <p>
          L&apos;Éditeur peut faire évoluer ses prix. Toute hausse est notifiée au Client au moins trente jours avant son application ; le Client qui la refuse peut résilier avant son entrée en vigueur.
        </p>
      </Section>

      <Section id="duree" titre="6. Durée et résiliation">
        <p>
          L&apos;abonnement est conclu sans engagement de durée. Il se renouvelle automatiquement à chaque période. Le Client peut le résilier à tout moment depuis Paramètres › Abonnement ; la résiliation prend effet à la fin de la période en
          cours, déjà payée, sans remboursement au prorata.
        </p>
        <p>
          En cas de manquement grave de l&apos;une des parties à ses obligations, non réparé dans les quinze jours suivant une mise en demeure, l&apos;autre partie peut résilier l&apos;abonnement de plein droit. L&apos;Éditeur peut suspendre
          immédiatement l&apos;accès en cas d&apos;usage frauduleux, illicite ou mettant en danger la sécurité du Service.
        </p>
      </Section>

      <Section id="obligations" titre="7. Obligations du client">
        <ul>
          <li>Utiliser le Service conformément à sa destination, aux présentes conditions et à la réglementation applicable.</li>
          <li>Garder confidentiels les identifiants de ses Utilisateurs et attribuer à chacun un niveau d&apos;accès adapté ; le Client est responsable des actions réalisées avec les comptes qu&apos;il a ouverts.</li>
          <li>
            Informer ses salariés des traitements de données mis en œuvre à leur sujet (pointage, planning, contrats, messagerie), consulter le cas échéant ses instances représentatives du personnel, et ne saisir que les données nécessaires.
          </li>
          <li>Ne pas tenter d&apos;accéder aux données d&apos;un autre client, de contourner les mesures de sécurité ou de perturber le fonctionnement du Service.</li>
          <li>Conserver, le cas échéant, ses propres copies des documents qu&apos;il est légalement tenu de conserver.</li>
        </ul>
      </Section>

      <Section id="documents" titre="8. Modèles de documents et conformité">
        <p>
          Juliette propose des modèles de contrats de travail, d&apos;avenants, de documents RH, de plans de nettoyage et d&apos;enregistrements HACCP, ainsi que des alertes (amplitude horaire, dates limites, températures). Ces outils sont des
          aides : ils sont établis avec soin à partir des textes en vigueur, mais ne constituent pas un conseil juridique, social ou sanitaire.
        </p>
        <p>
          Le Client, en sa qualité d&apos;employeur et d&apos;exploitant, reste seul responsable du contenu des documents qu&apos;il émet, de leur adaptation à sa convention collective et à sa situation, et du respect de ses obligations en
          matière de droit du travail, d&apos;hygiène et de sécurité alimentaire. Il lui appartient de faire vérifier ses documents par un professionnel en cas de doute.
        </p>
      </Section>

      <Section id="disponibilite" titre="9. Disponibilité et assistance">
        <p>
          L&apos;Éditeur met en œuvre les moyens raisonnables pour que le Service soit accessible en permanence, sous réserve des opérations de maintenance, si possible réalisées en dehors des heures de service, et des interruptions
          imputables aux hébergeurs, aux réseaux ou à des tiers. Il s&apos;agit d&apos;une obligation de moyens.
        </p>
        <p>L&apos;assistance est assurée par écrit, à l&apos;adresse <Info v={E.email} quoi="e-mail de contact" />, les jours ouvrés.</p>
      </Section>

      <Section id="donnees" titre="10. Données du client">
        <p>
          Les Données du Client restent sa propriété. L&apos;Éditeur ne les utilise que pour fournir le Service et ne les cède à aucun tiers. Le Client peut exporter ses principales données (registre HACCP, pointages, listes) à tout moment.
        </p>
        <p>
          À la fin de l&apos;abonnement, le Client peut demander, dans un délai de trente jours, la restitution de ses Données dans un format courant. Passé ce délai, elles sont supprimées dans un délai maximal de quatre-vingt-dix jours, à
          l&apos;exception de celles que l&apos;Éditeur doit conserver en vertu d&apos;une obligation légale (notamment les éléments de facturation).
        </p>
      </Section>

      <Section id="rgpd" titre="11. Protection des données personnelles">
        <p>
          Pour les données personnelles que le Client enregistre dans le Service (salariés, clients du restaurant, fournisseurs), le Client est responsable de traitement et l&apos;Éditeur agit comme sous-traitant au sens de l&apos;article 28
          du règlement (UE) 2016/679. L&apos;<Link href="/sous-traitance">accord de sous-traitance</Link>, qui fait partie intégrante des présentes conditions, précise leurs obligations respectives.
        </p>
        <p>
          Pour les données relatives au Client lui-même et à la gestion de son abonnement, l&apos;Éditeur est responsable de traitement ; ces traitements sont décrits dans la <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </Section>

      <Section id="responsabilite" titre="12. Responsabilité">
        <p>
          L&apos;Éditeur est responsable des dommages directs et prévisibles causés au Client par un manquement prouvé à ses obligations. Il n&apos;est pas responsable des dommages indirects, tels que la perte de chiffre d&apos;affaires, de
          clientèle ou d&apos;image, ni des conséquences d&apos;une saisie erronée, d&apos;un usage non conforme ou d&apos;une défaillance d&apos;un service tiers.
        </p>
        <p>
          Sauf faute lourde ou dolosive, et sauf dommage corporel, la responsabilité totale de l&apos;Éditeur, toutes causes confondues, est limitée au montant payé par le Client au titre de l&apos;abonnement au cours des douze mois précédant
          le fait générateur.
        </p>
      </Section>

      <Section id="propriete" titre="13. Propriété intellectuelle">
        <p>
          L&apos;Éditeur est titulaire de l&apos;ensemble des droits sur le Service. Il concède au Client, pour la durée de l&apos;abonnement, un droit personnel, non exclusif et non transférable d&apos;utiliser le Service pour les besoins de
          ses Établissements. Les documents produits par le Client à partir des modèles de Juliette peuvent être librement utilisés par lui pour son activité.
        </p>
      </Section>

      <Section id="confidentialite" titre="14. Confidentialité">
        <p>
          Chaque partie garde confidentielles les informations non publiques de l&apos;autre dont elle a connaissance à l&apos;occasion de l&apos;abonnement, pendant sa durée et deux ans après sa fin. Cette obligation ne s&apos;applique pas
          aux informations dont la divulgation est exigée par la loi ou une autorité.
        </p>
      </Section>

      <Section id="force-majeure" titre="15. Force majeure">
        <p>
          Aucune partie n&apos;est responsable d&apos;un manquement résultant d&apos;un cas de force majeure au sens de l&apos;article 1218 du Code civil. Si l&apos;empêchement dure plus de trente jours, chaque partie peut résilier
          l&apos;abonnement sans indemnité.
        </p>
      </Section>

      <Section id="modification" titre="16. Modification des conditions">
        <p>
          L&apos;Éditeur peut modifier les présentes conditions. Les nouvelles conditions sont notifiées au Client au moins trente jours avant leur entrée en vigueur ; le Client qui les refuse peut résilier son abonnement avant cette date.
          À défaut, elles s&apos;appliquent à la période suivante.
        </p>
      </Section>

      <Section id="droit" titre="17. Droit applicable et litiges">
        <p>
          Les présentes conditions sont soumises au droit français. En cas de différend, les parties recherchent d&apos;abord une solution amiable. À défaut, le litige est porté devant les juridictions compétentes du ressort de{" "}
          <Info v={E.tribunal} quoi="Ville du siège" />, y compris en cas de pluralité de défendeurs ou d&apos;appel en garantie.
        </p>
      </Section>
    </PageLegale>
  );
}
