"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import Marque from "@/components/Marque";
import Icone from "@/components/Icone";
import type { NomIcone } from "@/components/Icone";
import { prixLisible, useTarif } from "@/lib/tarif";

const FAMILLES: { icone: NomIcone; titre: string; ton: string; points: string[] }[] = [
  {
    icone: "equipe",
    titre: "Équipe & RH",
    ton: "t-lav",
    points: [
      "Pointeuse sur tablette, ou pointage depuis le téléphone",
      "Planning de la semaine, coupures et alertes d'amplitude HCR",
      "Congés et acomptes validés en un clic",
      "Contrats CDI, CDD, extra (HCR France, CP 302 Belgique) et avenants signés en ligne",
      "Fiches de poste, remise de matériel, règlement intérieur, certificats",
      "Messagerie d'équipe, groupes et messages privés",
    ],
  },
  {
    icone: "hygiene",
    titre: "HACCP",
    ton: "t-blue",
    points: [
      "Tour des frigos matin et soir, actions correctives",
      "Plan de nettoyage à cocher",
      "Traçabilité par photo des étiquettes (lot, DLC)",
      "Étiquettes DLC calculées, modifiables uniquement à la baisse",
      "Refroidissements, cuissons à cœur, huiles de friture",
      "Registre horodaté, exportable pour un contrôle",
    ],
  },
  {
    icone: "stock",
    titre: "Stock & achats",
    ton: "t-peach",
    points: [
      "Import du catalogue depuis Excel ou l'export du grossiste",
      "Produits classés : frais, surgelé, épicerie sèche, boissons…",
      "Stock calculé en continu, inventaire par zone sur téléphone",
      "Pertes chiffrées en euros",
      "Commandes fournisseurs envoyées par e-mail, réponses dans Juliette",
      "Réception contrôlée, réclamations préparées",
    ],
  },
  {
    icone: "salle",
    titre: "Salle",
    ton: "t-mint",
    points: ["Prise de commande à la table", "Écran cuisine en temps réel", "À emporter et livraison", "Carnet de réservations", "Briefing du service : allergies et demandes"],
  },
  {
    icone: "cuisine",
    titre: "Cuisine",
    ton: "t-yellow",
    points: ["Fiches techniques reliées au stock", "Coût matière au tarif fournisseur, en direct", "Calculateur « avec ce qu'il me reste »", "Allergènes de chaque plat", "Chaque vente décompte les ingrédients"],
  },
  {
    icone: "graphique",
    titre: "Pilotage",
    ton: "t-red",
    points: [
      "Chiffre d'affaires, coût matière, pertes et masse salariale",
      "Ventes importées de la caisse (SumUp, Square…)",
      "Prévision sur 7 jours, ajustée par les événements",
      "Tableau de bord personnalisable",
      "Documentation, échéances et outils externes réunis",
      "Plusieurs établissements, un seul compte",
    ],
  },
];

const ETAPES = [
  { titre: "Tu crées ton établissement", texte: "En ligne, en deux minutes. L'essai gratuit démarre tout de suite, sans prélèvement." },
  { titre: "Tu importes tes produits", texte: "Dépose le fichier Excel de ton grossiste : produits, prix et fournisseurs sont repris et classés." },
  { titre: "Ton équipe te rejoint", texte: "Chacun active son compte avec le code de l'établissement. Les accès suivent la hiérarchie." },
  { titre: "Tu règles le HACCP et la pointeuse", texte: "Frigos, plan de nettoyage, borne de pointage : le guide de l'aide t'accompagne pas à pas." },
];

const INTEGRATIONS = [
  { titre: "Caisses", texte: "SumUp et Square en connexion directe. Zelty, L'Addition, Lightspeed, Tiller et Innovorder sur demande." },
  { titre: "Grossistes", texte: "Import des catalogues Metro, Transgourmet, Promocash, Pomona ou de tout fichier Excel / CSV." },
  { titre: "E-mail", texte: "Bons de commande envoyés aux fournisseurs, réponses reçues dans la boîte mail de l'établissement." },
  { titre: "France et Belgique", texte: "Conventions HCR et restauration rapide, commission paritaire 302, outils URSSAF et ONSS." },
];

