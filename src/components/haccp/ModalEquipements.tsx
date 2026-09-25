"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { EQUIPEMENTS_SUGGERES, EQUIPEMENTS_TYPES, nouvelId } from "@/lib/haccp";
import type { Equipement } from "@/lib/haccp";

export default function ModalEquipements({ etablissementId, equipements, onClose, onSaved }: { etablissementId: string; equipements: Equipement[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [liste, setListe] = useState<Equipement[]>(() =>
    equipements.length ? equipements : EQUIPEMENTS_SUGGERES.map((e) => ({ ...e, id: nouvelId() })),
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const maj = (id: string, champ: Partial<Equipement>) => setListe((l) => l.map((e) => (e.id === id ? { ...e, ...champ } : e)));

  async function enregistrer() {
    setErreur(null);
    const propres = liste.filter((e) => e.nom.trim());
    if (propres.some((e) => !(e.min < e.max))) return setErreur("Pour chaque équipement, le minimum doit être inférieur au maximum.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!
      .from("haccp_config")
      .upsert({ etablissement_id: etablissementId, cle: "equipements", data: propres.map((e) => ({ ...e, nom: e.nom.trim() })) }, { onConflict: "etablissement_id,cle" });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onSaved("Équipements enregistrés");
  }

  return (
    <Modal
      titre="Équipements à relever"
      sousTitre="Frigos, chambres froides, vitrines, bain-marie…"
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
      {!equipements.length && <p className="hint">Voici une liste de départ : adapte les noms et les seuils à ta cuisine.</p>}
      <div className="equip-list">
        {liste.map((e) => (
          <div key={e.id} className="equip-row">
            <input value={e.nom} onChange={(x) => maj(e.id, { nom: x.target.value })} placeholder="Nom" aria-label="Nom de l'équipement" />
            <select
              value={e.type}
              onChange={(x) => {
                const t = x.target.value as Equipement["type"];
                maj(e.id, { type: t, min: EQUIPEMENTS_TYPES[t].min, max: EQUIPEMENTS_TYPES[t].max });
              }}
              aria-label="Type"
            >
              {Object.entries(EQUIPEMENTS_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <input type="number" value={e.min} onChange={(x) => maj(e.id, { min: Number(x.target.value) })} aria-label="Minimum" title="Minimum (°C)" />
            <input type="number" value={e.max} onChange={(x) => maj(e.id, { max: Number(x.target.value) })} aria-label="Maximum" title="Maximum (°C)" />
            <button className="icon-btn" onClick={() => setListe((l) => l.filter((x) => x.id !== e.id))} aria-label="Retirer">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => setListe((l) => [...l, { id: nouvelId(), nom: "", type: "positif", min: 0, max: 4 }])}>
        + Ajouter un équipement
      </button>
      <p className="hint">Repères : froid positif 0 à +4 °C (viandes hachées, poissons : 0 à +2 °C), surgelés −18 °C ou moins, maintien au chaud +63 °C minimum.</p>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
