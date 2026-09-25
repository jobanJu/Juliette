"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

// Première connexion d'un salarié invité : il choisit son mot de passe, le compte se rattache à l'invitation.
export default function Activer() {
  const { etat, activation } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (etat.statut === "connecte") router.replace("/dashboard");
  }, [etat.statut, router]);

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (mdp.length < 8) return setErreur("Le mot de passe doit faire au moins 8 caractères.");
    if (mdp !== mdp2) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnvoi(true);
    const r = await activation(code, email, mdp);
    setEnvoi(false);
    if (r === "CONFIRMER_EMAIL") setConfirmer(true);
    else if (r) setErreur(r);
  }

  return (
    <div className="login">
      <aside className="login-art">
        <div className="brand">
          <span className="brand-mark">J</span>Juliette
        </div>
        <div>
          <h2>Bienvenue dans l&apos;équipe.</h2>
          <p>Ton responsable t&apos;a ajouté sur Juliette. Choisis ton mot de passe pour accéder à ton planning, pointer et poser tes congés.</p>
        </div>
        <small style={{ opacity: 0.6 }}>© {new Date().getFullYear()} Juliette</small>
      </aside>

      <div className="login-form">
        {confirmer ? (
          <div style={{ maxWidth: 360, display: "grid", gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Vérifie ta boîte mail</h1>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>
              Un lien de confirmation vient d&apos;être envoyé à <b>{email}</b>. Clique dessus, puis connecte-toi avec le code <b>{code.toUpperCase()}</b>, ton e-mail et le mot de passe que tu viens de choisir.
            </p>
            <Link className="btn btn-primary" href="/login" style={{ height: 44 }}>
              Aller à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={valider}>
            <div className="brand" style={{ marginBottom: 10 }}>
              <span className="brand-mark">J</span>Juliette
            </div>
            <div>
              <h1>Activer mon compte</h1>
              <p style={{ margin: "6px 0 4px", color: "var(--muted)", fontSize: 13 }}>Utilise le code et l&apos;e-mail donnés par ton responsable.</p>
            </div>
            <div className="field">
              <label htmlFor="code">Code établissement</label>
              <input id="code" className="code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </div>
            <div className="field">
              <label htmlFor="mdp">Choisis un mot de passe</label>
              <input id="mdp" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <div className="field">
              <label htmlFor="mdp2">Confirme-le</label>
              <input id="mdp2" type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} autoComplete="new-password" required />
            </div>
            {erreur && (
              <div className="error" role="alert">
                {erreur}
              </div>
            )}
            <button className="btn btn-primary" style={{ height: 44 }} disabled={envoi}>
              {envoi ? "Activation…" : "Activer mon compte"}
            </button>
            <p className="hint" style={{ textAlign: "center" }}>
              Déjà un compte ? <Link href="/login" style={{ color: "var(--purple-ink)", fontWeight: 600 }}>Se connecter</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
