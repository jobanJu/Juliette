// Suggestion de planning : propose une semaine à partir de ce que l'équipe fait d'habitude.
//
// Le « modèle » est l'historique lui-même : pour chaque personne et chaque jour de la semaine, on
// regarde les 8 dernières semaines (souvent travaillé le mardi ? avec quels horaires ?). Chaque
// planning validé enrichit donc les suggestions suivantes, sans réglage.
// Ensuite on ajuste :
//   * aux heures contrat (on retire les jours les moins habituels si ça dépasse, on en ajoute si
//     c'est très en dessous) ;
//   * aux congés validés et aux cases déjà remplies (jamais écrasées) ;
//   * aux événements (Braderie, match, jour férié…) : un jour de forte affluence rappelle aussi
//     les personnes qui y viennent parfois ; un jour creux ne garde que les habitués.

import { ajouterJours, congeLe, depuisIso, dureeCreneau, hm } from "@/lib/planning";
import type { CongeValide, Creneau } from "@/lib/planning";
import type { Repere } from "@/lib/evenements";

export type Service = { debut: string; fin: string; pause: number };
export type Proposition = {
  compteId: string;
  date: string;
  services: Service[];
  minutes: number;
  /** Semaines où la personne a travaillé ce jour-là / semaines observées. */
  frequence: number;
  observees: number;
  raison: string;
};

export type JourEvenement = Pick<Repere, "nom" | "sens" | "impact"> & { date: string; date_fin?: string | null };

const SEMAINES = 8;
const SEUIL = 0.5;
const SEUIL_AFFLUENCE = 0.25;
const SEUIL_CREUX = 0.75;
const NOMS_JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

type Membre = { id: string; heures_contrat: number | null };

/** Clé d'une journée type : ses services triés (« 10:00-15:00/0|18:00-23:00/0 » pour une coupure). */
function cleJournee(l: Creneau[]) {
  return l
    .filter((c) => c.type === "shift" && c.heure_debut && c.heure_fin)
    .map((c) => `${hm(c.heure_debut)}-${hm(c.heure_fin)}/${c.pause_minutes ?? 0}`)
    .sort()
    .join("|");
}

function depuisCle(k: string): Service[] {
  return k.split("|").map((s) => {
    const [h, pause] = s.split("/");
    const [debut, fin] = h.split("-");
    return { debut, fin, pause: Number(pause) };
  });
}

const minutesServices = (s: Service[]) => s.reduce((t, x) => t + dureeCreneau({ type: "shift", heure_debut: x.debut, heure_fin: x.fin, pause_minutes: x.pause }), 0);

export function evenementsDuJour(evts: JourEvenement[], jour: string) {
  return evts.filter((e) => e.date <= jour && (e.date_fin ?? e.date) >= jour);
}

function tendance(evts: JourEvenement[]) {
  const forts = evts.filter((e) => e.impact !== "faible");
  if (forts.some((e) => e.sens === "hausse")) return "hausse";
  if (forts.some((e) => e.sens === "baisse")) return "baisse";
  return null;
}

export function suggererSemaine(p: {
  semaine: string[];
  membres: Membre[];
  historique: Creneau[];
  existants: Creneau[];
  conges: CongeValide[];
  evenements: JourEvenement[];
}): Proposition[] {
  const debutHisto = ajouterJours(p.semaine[0], -7 * SEMAINES);
  const passe = p.historique.filter((c) => c.date >= debutHisto && c.date < p.semaine[0] && c.type === "shift");
  const occupe = new Set(p.existants.map((c) => `${c.compte_id}|${c.date}`));
  const res: Proposition[] = [];

  for (const m of p.membres) {
    const siens = passe.filter((c) => c.compte_id === m.id);
    if (!siens.length) continue;
    // Semaines observées : depuis sa première journée travaillée (un nouveau n'a pas 8 semaines).
    const premier = siens.reduce((a, c) => (c.date < a ? c.date : a), siens[0].date);
    const observees = Math.max(1, Math.min(SEMAINES, Math.ceil((depuisIso(p.semaine[0]).getTime() - depuisIso(premier).getTime()) / (7 * 864e5))));

    const parDate = new Map<string, Creneau[]>();
    for (const c of siens) parDate.set(c.date, [...(parDate.get(c.date) ?? []), c]);

    const candidats: Proposition[] = [];
    const secours: Proposition[] = []; // jours « parfois » : servent à compléter un contrat très en dessous
    for (const jour of p.semaine) {
      if (occupe.has(`${m.id}|${jour}`) || congeLe(p.conges, m.id, jour)) continue;
      const jds = depuisIso(jour).getDay();
      const journees = [...parDate.entries()].filter(([d]) => depuisIso(d).getDay() === jds).map(([, l]) => cleJournee(l)).filter(Boolean);
      if (!journees.length) continue;
      const compte = new Map<string, number>();
      for (const k of journees) compte.set(k, (compte.get(k) ?? 0) + 1);
      const [cle, nb] = [...compte.entries()].sort((a, b) => b[1] - a[1])[0];
      const services = depuisCle(cle);
      const evts = evenementsDuJour(p.evenements, jour);
      const t = tendance(evts);
      const frequence = journees.length / observees;
      const seuil = t === "hausse" ? SEUIL_AFFLUENCE : t === "baisse" ? SEUIL_CREUX : SEUIL;
      if (frequence < SEUIL_AFFLUENCE) continue;
      const habitude = `${journees.length}/${observees} ${NOMS_JOURS[jds]}s${nb < journees.length ? `, ces horaires ${nb} fois` : ""}`;
      const raison = t === "hausse" && frequence < SEUIL ? `renfort ${evts.map((e) => e.nom).join(", ")} · vient parfois (${habitude})` : t === "baisse" ? `habitué (${habitude}) · jour creux : ${evts.map((e) => e.nom).join(", ")}` : `habituel (${habitude})`;
      const prop = { compteId: m.id, date: jour, services, minutes: minutesServices(services), frequence, observees, raison };
      if (frequence >= seuil) candidats.push(prop);
      else secours.push({ ...prop, raison: `complète le contrat · vient parfois (${habitude})` });
    }

    // Heures contrat : on retire les jours les moins habituels tant qu'on dépasse de plus de 10 %.
    const contrat = m.heures_contrat != null ? Number(m.heures_contrat) * 60 : null;
    const dejaPose = p.existants.filter((c) => c.compte_id === m.id).reduce((t, c) => t + dureeCreneau(c), 0);
    let garde = candidats;
    if (contrat) {
      garde = [...candidats].sort((a, b) => b.frequence - a.frequence);
      let total = dejaPose + garde.reduce((t, c) => t + c.minutes, 0);
      while (garde.length && total > contrat * 1.1) {
        const retire = garde.pop()!;
        total -= retire.minutes;
      }
      // … et on complète avec les jours « parfois » tant qu'on est sous 80 % du contrat.
      for (const s of secours.sort((a, b) => b.frequence - a.frequence)) {
        if (total >= contrat * 0.8) break;
        if (total + s.minutes > contrat * 1.1) continue;
        garde.push(s);
        total += s.minutes;
      }
    }
    res.push(...garde);
  }
  return res.sort((a, b) => a.date.localeCompare(b.date));
}
