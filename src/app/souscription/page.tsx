"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Marque from "@/components/Marque";
import Icone from "@/components/Icone";
import { prixLisible, useTarif } from "@/lib/tarif";

const INCLUS = [
  "Tous les modules : équipe, HACCP, stock, salle, fiches techniques, finance",
  "Toute l'équipe incluse, sur ordinateur, tablette et téléphone",
  "Import de ton catalogue produits depuis Excel",
  "Contrats et documents RH France et Belgique",
  "Sans engagement : tu résilies quand tu veux",
];

// Souscription en ligne : formulaire, puis paiement sur la page sécurisée de Stripe.
export default function Souscription() {
  const tarif = useTarif();
  const prix = tarif ? prixLisible(tarif) : null;
  const [f, setF] = useState({ etablissement: "", ville: "", pays: "FR", code: "", prenom: "", nom: "", email: "", motDePasse: "" });
  const [codeTouche, setCodeTouche] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [annule, setAnnule] = useState(false);
  const [accepte, setAccepte] = useState(false);

  useEffect(() => {
    setAnnule(new URLSearchParams(window.location.search).has("annule"));
  }, []);

  const maj = (k: keyof typeof f, v: string) =>
    setF((x) => {
      const n = { ...x, [k]: v };
      // Code proposé d'après le nom, tant qu'il n'a pas été saisi à la main.
      if (k === "etablissement" && !codeTouche) n.code = v.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
      return n;
    });

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (f.motDePasse.length < 8) return setErreur("Le mot de passe doit faire au moins 8 caractères.");
    if (!accepte) return setErreur("Pour continuer, accepte les conditions générales d'abonnement.");
    setEnvoi(true);
    const r = await fetch("/api/souscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, accepteConditions: accepte }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && d.url) {
      window.location.href = d.url;
      return;
    }
    setEnvoi(false);
    setErreur(d.message ?? "Connexion impossible. Vérifie ta connexion internet puis réessaie.");
  }

  return (
    <div className="login">
      <aside className="login-art">
        <Link href="/" className="brand">
          <Marque />Juliette
        </Link>
        <div className="souscr-offre">
          <p className="souscr-etiquette">Formule Juliette</p>
          {prix ? (
            <p className="souscr-prix">
              {prix.montant}
              <small> HT / {prix.periode}</small>
            </p>
          ) : (
            <p className="souscr-prix">
              <small>{tarif ? "Tarif communiqué à l'inscription" : "…"}</small>
            </p>
          )}
          {tarif?.essaiJours ? <p className="souscr-essai">{tarif.essaiJours} jours d&apos;essai gratuit, sans prélèvement avant la fin de l&apos;essai.</p> : null}
          <ul>
            {INCLUS.map((x) => (
              <li key={x}>
                <Icone nom="controle" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <small style={{ opacity: 0.7 }}>
          <Icone nom="cadenas" taille={13} /> Paiement sécurisé par Stripe. Juliette ne voit jamais ta carte.
        </small>
      </aside>

      <div className="login-form">
        <form onSubmit={valider} className="souscr-form">
          <div className="brand souscr-marque-mobile">
            <Marque />Juliette
          </div>
          <div>
            <h1>Créer mon établissement</h1>
            <p className="hint" style={{ margin: "6px 0 0" }}>
              Deux minutes, puis le paiement sur Stripe. Ton établissement est ouvert dès que le paiement est validé.
            </p>
          </div>
          {annule && <div className="error">Paiement annulé : rien n&apos;a été prélevé. Tu peux reprendre quand tu veux.</div>}

          <fieldset>
            <legend>L&apos;établissement</legend>
            <div className="field">
              <label htmlFor="s-etab">Nom du restaurant</label>
              <input id="s-etab" value={f.etablissement} onChange={(e) => maj("etablissement", e.target.value)} autoComplete="organization" required />
            </div>
            <div className="form-2">
              <div className="field">
                <label htmlFor="s-ville">Ville</label>
                <input id="s-ville" value={f.ville} onChange={(e) => maj("ville", e.target.value)} autoComplete="address-level2" />
              </div>
              <div className="field">
                <label htmlFor="s-pays">Pays</label>
                <select id="s-pays" value={f.pays} onChange={(e) => maj("pays", e.target.value)}>
                  <option value="FR">France</option>
                  <option value="BE">Belgique</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="s-code">Code établissement</label>
              <input
                id="s-code"
                className="code"
                value={f.code}
                onChange={(e) => {
                  setCodeTouche(true);
                  maj("code", e.target.value.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 20));
                }}
                minLength={3}
                required
              />
              <small className="hint">Ton équipe le tapera pour se connecter. Lettres et chiffres, au moins 3.</small>
            </div>
          </fieldset>

          <fieldset>
            <legend>Ton compte directeur</legend>
            <div className="form-2">
              <div className="field">
                <label htmlFor="s-prenom">Prénom</label>
                <input id="s-prenom" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} autoComplete="given-name" required />
              </div>
              <div className="field">
                <label htmlFor="s-nom">Nom</label>
                <input id="s-nom" value={f.nom} onChange={(e) => maj("nom", e.target.value)} autoComplete="family-name" required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="s-email">E-mail</label>
              <input id="s-email" type="email" value={f.email} onChange={(e) => maj("email", e.target.value)} autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="s-mdp">Mot de passe</label>
              <input id="s-mdp" type="password" value={f.motDePasse} onChange={(e) => maj("motDePasse", e.target.value)} autoComplete="new-password" minLength={8} required />
              <small className="hint">8 caractères minimum.</small>
            </div>
          </fieldset>

          <label className="souscr-accord">
            <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} required />
            <span>
              J&apos;agis pour les besoins de mon activité professionnelle et j&apos;accepte les{" "}
              <Link href="/conditions" target="_blank">
                conditions générales d&apos;abonnement
              </Link>
              , dont l&apos;
              <Link href="/sous-traitance" target="_blank">
                accord de sous-traitance des données
              </Link>
              . J&apos;ai lu la{" "}
              <Link href="/confidentialite" target="_blank">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>

          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
          <button className="btn btn-primary" style={{ height: 48 }} disabled={envoi}>
            {envoi ? "Ouverture du paiement…" : tarif?.essaiJours ? `Commencer l'essai gratuit de ${tarif.essaiJours} jours` : "Continuer vers le paiement"}
          </button>
          <p className="hint" style={{ textAlign: "center" }}>
            Déjà client ?{" "}
            <Link href="/login" style={{ color: "var(--purple-ink)", fontWeight: 600 }}>
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
