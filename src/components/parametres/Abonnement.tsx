"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";

type Abo = { statut: string; fin_essai: string | null; fin_periode: string | null; resiliation_prevue: boolean };

const STATUTS: Record<string, { label: string; ton: string }> = {
  trialing: { label: "Essai gratuit", ton: "t-lav" },
  active: { label: "Actif", ton: "t-mint" },
  past_due: { label: "Paiement en retard", ton: "t-peach" },
  unpaid: { label: "Impayé", ton: "t-red" },
  canceled: { label: "Résilié", ton: "t-red" },
  incomplete: { label: "Paiement à finaliser", ton: "t-yellow" },
  incomplete_expired: { label: "Paiement expiré", ton: "t-red" },
  paused: { label: "En pause", ton: "t-yellow" },
};

const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");

// Paramètres → Abonnement (directeur) : état de l'abonnement Stripe et accès à l'espace de facturation.
export default function Abonnement() {
  const { etablissement } = useConnecte();
  const [abo, setAbo] = useState<Abo | null | undefined>(undefined);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseClient()!
      .from("abonnements")
      .select("statut, fin_essai, fin_periode, resiliation_prevue")
      .eq("etablissement_id", etablissement.id)
      .maybeSingle()
      .then(({ data }) => setAbo((data as Abo | null) ?? null));
  }, [etablissement.id]);

  async function ouvrirPortail() {
    setErreur(null);
    setEnvoi(true);
    const { data } = await getSupabaseClient()!.auth.getSession();
    const r = await fetch("/api/stripe/portail", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ etablissementId: etablissement.id }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && d.url) {
      window.location.href = d.url;
      return;
    }
    setEnvoi(false);
    setErreur("L'espace de facturation est indisponible pour le moment. Réessaie dans un instant.");
  }

  if (abo === undefined) return <div className="skeleton" style={{ height: 180, borderRadius: 14 }} />;

  if (!abo)
    return (
      <section className="card">
        <div className="card-head">
          <h2>Abonnement</h2>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          Cet établissement n&apos;a pas d&apos;abonnement en ligne : son accès est géré directement par l&apos;équipe Juliette. Pour toute question sur ta formule, écris-nous.
        </p>
      </section>
    );

  const s = STATUTS[abo.statut] ?? { label: abo.statut, ton: "t-lav" };
  return (
    <section className="card">
      <div className="card-head">
        <h2>Abonnement Juliette</h2>
        <span className={`pill ${s.ton}`}>{s.label}</span>
      </div>
      <div className="rows">
        {abo.statut === "trialing" && (
          <div className="row">
            <span className="main-txt">
              <b>Fin de l&apos;essai gratuit</b>
              <small>Le premier prélèvement a lieu ce jour-là.</small>
            </span>
            <span className="right">{jour(abo.fin_essai)}</span>
          </div>
        )}
        <div className="row">
          <span className="main-txt">
            <b>{abo.resiliation_prevue ? "Fin de l'abonnement" : "Prochaine échéance"}</b>
            <small>{abo.resiliation_prevue ? "L'accès reste ouvert jusqu'à cette date." : "Renouvellement automatique."}</small>
          </span>
          <span className="right">{jour(abo.fin_periode)}</span>
        </div>
      </div>
      {(abo.statut === "past_due" || abo.statut === "unpaid") && (
        <div className="error" style={{ marginTop: 12 }}>
          Le dernier paiement n&apos;est pas passé. Mets à jour ta carte pour éviter la suspension de l&apos;accès.
        </div>
      )}
      <p className="hint">Factures, moyen de paiement, adresse de facturation et résiliation se gèrent dans l&apos;espace sécurisé de Stripe.</p>
      {erreur && <div className="error">{erreur}</div>}
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: 0 }}>
        <button className="btn btn-primary" onClick={ouvrirPortail} disabled={envoi}>
          {envoi ? "Ouverture…" : "Gérer mon abonnement et mes factures"}
        </button>
        <Link href="/aide#questions" className="btn">
          Questions fréquentes
        </Link>
      </p>
    </section>
  );
}
