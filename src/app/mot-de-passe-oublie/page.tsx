"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Marque from "@/components/Marque";

export default function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const r = await fetch("/api/mot-de-passe/oubli", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    setEnvoi(false);
    if (r?.ok) return setEnvoye(true);
    const d = r ? await r.json().catch(() => ({})) : {};
    setErreur(d.message ?? "Envoi impossible pour le moment. Réessaie dans un instant.");
  }

  return (
    <div className="center-screen">
      <form className="card mdp-carte" onSubmit={valider}>
        <Link href="/" className="brand">
          <Marque />Juliette
        </Link>
        {envoye ? (
          <>
            <h1>Regarde tes e-mails</h1>
            <p>
              Si un compte Juliette existe pour <b>{email}</b>, un lien pour choisir un nouveau mot de passe vient de partir. Il est valable une heure.
            </p>
            <p className="hint">Rien reçu après quelques minutes ? Vérifie les courriers indésirables, ou demande à ton responsable de vérifier l&apos;adresse enregistrée dans Juliette.</p>
            <Link href="/login" className="btn">
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <h1>Mot de passe oublié</h1>
            <p>Indique l&apos;adresse e-mail de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.</p>
            <div className="field">
              <label htmlFor="oubli-email">E-mail</label>
              <input id="oubli-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
            </div>
            {erreur && (
              <div className="error" role="alert">
                {erreur}
              </div>
            )}
            <button className="btn btn-primary" style={{ height: 44 }} disabled={envoi}>
              {envoi ? "Envoi…" : "Recevoir le lien"}
            </button>
            <Link href="/login" className="hint" style={{ textAlign: "center" }}>
              Retour à la connexion
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
