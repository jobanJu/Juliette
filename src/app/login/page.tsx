"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

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
          <span className="brand-mark">J</span>Juliette
        </div>
        <div>
          <h2>Le quotidien du restaurant, enfin réuni.</h2>
          <p>Équipe, stocks, hygiène et salle au même endroit — pour passer moins de temps sur les papiers et plus avec les clients.</p>
          <ul>
            <li>◷ Pointage, planning et congés</li>
            <li>▤ Inventaire, pertes et commandes fournisseurs</li>
            <li>✓ Réception et relevés HACCP</li>
          </ul>
        </div>
        <small style={{ opacity: 0.6 }}>© {new Date().getFullYear()} Juliette</small>
      </aside>

      <div className="login-form">
        <form onSubmit={valider}>
          <div className="brand" style={{ marginBottom: 10 }}>
            <span className="brand-mark">J</span>Juliette
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
        </form>
      </div>
    </div>
  );
}