export default function Accueil() {
  const { etat } = useSession();
  const connecte = etat.statut === "connecte";
  const tarif = useTarif();
  const prix = tarif ? prixLisible(tarif) : null;
  const essai = tarif?.essaiJours ?? 0;

  return (
    <div className="accueil">
      <header className="acc-haut">
        <Link href="/" className="brand">
          <Marque />Juliette
        </Link>
        <nav className="acc-nav">
          <a href="#fonctionnalites" className="acc-lien hide-sm">
            Fonctionnalités
          </a>
          <a href="#tarif" className="acc-lien hide-sm">
            Tarif
          </a>
          <Link href={connecte ? "/dashboard" : "/login"} className="btn">
            {connecte ? "Ouvrir Juliette" : "Se connecter"}
          </Link>
          {!connecte && (
            <Link href="/souscription" className="btn btn-primary">
              Essayer
            </Link>
          )}
        </nav>
      </header>

      <section className="acc-hero">
        <p className="eyebrow">Le logiciel de gestion des restaurants</p>
        <h1>Le quotidien du restaurant, enfin réuni.</h1>
        <p className="acc-intro">
          Équipe, hygiène, stock, salle et chiffres au même endroit, sur ordinateur, tablette et téléphone. Moins de papiers et de tableurs, plus de temps pour les clients.
        </p>
        <div className="acc-cta">
          {connecte ? (
            <Link href="/dashboard" className="btn btn-primary acc-gros">
              Ouvrir Juliette
            </Link>
          ) : (
            <Link href="/souscription" className="btn btn-primary acc-gros">
              {essai ? `Essayer ${essai} jours gratuitement` : "Créer mon établissement"}
            </Link>
          )}
          <Link href="/borne" className="btn acc-gros">
            <Icone nom="horloge" /> Ouvrir la pointeuse
          </Link>
        </div>
        <p className="hint">
          Tu es salarié ?{" "}
          <Link href="/activer" style={{ color: "var(--purple-ink)", fontWeight: 600 }}>
            Active ton compte
          </Link>{" "}
          avec le code de ton établissement.
        </p>
      </section>

      <section className="acc-section" id="fonctionnalites">
        <h2>Tout ce qu&apos;il faut pour faire tourner un restaurant</h2>
        <div className="acc-familles">
          {FAMILLES.map((f) => (
            <article key={f.titre} className="card acc-famille">
              <span className={`chip-ic ${f.ton}`}>
                <Icone nom={f.icone} taille={20} />
              </span>
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
        <h2>Opérationnel en une heure, sans installateur</h2>
        <ol className="acc-quatre">
          {ETAPES.map((e) => (
            <li key={e.titre}>
              <h3>{e.titre}</h3>
              <p>{e.texte}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="acc-section">
        <h2>Branché sur tes outils</h2>
        <div className="acc-integrations">
          {INTEGRATIONS.map((i) => (
            <div key={i.titre}>
              <h3>{i.titre}</h3>
              <p>{i.texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="acc-section">
        <div className="acc-atouts">
          <div className="card">
            <h3>
              <Icone nom="eclair" /> En temps réel
            </h3>
            <p>Les bons arrivent en cuisine, les messages s&apos;affichent et le stock se met à jour sans recharger.</p>
          </div>
          <div className="card">
            <h3>
              <Icone nom="cadenas" /> Des données protégées
            </h3>
            <p>Chaque établissement ne voit que ses données, les accès suivent la hiérarchie, et pointages et relevés HACCP sont horodatés par le serveur.</p>
          </div>
          <div className="card">
            <h3>
              <Icone nom="mobile" /> Pensé pour le téléphone
            </h3>
            <p>Tout se fait aussi sur mobile : pointer, poser un congé, compter l&apos;inventaire, prendre une commande.</p>
          </div>
          <div className="card">
            <h3>
              <Icone nom="immeuble" /> Plusieurs établissements
            </h3>
            <p>Un seul compte pour passer d&apos;un restaurant à l&apos;autre, avec un rôle propre dans chacun.</p>
          </div>
        </div>
      </section>

      <section className="acc-section" id="tarif">
        <h2>Un tarif, tout compris</h2>
        <div className="card acc-tarif">
          <div className="acc-tarif-prix">
            {prix ? (
              <>
                <b>{prix.montant}</b>
                <span>HT / {prix.periode} et par établissement</span>
              </>
            ) : (
              <span>{tarif ? "Tarif communiqué à l'inscription" : "…"}</span>
            )}
            {essai > 0 && <p className="pill t-mint">{essai} jours d&apos;essai gratuit</p>}
          </div>
          <ul>
            <li>Tous les modules, sans option payante</li>
            <li>Toute l&apos;équipe incluse</li>
            <li>Ordinateur, tablette et téléphone</li>
            <li>Mises à jour et nouveautés comprises</li>
            <li>Sans engagement, résiliable en ligne</li>
          </ul>
          <Link href="/souscription" className="btn btn-primary acc-gros">
            {essai ? "Commencer l'essai gratuit" : "Créer mon établissement"}
          </Link>
        </div>
      </section>

      <footer className="acc-pied">
        <span className="brand" style={{ fontSize: 17 }}>
          <Marque taille={26} />
          Juliette
        </span>
        <span className="hint">© {new Date().getFullYear()} Juliette · Fait pour les restaurants</span>
      </footer>
    </div>
  );
}
