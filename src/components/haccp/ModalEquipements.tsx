"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { EQUIPEMENTS_SUGGERES, EQUIPEMENTS_TYPES, nouvelId } from "@/lib/haccp";
import type { Equipement } from "@/lib/haccp";

export default function ModalEquipements({
  etablissementId,
  equipements,
  onClose,
  onSaved,
}: {
  etablissementId: string;
  equipements: Equipement[];
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const [liste, setListe] = useState<Equipement[]>(() =>
    equipements.length ? equipements : EQUIPEMENTS_SUGGERES.map((e) => ({ ...e, id: nouvelId() })),
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const maj = (id: string, champ: Partial<Equipement>) =>
    setListe((l) => l.map((e) => (e.id === id ? { ...e, ...champ } : e)));

  const monter = (index: number) => {
    if (index <= 0) return;
    setListe((prev) => {
      const arr = [...prev];
      const tmp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = tmp;
      return arr;
    });
  };

  const descendre = (index: number) => {
    if (index >= liste.length - 1) return;
    setListe((prev) => {
      const arr = [...prev];
      const tmp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = tmp;
      return arr;
    });
  };

  async function enregistrer() {
    setErreur(null);
    const propres = liste.filter((e) => e.nom.trim());
    if (!propres.length) {
      return setErreur("Ajoute au moins un équipement.");
    }
    if (propres.some((e) => !(e.min < e.max))) {
      return setErreur("Pour chaque équipement, le minimum doit être inférieur au maximum.");
    }
    setEnvoi(true);
    const { error } = await getSupabaseClient()!
      .from("haccp_config")
      .upsert(
        {
          etablissement_id: etablissementId,
          cle: "equipements",
          data: propres.map((e) => ({ ...e, nom: e.nom.trim() })),
        },
        { onConflict: "etablissement_id,cle" },
      );
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onSaved("Ordre et équipements enregistrés avec succès");
  }

  return (
    <Modal
      titre="Paramètres des équipements & ordre"
      sousTitre="Organise les frigos et équipements dans l'ordre physique de ton tour de cuisine"
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p className="hint" style={{ margin: 0 }}>
          Utilise <b>▲</b> et <b>▼</b> pour créer l’ordre exact de ta tournée (chambre froide, saladette, tiroirs...).
        </p>
        <button
          className="btn btn-sm"
          type="button"
          onClick={() => setListe((l) => [...l, { id: nouvelId(), nom: "", type: "positif", min: 0, max: 4 }])}
        >
          + Ajouter un frigo
        </button>
      </div>

      <div className="equip-list">
        {liste.map((e, index) => (
          <div key={e.id} className="equip-row-enhanced">
            <div className="equip-order-ctrls">
              <button
                type="button"
                className="icon-btn-sm"
                title="Monter"
                disabled={index === 0}
                onClick={() => monter(index)}
                aria-label={`Monter ${e.nom || `équipement ${index + 1}`}`}
              >
                ▲
              </button>
              <span className="equip-order-badge">#{index + 1}</span>
              <button
                type="button"
                className="icon-btn-sm"
                title="Descendre"
                disabled={index === liste.length - 1}
                onClick={() => descendre(index)}
                aria-label={`Descendre ${e.nom || `équipement ${index + 1}`}`}
              >
                ▼
              </button>
            </div>

            <input
              className="equip-nom-input"
              value={e.nom}
              onChange={(x) => maj(e.id, { nom: x.target.value })}
              placeholder="Ex. : FRIGO 1, Saladette..."
              aria-label="Nom de l'équipement"
            />

            <select
              className="equip-type-select"
              value={e.type}
              onChange={(x) => {
                const t = x.target.value as Equipement["type"];
                maj(e.id, { type: t, min: EQUIPEMENTS_TYPES[t].min, max: EQUIPEMENTS_TYPES[t].max });
              }}
              aria-label="Type"
            >
              {Object.entries(EQUIPEMENTS_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icone} {v.label}
                </option>
              ))}
            </select>

            <div className="equip-bounds">
              <span className="equip-bound-tag">Min</span>
              <input
                type="number"
                value={e.min}
                onChange={(x) => maj(e.id, { min: Number(x.target.value) })}
                aria-label="Minimum"
                title="Minimum (°C)"
              />
              <span className="equip-bound-tag">Max</span>
              <input
                type="number"
                value={e.max}
                onChange={(x) => maj(e.id, { max: Number(x.target.value) })}
                aria-label="Maximum"
                title="Maximum (°C)"
              />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>°C</span>
            </div>

            <button
              type="button"
              className="icon-btn"
              onClick={() => setListe((l) => l.filter((x) => x.id !== e.id))}
              aria-label="Supprimer cet équipement"
              title="Supprimer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <p className="hint">
          Repères réglementaires : Froid positif standard 0 à +4 °C (poissons/viandes 0 à +2 °C), surgelés −18 °C ou moins, maintien au chaud +63 °C minimum.
        </p>
      </div>

      {erreur && (
        <div className="error" role="alert" style={{ marginTop: 10 }}>
          {erreur}
        </div>
      )}
    </Modal>
  );
}
