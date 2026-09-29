// Planning : types et calculs purs (semaines, durées, heures pointées). Aucun accès réseau ici.

export type TypeCreneau = "shift" | "repos" | "conge";

export type Creneau = {
  id: string;
  compte_id: string;
  date: string; // AAAA-MM-JJ
  type: TypeCreneau;
  heure_debut: string | null; // HH:MM:SS
  heure_fin: string | null;
  pause_minutes: number | null;
  motif: string | null;
  note: string | null;
};

export type Pointage = { compte_id: string; type: "arrivee" | "depart" | "pause_debut" | "pause_fin"; horodatage: string };
export type CongeValide = { compte_id: string; date_debut: string; date_fin: string; motif: string | null };

export const MOTIFS_ABSENCE: Record<string, string> = {
  conge_paye: "Congé payé",
  conge_sans_solde: "Congé sans solde",
  recuperation: "Récupération / RTT",
  maladie: "Arrêt maladie",
  autre: "Autre",
};

export const POSTES: Record<string, { label: string; ton: string }> = {
  management: { label: "Management", ton: "t-lav" },
  salle: { label: "Salle", ton: "t-blue" },
  bar: { label: "Bar", ton: "t-yellow" },
  cuisine: { label: "Cuisine", ton: "t-peach" },
  plonge: { label: "Plonge", ton: "t-mint" },
  extra: { label: "Extra", ton: "t-red" },
};
export const ORDRE_POSTES = ["management", "salle", "bar", "cuisine", "plonge", "extra"];

export const JOURS_COURTS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function depuisIso(s: string) {
  const [a, m, j] = s.split("-").map(Number);
  return new Date(a, m - 1, j);
}

export function ajouterJours(s: string, n: number) {
  const d = depuisIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Lundi de la semaine contenant d. */
export function lundi(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return iso(r);
}

export function joursDeLaSemaine(lundiIso: string) {
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundiIso, i));
}

export function libelleSemaine(lundiIso: string) {
  const debut = depuisIso(lundiIso);
  const fin = depuisIso(ajouterJours(lundiIso, 6));
  const f = (d: Date, mois: boolean) => d.toLocaleDateString("fr-FR", mois ? { day: "numeric", month: "long" } : { day: "numeric" });
  return debut.getMonth() === fin.getMonth() ? `${f(debut, false)} – ${f(fin, true)}` : `${f(debut, true)} – ${f(fin, true)}`;
}

function minutes(h: string) {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

/** Durée travaillée d'un créneau en minutes, pause déduite. Un créneau qui finit à ou avant son début passe minuit. */
export function dureeCreneau(c: Pick<Creneau, "type" | "heure_debut" | "heure_fin" | "pause_minutes">) {
  if (c.type !== "shift" || !c.heure_debut || !c.heure_fin) return 0;
  let d = minutes(c.heure_fin) - minutes(c.heure_debut);
  if (d <= 0) d += 24 * 60;
  return Math.max(0, d - (c.pause_minutes ?? 0));
}

/** Coupures d'une journée : les temps morts entre deux services successifs (en minutes). */
export function coupuresDuJour(l: Pick<Creneau, "type" | "heure_debut" | "heure_fin">[]) {
  const services = l
    .filter((c) => c.type === "shift" && c.heure_debut && c.heure_fin)
    .map((c) => {
      const a = minutes(c.heure_debut!);
      let b = minutes(c.heure_fin!);
      if (b <= a) b += 1440;
      return [a, b] as const;
    })
    .sort((x, y) => x[0] - y[0]);
  const res: { apres: number; minutes: number }[] = [];
  for (let i = 1; i < services.length; i++) {
    const trou = services[i][0] - services[i - 1][1];
    if (trou > 0) res.push({ apres: i - 1, minutes: trou });
  }
  const amplitude = services.length ? services[services.length - 1][1] - services[0][0] : 0;
  return { coupures: res, amplitude };
}

/** Repères HCR (convention collective hôtels-cafés-restaurants) : une seule coupure par jour, amplitude 13 h max. */
export const AMPLITUDE_MAX_MIN = 13 * 60;
export function alertesCoupure(l: Pick<Creneau, "type" | "heure_debut" | "heure_fin">[]) {
  const { coupures, amplitude } = coupuresDuJour(l);
  const a: string[] = [];
  if (coupures.length > 1) a.push(`${coupures.length} coupures dans la journée (1 maximum en HCR)`);
  if (amplitude > AMPLITUDE_MAX_MIN) a.push(`amplitude de ${formatDuree(amplitude)} (13h maximum)`);
  return a;
}

export function hm(h: string | null) {
  return h ? h.slice(0, 5) : "";
}

export function formatDuree(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Minutes réellement pointées par compte et par jour : arrivée → départ, pauses déduites. */
export function minutesPointees(pointages: Pointage[]) {
  const res = new Map<string, number>(); // clé `${compte}|${date}`
  const tries = [...pointages].sort((a, b) => a.horodatage.localeCompare(b.horodatage));
  const ouvert = new Map<string, { debut: number; date: string; enPause: number | null; pauses: number }>();
  for (const p of tries) {
    const t = new Date(p.horodatage).getTime();
    const o = ouvert.get(p.compte_id);
    if (p.type === "arrivee") {
      ouvert.set(p.compte_id, { debut: t, date: iso(new Date(t)), enPause: null, pauses: 0 });
    } else if (!o) {
      continue;
    } else if (p.type === "pause_debut") {
      o.enPause = t;
    } else if (p.type === "pause_fin" && o.enPause !== null) {
      o.pauses += t - o.enPause;
      o.enPause = null;
    } else if (p.type === "depart") {
      const fin = o.enPause ?? t;
      const k = `${p.compte_id}|${o.date}`;
      res.set(k, (res.get(k) ?? 0) + Math.max(0, (fin - o.debut - o.pauses) / 60000));
      ouvert.delete(p.compte_id);
    }
  }
  return res;
}

/** Les créneaux les plus utilisés, pour les proposer en un clic. */
export function creneauxFrequents(creneaux: Creneau[], n = 6) {
  const compte = new Map<string, { debut: string; fin: string; pause: number; nb: number }>();
  for (const c of creneaux) {
    if (c.type !== "shift" || !c.heure_debut || !c.heure_fin) continue;
    const k = `${hm(c.heure_debut)}|${hm(c.heure_fin)}|${c.pause_minutes ?? 0}`;
    const e = compte.get(k) ?? { debut: hm(c.heure_debut), fin: hm(c.heure_fin), pause: c.pause_minutes ?? 0, nb: 0 };
    e.nb++;
    compte.set(k, e);
  }
  const res = [...compte.values()].sort((a, b) => b.nb - a.nb).slice(0, n);
  const defauts = [
    { debut: "09:00", fin: "15:00", pause: 0 },
    { debut: "11:00", fin: "15:00", pause: 0 },
    { debut: "18:00", fin: "23:00", pause: 0 },
    { debut: "10:00", fin: "18:00", pause: 30 },
  ];
  for (const d of defauts) {
    if (res.length >= n) break;
    if (!res.some((r) => r.debut === d.debut && r.fin === d.fin)) res.push({ ...d, nb: 0 });
  }
  return res.sort((a, b) => a.debut.localeCompare(b.debut));
}

export function congeLe(conges: CongeValide[], compteId: string, date: string) {
  return conges.find((c) => c.compte_id === compteId && c.date_debut <= date && c.date_fin >= date);
}
