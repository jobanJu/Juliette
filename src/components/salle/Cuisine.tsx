"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { libelleBon } from "@/lib/salle";
import type { Bon } from "@/lib/salle";

/** Écran cuisine : les bons envoyés, du plus ancien au plus récent, avec le temps d'attente. */
export default function Cuisine({ bons, onChange }: { bons: Bon[]; onChange: (m?: string) => void }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [voirServis, setVoirServis] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 15000);
    return () => clearInterval(i);
  }, []);

  const aPreparer = bons.filter((b) => b.statut === "envoyee" && !b.servi_at).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const servis = bons.filter((b) => b.statut === "envoyee" && b.servi_at).sort((a, b) => (b.servi_at ?? "").localeCompare(a.servi_at ?? "")).slice(0, 8);

  async function marquer(b: Bon, servi: boolean) {
    const { error } = await getSupabaseClient()!.from("commandes_salle").update({ servi_at: servi ? new Date().toISOString() : null }).eq("id", b.id);
    onChange(error ? "Modification refusée" : servi ? `${libelleBon(b)} : prêt` : undefined);
  }

  const attente = (b: Bon) => Math.floor((maintenant - new Date(b.updated_at).getTime()) / 60000);

  return (
    <>
      {!aPreparer.length ? (
        <section className="card empty">
          <b>Rien en attente en cuisine</b>
          Les bons envoyés par la salle apparaissent ici en direct.
        </section>
      ) : (
        <div className="kds">
          {aPreparer.map((b) => {
            const m = attente(b);
            return (
              <section key={b.id} className={`card kds-bon${m >= 20 ? " kds-retard" : m >= 12 ? " kds-attention" : ""}`}>
                <div className="kds-head">
                  <b>{libelleBon(b)}</b>
                  <span className="kds-timer">{m} min</span>
                </div>
                <small className="hint">
                  {b.type_commande && b.type_commande !== "sur_place"
                    ? `${b.type_commande === "livraison" ? "Livrer" : "Retrait"} ${b.heure_souhaitee ? `à ${b.heure_souhaitee.slice(0, 5)}` : "dès que possible"}`
                    : `${b.couverts} couvert(s)`}{" "}
                  · {b.cree_par_nom} · {new Date(b.updated_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </small>
                <ul className="kds-lignes">
                  {b.lignes.map((l, k) => (
                    <li key={k}>
                      <b>{l.quantite}</b> {l.nom}
                      {l.note && <small> · {l.note}</small>}
                    </li>
                  ))}
                </ul>
                {b.note && <p className="kds-note">⚠ {b.note}</p>}
                <button className="btn btn-primary" style={{ height: 44 }} onClick={() => marquer(b, true)}>
                  ✓ Prêt
                </button>
              </section>
            );
          })}
        </div>
      )}

      {servis.length > 0 && (
        <p style={{ marginTop: 14 }}>
          <button className="link-btn" onClick={() => setVoirServis((v) => !v)}>
            {voirServis ? "Masquer" : "Voir"} les derniers bons servis ({servis.length})
          </button>
        </p>
      )}
      {voirServis && (
        <div className="rows card">
          {servis.map((b) => (
            <div key={b.id} className="row">
              <span className="main-txt">
                <b>{libelleBon(b)}</b>
                <small>{b.lignes.map((l) => `${l.quantite} ${l.nom}`).join(", ")}</small>
              </span>
              <span className="hint">servi à {new Date(b.servi_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              <button className="btn" style={{ height: 30 }} onClick={() => marquer(b, false)}>
                Remettre en cuisine
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
