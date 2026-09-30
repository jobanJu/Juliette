"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import Marque from "@/components/Marque";
import Icone from "@/components/Icone";

export default function Connexion() {
  const { etat, connexion } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (etat.statut === "connecte") router.replace("/dashboard");
  }, [etat.statut, router]);

  async function valider(e: FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const err = await connexion(code, email, motDePasse);
    if (err) {
      setErreur(err);
      setEnvoi(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-art">
        <div className="brand">
          <Marque />Juliette
        </div>
        <div>
          <h2>Le quotidien du restaurant, enfin réuni.</h2>
          <p>Équipe, stocks, hygiène et salle au même endroit — pour passer moins de temps sur les papiers et plus avec les clients.</p>
          <ul>
            <li><Icone nom="horloge" /> Pointage, planning et congés</li>
            <li><Icone nom="stock" /> Inventaire, pertes et commandes fournisseurs</li>
            <li><Icone nom="surgele" /> HACCP : températures, nettoyage et traçabilité</li>
          </ul>
        </div>
        <small style={{ opacity: 0.6 }}>© {new Date().getFullYear()} Juliette</small>
      </aside>

      <div className="login-form">
        <form onSubmit={valider}>
          <div className="brand" style={{ marginBottom: 10 }}>
            <Marque />Juliette
          </div>
          <div>
            <h1>Connexion</h1>
            <p style={{ margin: "6px 0 4px", color: "var(--muted)", fontSize: 13 }}>Le code établissement t&apos;a été donné par ton responsable.</p>
          </div>
          <div className="field">
            <label htmlFor="code">Code établissement</label>
            <input id="code" className="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="organization" placeholder="DEMO02" required />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="mdp">Mot de passe</label>
            <input id="mdp" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="current-password" required />
          </div>
          {erreur && <div className="error" role="alert">{erreur}</div>}
          <button className="btn btn-primary" style={{ height: 44 }} disabled={envoi || etat.statut === "chargement"}>
            {envoi ? "Connexion…" : "Se connecter"}
          </button>
          <p className="hint" style={{ textAlign: "center" }}>
            Première connexion ?{" "}
            <Link href="/activer" style={{ color: "var(--purple-ink)", fontWeight: 600 }}>
              Active ton compte
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
