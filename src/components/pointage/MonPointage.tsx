"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { formatDuree, hm } from "@/lib/planning";
import type { Creneau } from "@/lib/planning";
import { actionsPossibles, ecartMinutes, etatService, heure, LIBELLE_TYPE, minutesPause, minutesService, TOLERANCE_MIN } from "@/lib/pointage";
import type { Service, TypePointage } from "@/lib/pointage";

type Props = {
  etablissementId: string;
  compteId: string;
  prenom: string;
  jour: string;
  service: Service | undefined; // service du jour (ou encore ouvert)
  creneaux: Creneau[]; // créneaux prévus aujourd'hui
  pauseActive: boolean;
  onPointe: (message: string) => void;
};

const BOUTON: Record<TypePointage, { label: string; classe: string; icone: string }> = {
  arrivee: { label: "Pointer mon arrivée", classe: "btn-primary", icone: "→" },
  depart: { label: "Pointer mon départ", classe: "btn-primary", icone: "⇥" },
  pause_debut: { label: "Commencer ma pause", classe: "", icone: "❚❚" },
  pause_fin: { label: "Reprendre le service", classe: "btn-primary", icone: "▶" },
};

export default function MonPointage(p: Props) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [attente, setAttente] = useState<{ type: TypePointage; raison: string } | null>(null);
  const [justificatif, setJustificatif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const etat = etatService(p.service);
  const actions = actionsPossibles(etat, p.pauseActive);
  const shifts = p.creneaux.filter((c) => c.type === "shift").sort((a, b) => (a.heure_debut ?? "").localeCompare(b.heure_debut ?? ""));
  const absence = p.creneaux.find((c) => c.type !== "shift");
  const nowIso = new Date(maintenant).toISOString();

  // Créneau de référence : le premier dont la fin n'est pas encore passée (ou le dernier).
  const reference = shifts.find((c) => ecartMinutes(nowIso, c.heure_fin!, p.jour) < 0 || (c.heure_fin! <= c.heure_debut!)) ?? shifts[shifts.length - 1];

  function motifAttendu(type: TypePointage): string | null {
    if (!reference) return type === "arrivee" && (absence || shifts.length === 0) ? "Tu n'es pas prévu(e) au planning aujourd'hui." : null;
    if (type === "arrivee") {
      const e = ecartMinutes(nowIso, reference.heure_debut!, p.jour);
      return e > TOLERANCE_MIN ? `Tu arrives avec ${formatDuree(e)} de retard sur ton créneau de ${hm(reference.heure_debut)}.` : null;
    }
    if (type === "depart" && reference.heure_fin! > reference.heure_debut!) {
      const e = ecartMinutes(nowIso, reference.heure_fin!, p.jour);
      return e < -TOLERANCE_MIN ? `Tu pars ${formatDuree(-e)} avant la fin prévue (${hm(reference.heure_fin)}).` : null;
    }
    return null;
  }

  async function pointer(type: TypePointage, motif: string | null) {
    setErreur(null);
    setEnvoi(true);
    const { error } = await getSupabaseClient()!
      .from("pointages")
      .insert({
        etablissement_id: p.etablissementId,
        compte_id: p.compteId,
        type,
        horodatage: new Date().toISOString(), // remplacé par l'heure du serveur pour les salariés
        manuel: false,
        created_by: p.compteId,
        justificatif: motif?.trim() || null,
      });
    setEnvoi(false);
    if (error) return setErreur("Pointage refusé. Vérifie ta connexion puis réessaie.");
    setAttente(null);
    setJustificatif("");
    p.onPointe(`${LIBELLE_TYPE[type]} enregistrée à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
  }

  function cliquer(type: TypePointage) {
    const raison = motifAttendu(type);
    if (raison) {
      setAttente({ type, raison });
      setJustificatif("");
    } else pointer(type, null);
  }

  const travaille = p.service ? minutesService(p.service, maintenant) : 0;
  const pause = p.service ? minutesPause(p.service, maintenant) : 0;
  const statut =
    etat === "service"
      ? `En service depuis ${heure(p.service!.arrivee.horodatage)}`
      : etat === "pause"
        ? `En pause depuis ${heure(p.service!.pauses.find((x) => !x.fin)!.debut.horodatage)}`
        : etat === "termine"
          ? `Service terminé à ${heure(p.service!.depart!.horodatage)}`
          : "Pas encore pointé aujourd'hui";

  return (
    <section className={`card punch punch-${etat}`}>
      <div className="punch-main">
        <div>
          <p className="eyebrow">Mon pointage</p>
          <div className="punch-clock" aria-live="off">
            {new Date(maintenant).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            <small>{String(new Date(maintenant).getSeconds()).padStart(2, "0")}</small>
          </div>
          <div className="punch-status">
            <span className="punch-dot" />
            {statut}
          </div>
        </div>

        <div className="punch-actions">
          {attente ? (
            <div className="punch-reason">
              <p>{attente.raison}</p>
              <label htmlFor="justif">Un mot pour ton responsable (facultatif)</label>
              <input id="justif" value={justificatif} onChange={(e) => setJustificatif(e.target.value)} placeholder="Ex. : bus en retard, échange avec un collègue…" maxLength={200} autoFocus />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setAttente(null)} disabled={envoi}>
                  Annuler
                </button>
                <button className="btn btn-primary" onClick={() => pointer(attente.type, justificatif)} disabled={envoi} style={{ flex: 1 }}>
                  {envoi ? "Enregistrement…" : `Confirmer : ${LIBELLE_TYPE[attente.type].toLowerCase()}`}
                </button>
              </div>
            </div>
          ) : (
            actions.map((a) => (
              <button key={a} className={`btn punch-btn ${BOUTON[a].classe}`} onClick={() => cliquer(a)} disabled={envoi}>
                <span aria-hidden>{BOUTON[a].icone}</span> {etat === "termine" && a === "arrivee" ? "Reprendre un service" : BOUTON[a].label}
              </button>
            ))
          )}
          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
        </div>
      </div>

      <div className="punch-foot">
        <div>
          <small>Prévu aujourd&apos;hui</small>
          <b>
            {shifts.length
              ? shifts.map((c) => `${hm(c.heure_debut)}–${hm(c.heure_fin)}`).join(" · ")
              : absence
                ? absence.type === "repos"
                  ? "Repos"
                  : "Absence"
                : "Rien au planning"}
          </b>
        </div>
        <div>
          <small>Temps travaillé</small>
          <b>{formatDuree(travaille)}</b>
        </div>
        <div>
          <small>Pauses</small>
          <b>{pause ? formatDuree(pause) : "—"}</b>
        </div>
        <div>
          <small>Pointages</small>
          <b>{p.service ? p.service.evenements.map((e) => heure(e.horodatage)).join(" · ") : "—"}</b>
        </div>
      </div>
    </section>
  );
}
