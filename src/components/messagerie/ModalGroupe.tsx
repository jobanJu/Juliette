"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet } from "@/lib/session";
import type { Compte } from "@/lib/session";
import type { Groupe, Membre } from "@/lib/messagerie";

type Props = {
  etablissementId: string;
  moiId: string;
  equipe: Compte[];
  /** Groupe existant à gérer ; absent = création. */
  groupe?: Groupe;
  membres?: Membre[];
  peutSupprimer?: boolean;
  onClose: () => void;
  onFait: (message: string, groupId?: string) => void;
};

export default function ModalGroupe(p: Props) {
  const edition = !!p.groupe;
  const initiaux = useMemo(() => new Set((p.membres ?? []).map((m) => m.compte_id)), [p.membres]);
  const [nom, setNom] = useState(p.groupe?.nom ?? "");
  const [choisis, setChoisis] = useState<Set<string>>(() => new Set(edition ? initiaux : [p.moiId]));
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const sb = getSupabaseClient()!;

  const liste = p.equipe
    .filter((c) => c.statut === "actif")
    .filter((c) => !recherche.trim() || nomComplet(c).toLowerCase().includes(recherche.trim().toLowerCase()))
    .sort((a, b) => nomComplet(a).localeCompare(nomComplet(b)));

  function basculer(id: string) {
    const s = new Set(choisis);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setChoisis(s);
  }

  async function valider() {
    setErreur(null);
    if (!nom.trim()) return setErreur("Donne un nom au groupe.");
    if (choisis.size < 2) return setErreur("Ajoute au moins une autre personne.");
    setEnvoi(true);
    if (!edition) {
      const { data, error } = await sb
        .from("message_groups")
        .insert({ etablissement_id: p.etablissementId, nom: nom.trim(), est_direct: false, created_by: p.moiId })
        .select("id")
        .single();
      if (error || !data) {
        setEnvoi(false);
        return setErreur("Création refusée : seul le directeur crée des groupes.");
      }
      const { error: e2 } = await sb
        .from("message_group_membres")
        .insert([...choisis].map((id) => ({ etablissement_id: p.etablissementId, group_id: data.id, compte_id: id, est_admin: id === p.moiId })));
      setEnvoi(false);
      if (e2) return setErreur("Groupe créé, mais l'ajout des membres a échoué.");
      return p.onFait(`Groupe « ${nom.trim()} » créé`, data.id);
    }
    const g = p.groupe!;
    const ajouts = [...choisis].filter((id) => !initiaux.has(id));
    const retraits = [...initiaux].filter((id) => !choisis.has(id));
    const erreurs = [];
    if (nom.trim() !== g.nom) erreurs.push((await sb.from("message_groups").update({ nom: nom.trim() }).eq("id", g.id)).error);
    if (ajouts.length)
      erreurs.push((await sb.from("message_group_membres").insert(ajouts.map((id) => ({ etablissement_id: p.etablissementId, group_id: g.id, compte_id: id })))).error);
    if (retraits.length) erreurs.push((await sb.from("message_group_membres").delete().eq("group_id", g.id).in("compte_id", retraits)).error);
    setEnvoi(false);
    if (erreurs.some(Boolean)) return setErreur("Modification refusée : réservée au directeur et aux administrateurs du groupe.");
    p.onFait("Groupe mis à jour");
  }

  async function supprimer() {
    setEnvoi(true);
    const { error } = await sb.from("message_groups").delete().eq("id", p.groupe!.id);
    setEnvoi(false);
    if (error) return setErreur("Suppression refusée.");
    p.onFait("Groupe supprimé");
  }

  return (
    <Modal
      titre={edition ? "Gérer le groupe" : "Nouveau groupe"}
      sousTitre={edition ? `${initiaux.size} membre(s)` : "Pour la cuisine, la salle, l'équipe du soir…"}
      onClose={p.onClose}
      pied={
        <>
          {edition && p.peutSupprimer && (
            <span style={{ marginRight: "auto", display: "flex", gap: 8 }}>
              {!confirmer ? (
                <button className="btn btn-danger-ghost" onClick={() => setConfirmer(true)} disabled={envoi}>
                  Supprimer
                </button>
              ) : (
                <button className="btn btn-danger" onClick={supprimer} disabled={envoi}>
                  Confirmer la suppression
                </button>
              )}
            </span>
          )}
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={valider} disabled={envoi}>
            {envoi ? "Enregistrement…" : edition ? "Enregistrer" : "Créer le groupe"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="g-nom">Nom du groupe</label>
        <input id="g-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Cuisine, Équipe du soir…" maxLength={60} autoFocus={!edition} />
      </div>
      <div className="field">
        <label>
          Membres · {choisis.size} sélectionné{choisis.size > 1 ? "s" : ""}
        </label>
        <label className="search" style={{ background: "var(--card)" }}>
          <span aria-hidden>⌕</span>
          <input placeholder="Rechercher" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
        <div className="pick-list">
          {liste.map((c) => (
            <label key={c.id} className="pick">
              <input type="checkbox" checked={choisis.has(c.id)} onChange={() => basculer(c.id)} disabled={c.id === p.moiId && !edition} />
              <span className="avatar">{c.avatar_url ? <img src={c.avatar_url} alt="" /> : initiales(c)}</span>
              <span>
                {nomComplet(c)}
                {c.id === p.moiId ? " (moi)" : ""}
              </span>
            </label>
          ))}
        </div>
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
