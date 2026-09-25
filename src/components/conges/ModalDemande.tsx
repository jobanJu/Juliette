"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { ajouterJours, depuisIso, hm, iso } from "@/lib/planning";
import type { Creneau } from "@/lib/planning";
import { DELAI_TACITE_JOURS, joursOuvrables, MOTIFS, nbJours } from "@/lib/conges";

type Props = {
  etablissementId: string;
  compteId: string;
  onClose: () => void;
  onEnvoyee: (message: string) => void;
};

export default function ModalDemande(p: Props) {
  const demain = ajouterJours(iso(new Date()), 1);
  const [type, setType] = useState<"conge" | "acompte">("conge");
  const [motif, setMotif] = useState("conge_paye");
  const [debut, setDebut] = useState(demain);
  const [fin, setFin] = useState(demain);
  const [detail, setDetail] = useState("");
  const [montant, setMontant] = useState("");
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const sb = getSupabaseClient()!;

  // Créneaux déjà posés au planning sur la période : le salarié sait ce que son absence va décaler.
  useEffect(() => {
    if (type !== "conge" || !debut || !fin || fin < debut) return;
    let actif = true;
    sb.from("planning_creneaux")
      .select("id, compte_id, date, type, heure_debut, heure_fin, pause_minutes, motif, note")
      .eq("compte_id", p.compteId)
      .eq("type", "shift")
      .gte("date", debut)
      .lte("date", fin)
      .order("date")
      .then(({ data }) => actif && setCreneaux((data ?? []) as Creneau[]));
    return () => {
      actif = false;
    };
  }, [sb, p.compteId, type, debut, fin]);

  async function envoyer() {
    setErreur(null);
    if (type === "conge") {
      if (!debut || !fin) return setErreur("Choisis les dates de début et de fin.");
      if (fin < debut) return setErreur("La date de fin est avant la date de début.");
      if (motif === "autre" && !detail.trim()) return setErreur("Précise le motif.");
    } else {
      const m = Number(montant.replace(",", "."));
      if (!Number.isFinite(m) || m <= 0) return setErreur("Indique le montant souhaité.");
      if (m > 5000) return setErreur("Montant inhabituel : vois directement avec ton responsable.");
    }
    setEnvoi(true);
    const { error } = await sb.from("conges").insert({
      etablissement_id: p.etablissementId,
      compte_id: p.compteId,
      type,
      date_debut: debut,
      date_fin: type === "conge" ? fin : debut,
      motif: type === "conge" ? motif : null,
      motif_detail: detail.trim() || null,
      montant: type === "acompte" ? Number(montant.replace(",", ".")) : null,
    });
    setEnvoi(false);
    if (error) return setErreur("Demande refusée. Tu n'as peut-être pas accès à ce module : vois avec ton responsable.");
    p.onEnvoyee(type === "conge" ? "Demande de congé envoyée" : "Demande d'acompte envoyée");
  }

  const jours = debut && fin && fin >= debut ? nbJours(debut, fin) : 0;
  const ouvrables = jours ? joursOuvrables(debut, fin) : 0;

  return (
    <Modal
      titre="Nouvelle demande"
      sousTitre="Ton responsable est prévenu et te répond ici"
      onClose={p.onClose}
      pied={
        <>
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={envoyer} disabled={envoi}>
            {envoi ? "Envoi…" : "Envoyer la demande"}
          </button>
        </>
      }
    >
      <div className="seg seg-2" role="tablist">
        <button role="tab" aria-selected={type === "conge"} className={type === "conge" ? "on" : ""} onClick={() => setType("conge")}>
          Congé / absence
        </button>
        <button role="tab" aria-selected={type === "acompte"} className={type === "acompte" ? "on" : ""} onClick={() => setType("acompte")}>
          Acompte sur salaire
        </button>
      </div>

      {type === "conge" ? (
        <>
          <div className="field">
            <label>Motif</label>
            <div className="chips">
              {Object.entries(MOTIFS).map(([k, v]) => (
                <button key={k} className={`chip${motif === k ? " on" : ""}`} onClick={() => setMotif(k)}>
                  <span className="dot" style={{ background: v.couleur, marginRight: 6 }} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-2">
            <div className="field">
              <label htmlFor="d-debut">Du</label>
              <input
                id="d-debut"
                type="date"
                value={debut}
                onChange={(e) => {
                  setDebut(e.target.value);
                  if (fin < e.target.value) setFin(e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="d-fin">Au (inclus)</label>
              <input id="d-fin" type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>
          {jours > 0 && (
            <p className="hint">
              <b>
                {jours} jour{jours > 1 ? "s" : ""}
              </b>{" "}
              · {ouvrables} ouvrable{ouvrables > 1 ? "s" : ""} (lundi → samedi)
            </p>
          )}
          {creneaux.length > 0 && (
            <div className="banner" style={{ margin: 0, background: "var(--yellow)", borderColor: "#eedda6" }}>
              <span>
                Tu es prévu(e) au planning pendant cette période :{" "}
                {creneaux
                  .slice(0, 4)
                  .map((c) => `${depuisIso(c.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })} ${hm(c.heure_debut)}–${hm(c.heure_fin)}`)
                  .join(", ")}
                {creneaux.length > 4 ? `… (+${creneaux.length - 4})` : ""}. Ton responsable devra te remplacer.
              </span>
            </div>
          )}
          {motif !== "maladie" && (
            <p className="hint">
              Sans réponse sous {DELAI_TACITE_JOURS} jours, la demande est validée automatiquement.
              {motif === "conge_paye" ? " Pense à prévenir au moins un mois à l'avance." : ""}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="form-2">
            <div className="field">
              <label htmlFor="d-montant">Montant (€)</label>
              <input id="d-montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="200" />
            </div>
            <div className="field">
              <label htmlFor="d-date">Souhaité pour le</label>
              <input id="d-date" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
            </div>
          </div>
          <p className="hint">L&apos;acompte est déduit de ton prochain salaire. Il doit être validé par ton responsable.</p>
        </>
      )}

      <div className="field">
        <label htmlFor="d-detail">{type === "conge" && motif === "autre" ? "Précise le motif *" : "Message pour ton responsable (facultatif)"}</label>
        <input id="d-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} />
      </div>

      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
