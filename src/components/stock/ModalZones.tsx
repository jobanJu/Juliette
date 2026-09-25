"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import type { Zone } from "@/lib/stock";

const COULEURS = ["#2E5F8A", "#3f8f6b", "#c0673a", "#7357d9", "#b8932e", "#b54a63", "#5d6b7a"];
const SUGGESTIONS = ["Chambre froide positive", "Chambre froide négative", "Frigo cuisine", "Frigo bar", "Réserve sèche", "Cave"];

type Brouillon = Zone & { nouveau?: boolean };

export default function ModalZones({ etablissementId, zones, nbProduits, onClose, onSaved }: { etablissementId: string; zones: Zone[]; nbProduits: (zoneId: string) => number; onClose: () => void; onSaved: (m: string) => void }) {
  const [liste, setListe] = useState<Brouillon[]>(zones);
  const [retirees, setRetirees] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const sb = getSupabaseClient()!;

  const ajouter = (titre = "") =>
    setListe((l) => [...l, { id: crypto.randomUUID(), titre, couleur: COULEURS[l.length % COULEURS.length], note: null, ordre: l.length, nouveau: true }]);

  async function enregistrer() {
    setErreur(null);
    const propres = liste.filter((z) => z.titre.trim()).map((z, i) => ({ ...z, titre: z.titre.trim(), ordre: i }));
    setEnvoi(true);
    const erreurs = [];
    if (retirees.length) erreurs.push((await sb.from("zones_stockage").delete().in("id", retirees)).error);
    const nouvelles = propres.filter((z) => z.nouveau);
    if (nouvelles.length)
      erreurs.push((await sb.from("zones_stockage").insert(nouvelles.map((z) => ({ id: z.id, etablissement_id: etablissementId, titre: z.titre, couleur: z.couleur, ordre: z.ordre })))).error);
    for (const z of propres.filter((z) => !z.nouveau)) {
      const avant = zones.find((x) => x.id === z.id);
      if (avant && (avant.titre !== z.titre || avant.couleur !== z.couleur || avant.ordre !== z.ordre))
        erreurs.push((await sb.from("zones_stockage").update({ titre: z.titre, couleur: z.couleur, ordre: z.ordre }).eq("id", z.id)).error);
    }
    setEnvoi(false);
    if (erreurs.some(Boolean)) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onSaved("Zones enregistrées");
  }

  return (
    <Modal
      titre="Zones de stockage"
      sousTitre="Chaque zone se compte séparément à l'inventaire"
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="equip-list">
        {liste.map((z, i) => (
          <div key={z.id} className="zone-row">
            <input type="color" value={z.couleur ?? "#7357d9"} onChange={(e) => setListe((l) => l.map((x) => (x.id === z.id ? { ...x, couleur: e.target.value } : x)))} aria-label="Couleur" />
            <input value={z.titre} onChange={(e) => setListe((l) => l.map((x) => (x.id === z.id ? { ...x, titre: e.target.value } : x)))} placeholder="Nom de la zone" aria-label="Nom" />
            <small className="hint">{z.nouveau ? "nouvelle" : `${nbProduits(z.id)} produit(s)`}</small>
            <span style={{ display: "flex" }}>
              <button className="icon-btn" disabled={i === 0} onClick={() => setListe((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} aria-label="Monter">
                ↑
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  setListe((l) => l.filter((x) => x.id !== z.id));
                  if (!z.nouveau) setRetirees((r) => [...r, z.id]);
                }}
                aria-label="Retirer"
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="chips">
        <button className="chip" onClick={() => ajouter()}>
          + Zone
        </button>
        {SUGGESTIONS.filter((s) => !liste.some((z) => z.titre === s)).map((s) => (
          <button key={s} className="chip" onClick={() => ajouter(s)}>
            + {s}
          </button>
        ))}
      </div>
      {retirees.length > 0 && <p className="hint" style={{ color: "var(--red-ink)" }}>Supprimer une zone efface aussi ses relevés d&apos;inventaire.</p>}
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
