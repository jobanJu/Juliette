"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";

const FAMILLES = [
  {
    icone: "◷",
    titre: "Équipe",
    ton: "t-lav",
    points: ["Pointeuse sur tablette avec code à 6 chiffres", "Planning de la semaine, jour par jour sur mobile", "Congés et acomptes, validation en un clic", "Fiches du personnel, contrats et invitations", "Messagerie d'équipe en direct"],
  },
  {
    icone: "❄",
    titre: "HACCP",
    ton: "t-blue",
    points: ["Relevés de température matin et soir", "Plan de nettoyage à cocher", "Refroidissements chronométrés", "Étiquettes DLC imprimables", "Registre infalsifiable, prêt pour un contrôle"],
  },
  {
    icone: "▤",
    titre: "Stock & achats",
    ton: "t-peach",
    points: ["Stock calculé en continu", "Inventaire par zone, sur téléphone", "Pertes chiffrées en euros", "Commandes fournisseurs envoyées par e-mail", "Réception contrôlée et réclamations"],
  },
  {
    icone: "◫",
    titre: "Salle",
    ton: "t-mint",
    points: ["Prise de commande à la table", "Écran cuisine en temps réel", "À emporter et livraison (Uber Eats, Deliveroo…)", "Réservations avec tables libres", "Briefing du service"],
  },
  {
    icone: "❏",
    titre: "Cuisine",
    ton: "t-yellow",
    points: ["Fiches techniques reliées au stock", "Coût matière au tarif fournisseur, en direct", "Calculateur « avec ce qu'il me reste »", "Allergènes suggérés automatiquement", "Chaque vente décompte les ingrédients"],
  },
  {
    icone: "€",
    titre: "Pilotage",
    ton: "t-red",
    points: ["Chiffre d'affaires, marge et ratios", "Prévision ajustée par les événements", "Calendrier : concerts, matchs, jours fériés", "Accès par niveau : directeur, responsable, salarié", "Documentation et échéances"],
  },
];

export default function Accueil() {
  const { etat } = useSession();
  const connecte = etat.statut === "connecte";

  return (
    <div className="accueil">
      <header className="acc-haut">
        <span className="brand">
          <span className="brand-mark">J</span>Juliette
        </span>
        <nav className="acc-nav">
          <Link href="/borne" className="btn">
            ◷ Pointeuse
          </Link>
          <Link href={connecte ? "/dashboard" : "/login"} className="btn btn-primary">
            {connecte ? "Ouvrir Juliette" : "Se connecter"}
          </Link>
        </nav>
      </header>

      <section className="acc-hero">
        <p className="eyebrow">Le logiciel de gestion des restaurants</p>
        <h1>Le quotidien du restaurant, enfin réuni.</h1>
        <p className="acc-intro">
          Équipe, hygiène, stock, salle et chiffres au même endroit, sur ordinateur, tablette et téléphone. Moins de papiers et de tableurs, plus de temps pour les clients.
        </p>
        <div className="acc-cta">
          <Link href={connecte ? "/dashboard" : "/login"} className="btn btn-primary acc-gros">
            {connecte ? "Ouvrir Juliette →" : "Se connecter →"}
          </Link>
          <Link href="/borne" className="btn acc-gros">
            ◷ Ouvrir la pointeuse
          </Link>
        </div>
        <p className="hint">
          Première connexion ?{" "}
          <Link href="/activer" style={{ color: "var(--purple-ink)", fontWeight: 600 }}>
            Active ton compte
          </Link>{" "}
          avec le code de ton établissement.
        </p>
      </section>

      <section className="acc-section">
        <h2>Tout ce qu&apos;il faut pour faire tourner un restaurant</h2>
        <div className="acc-familles">
          {FAMILLES.map((f) => (
            <article key={f.titre} className="card acc-famille">
              <span className={`chip-ic ${f.ton}`}>{f.icone}</span>
              <h3>{f.titre}</h3>
              <ul>
                {f.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="acc-section acc-etapes">
        <h2>Comment ça marche</h2>
        <div className="acc-trois">
          <div>
            <b>1</b>
            <h3>Le directeur ouvre l&apos;établissement</h3>
            <p>Il reçoit un code d&apos;établissement, déclare sa carte, ses fournisseurs et ses produits.</p>
          </div>
          <div>
            <b>2</b>
            <h3>L&apos;équipe rejoint Juliette</h3>
            <p>Chacun active son compte avec le code et son e-mail. Les droits suivent la hiérarchie : directeur, responsable, salarié.</p>
          </div>
          <div>
            <b>3</b>
            <h3>Tout le monde au même endroit</h3>
            <p>Planning et messages sur le téléphone, pointeuse sur la tablette de l&apos;entrée, commandes en salle, chiffres pour la direction.</p>
          </div>
        </div>
      </section>

      <section className="acc-section">
        <div className="acc-atouts">
          <div className="card">
            <h3>⚡ En temps réel</h3>
            <p>Les bons arrivent en cuisine, les messages s&apos;affichent et le stock se met à jour sans recharger.</p>
          </div>
          <div className="card">
            <h3>🔒 Des données protégées</h3>
            <p>Chaque établissement ne voit que ses données, les accès suivent la hiérarchie, et pointages et relevés HACCP sont horodatés par le serveur.</p>
          </div>
          <div className="card">
            <h3>📱 Pensé pour le téléphone</h3>
            <p>Tout se fait aussi sur mobile : pointer, poser un congé, compter l&apos;inventaire, prendre une commande.</p>
          </div>
          <div className="card">
            <h3>🏢 Plusieurs établissements</h3>
            <p>Un seul compte pour passer d&apos;un restaurant à l&apos;autre, avec un rôle propre dans chacun.</p>
          </div>
        </div>
      </section>

      <section className="acc-section">
        <div className="card acc-bientot">
          <span className="pill t-lav">Bientôt</span>
          <h2>Encaissement par carte bancaire</h2>
          <p>
            Juliette encaissera directement les tables et les commandes à emporter par carte, avec <b>SumUp</b> ou <b>Mollie</b> : le montant part sur le terminal de paiement posé au comptoir, et la table se clôt toute seule une fois le paiement accepté. Le paiement sans contact sur téléphone (Tap to Pay) viendra avec l&apos;application mobile.
          </p>
        </div>
      </section>

      <footer className="acc-pied">
        <span className="brand" style={{ fontSize: 16 }}>
          <span className="brand-mark" style={{ width: 26, height: 26, fontSize: 18 }}>
            J
          </span>
          Juliette
        </span>
        <span className="hint">© {new Date().getFullYear()} Juliette · Fait pour les restaurants</span>
      </footer>
    </div>
  );
}
