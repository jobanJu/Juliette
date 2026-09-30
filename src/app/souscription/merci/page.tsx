"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Marque from "@/components/Marque";
import Icone from "@/components/Icone";

type Etat = { statut: "chargement" | "en_attente" | "active" | "erreur"; code?: string; etablissement?: string; email?: string; message?: string };

// Retour de Stripe : on attend la validation automatique, puis on donne le code et l'accès.
export default function Merci() {
  const [e, setE] = useState<Etat>({ statut: "chargement" });

  useEffect(() => {
    const session = new URLSearchParams(window.location.search).get("session_id");
    if (!session) {
      setE({ statut: "erreur", message: "Lien incomplet. Si tu as payé, connecte-toi directement avec ton e-mail." });
      return;
    }
    let essais = 0;
    let arret = false;
    const verifier = async () => {
      const r = await fetch(`/api/souscription/etat?session_id=${encodeURIComponent(session)}`).catch(() => null);
      const d: Etat = r ? await r.json().catch(() => ({ statut: "erreur" })) : { statut: "en_attente" };
      if (arret) return;
      setE(d);
      if (d.statut === "en_attente" && ++essais < 30) setTimeout(verifier, 2000);
    };
    verifier();
    return () => {
      arret = true;
    };
  }, []);

  return (
    <div className="center-screen">
      <div className="card souscr-merci">
        <div className="brand" style={{ justifyContent: "center" }}>
          <Marque />Juliette
        </div>
        {e.statut === "active" ? (
          <>
            <span className="chip-ic t-mint souscr-ok">
              <Icone nom="controle" taille={26} />
            </span>
            <h1>{e.etablissement} est prêt</h1>
            <p>Ton abonnement est actif et ton compte directeur est créé.</p>
            <div className="souscr-code">
              <small>Code établissement</small>
              <b>{e.code}</b>
            </div>
            <p className="hint">Donne ce code à ton équipe : chacun activera son compte avec, depuis la page de connexion.</p>
            <Link href={`/login?code=${encodeURIComponent(e.code ?? "")}&email=${encodeURIComponent(e.email ?? "")}`} className="btn btn-primary" style={{ height: 46 }}>
              Me connecter et démarrer
            </Link>
          </>
        ) : e.statut === "erreur" ? (
          <>
            <h1>Un souci est survenu</h1>
            <p>{e.message ?? "Nous n'avons pas pu finaliser l'inscription."}</p>
            <Link href="/souscription" className="btn">
              Revenir à l&apos;inscription
            </Link>
          </>
        ) : (
          <>
            <div className="souscr-attente" aria-hidden />
            <h1>Paiement reçu, création de ton établissement…</h1>
            <p className="hint">Quelques secondes : ne ferme pas cette page.</p>
          </>
        )}
      </div>
    </div>
  );
}
