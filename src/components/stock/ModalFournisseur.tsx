"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { emailValide } from "@/lib/personnel";
import type { Fournisseur } from "@/lib/stock";

export default function ModalFournisseur({ etablissementId, compteId, fournisseur, onClose, onSaved }: { etablissementId: string; compteId: string; fournisseur?: Fournisseur; onClose: () => void; onSaved: (m: string) => void }) {
  const f = fournisseur;
  const [nom, setNom] = useState(f?.nom ?? "");
  const [email, setEmail] = useState(f?.email ?? "");
  const [tva, setTva] = useState(f?.tva_pct != null ? String(f.tva_pct) : "5.5");
  const [minimum, setMinimum] = useState(f?.minimum_commande != null ? String(f.minimum_commande) : "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const sb = getSupabaseClient()!;

  async function enregistrer() {
    setErreur(null);
    if (!nom.trim()) return setErreur("Le nom est obligatoire.");
    if (email.trim() && !emailValide(email)) return setErreur("E-mail invalide.");
    const t = Number(tva.replace(",", "."));
    const m = minimum.trim() === "" ? null : Number(minimum.replace(",", "."));
    if (!Number.isFinite(t) || t < 0 || t > 30) return setErreur("TVA : un pourcentage, par exemple 5,5 ou 20.");
    if (m !== null && (!Number.isFinite(m) || m < 0)) return setErreur("Minimum de commande : un montant en euros.");
    setEnvoi(true);
    const ligne = { etablissement_id: etablissementId, nom: nom.trim(), email: email.trim() || null, tva_pct: t, minimum_commande: m };
    const { error } = f ? await sb.from("fournisseurs").update(ligne).eq("id", f.id) : await sb.from("fournisseurs").insert({ ...ligne, created_by: compteId });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onSaved(f ? "Fournisseur mis à jour" : `Fournisseur « ${ligne.nom} » ajouté`);
  }

  async function supprimer() {
    setEnvoi(true);
    const { error } = await sb.from("fournisseurs").delete().eq("id", f!.id);
    setEnvoi(false);
    if (error) return setErreur("Suppression refusée.");
    onSaved("Fournisseur supprimé");
  }

  return (
    <Modal
      titre={f ? f.nom : "Nouveau fournisseur"}
      onClose={onClose}
      pied={
        <>
          {f && (
            <span style={{ marginRight: "auto" }}>
              {!suppr ? (
                <button className="btn btn-danger-ghost" onClick={() => setSuppr(true)} disabled={envoi}>
                  Supprimer
                </button>
              ) : (
                <button className="btn btn-danger" onClick={supprimer} disabled={envoi}>
                  Confirmer
                </button>
              )}
            </span>
          )}
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="f-nom">Nom *</label>
        <input id="f-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus={!f} />
      </div>
      <div className="field">
        <label htmlFor="f-email">E-mail de commande</label>
        <input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="commandes@fournisseur.fr" />
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="f-tva">TVA (%)</label>
          <input id="f-tva" inputMode="decimal" value={tva} onChange={(e) => setTva(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-min">Minimum de commande (€ HT)</label>
          <input id="f-min" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="Aucun" />
        </div>
      </div>
      {f && <p className="hint">Renommer le fournisseur ne met pas à jour le nom inscrit sur ses produits : pense à les modifier aussi.</p>}
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
