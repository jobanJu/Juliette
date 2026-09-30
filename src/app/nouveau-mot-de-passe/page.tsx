"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Marque from "@/components/Marque";
import { getSupabaseClient } from "@/lib/supabase";

type Etat = "verification" | "pret" | "invalide" | "termine";

// Arrivée depuis l'e-mail de réinitialisation : le lien ouvre une session temporaire, puis on
// enregistre le nouveau mot de passe.
export default function NouveauMotDePasse() {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>("verification");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verifie = useRef(false);

  useEffect(() => {
    if (verifie.current) return;
    verifie.current = true;
    const sb = getSupabaseClient();
    if (!sb) return setEtat("invalide");
    const q = new URLSearchParams(window.location.search);
    const jeton = q.get("token_hash");
    if (jeton) {
      // Le jeton ne sert qu'une fois : on le retire de l'adresse aussitôt vérifié.
      sb.auth.verifyOtp({ token_hash: jeton, type: "recovery" }).then(({ error }) => {
        window.history.replaceState(null, "", "/nouveau-mot-de-passe");
        setEtat(error ? "invalide" : "pret");
      });
      return;
    }
    // Lien envoyé par le service intégré de Supabase : la session arrive dans l'adresse.
    const { data } = sb.auth.onAuthStateChange((evenement, session) => {
      if (evenement === "PASSWORD_RECOVERY" || session) setEtat("pret");
    });
    sb.auth.getSession().then(({ data: s }) => {
      if (s.session) setEtat("pret");
      else setTimeout(() => setEtat((e) => (e === "verification" ? "invalide" : e)), 2500);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (mdp.length < 8) return setErreur("Le mot de passe doit faire au moins 8 caractères.");
    if (mdp !== mdp2) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.auth.updateUser({ password: mdp });
    setEnvoi(false);
    if (error) return setErreur(error.message.includes("different") ? "Choisis un mot de passe différent de l'ancien." : "Enregistrement impossible. Demande un nouveau lien et réessaie.");
    setEtat("termine");
    setTimeout(() => router.replace("/dashboard"), 1500);
  }

  return (
    <div className="center-screen">
      <form className="card mdp-carte" onSubmit={valider}>
        <Link href="/" className="brand">
          <Marque />Juliette
        </Link>
        {etat === "verification" && <p className="hint">Vérification du lien…</p>}
        {etat === "invalide" && (
          <>
            <h1>Lien expiré</h1>
            <p>Ce lien n&apos;est plus valable : il a déjà servi ou il date de plus d&apos;une heure.</p>
            <Link href="/mot-de-passe-oublie" className="btn btn-primary" style={{ height: 44 }}>
              Demander un nouveau lien
            </Link>
          </>
        )}
        {etat === "pret" && (
          <>
            <h1>Nouveau mot de passe</h1>
            <div className="field">
              <label htmlFor="nmdp">Nouveau mot de passe</label>
              <input id="nmdp" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="new-password" minLength={8} autoFocus required />
              <small className="hint">8 caractères minimum.</small>
            </div>
            <div className="field">
              <label htmlFor="nmdp2">Confirme-le</label>
              <input id="nmdp2" type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} autoComplete="new-password" required />
            </div>
            {erreur && (
              <div className="error" role="alert">
                {erreur}
              </div>
            )}
            <button className="btn btn-primary" style={{ height: 44 }} disabled={envoi}>
              {envoi ? "Enregistrement…" : "Enregistrer et me connecter"}
            </button>
          </>
        )}
        {etat === "termine" && (
          <>
            <h1>Mot de passe modifié</h1>
            <p>Tu es connecté. Ouverture de Juliette…</p>
          </>
        )}
      </form>
    </div>
  );
}
