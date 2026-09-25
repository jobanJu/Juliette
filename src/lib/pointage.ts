// Pointage : reconstitution des services à partir des événements bruts (arrivée, pauses, départ).
// Fonctions pures, sans accès réseau.

export type TypePointage = "arrivee" | "depart" | "pause_debut" | "pause_fin";

export type PointageBrut = {
  id: string;
  compte_id: string;
  type: TypePointage;
  horodatage: string;
  manuel: boolean;
  justificatif: string | null;
  responsable_id: string | null;
};

export type Service = {
  compteId: string;
  date: string; // jour de l'arrivée, AAAA-MM-JJ (heure locale)
  arrivee: PointageBrut;
  depart: PointageBrut | null;
  pauses: { debut: PointageBrut; fin: PointageBrut | null }[];
  evenements: PointageBrut[];
};

export type Etat = "absent" | "service" | "pause" | "termine";

export const LIBELLE_TYPE: Record<TypePointage, string> = {
  arrivee: "Arrivée",
  depart: "Départ",
  pause_debut: "Début de pause",
  pause_fin: "Fin de pause",
};

/** Tolérance avant de considérer une arrivée en retard ou un départ anticipé. */
export const TOLERANCE_MIN = 5;

const t = (p: PointageBrut) => new Date(p.horodatage).getTime();

function jourLocal(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Regroupe les pointages en services. Les événements orphelins (départ sans arrivée) sont ignorés. */
export function services(pointages: PointageBrut[]): Service[] {
  const res: Service[] = [];
  const ouverts = new Map<string, Service>();
  for (const p of [...pointages].sort((a, b) => a.horodatage.localeCompare(b.horodatage))) {
    const s = ouverts.get(p.compte_id);
    if (p.type === "arrivee") {
      const nouveau: Service = { compteId: p.compte_id, date: jourLocal(t(p)), arrivee: p, depart: null, pauses: [], evenements: [p] };
      res.push(nouveau);
      ouverts.set(p.compte_id, nouveau);
      continue;
    }
    if (!s) continue;
    s.evenements.push(p);
    const pauseOuverte = s.pauses.find((x) => !x.fin);
    if (p.type === "pause_debut" && !pauseOuverte) s.pauses.push({ debut: p, fin: null });
    else if (p.type === "pause_fin" && pauseOuverte) pauseOuverte.fin = p;
    else if (p.type === "depart") {
      if (pauseOuverte) pauseOuverte.fin = p;
      s.depart = p;
      ouverts.delete(p.compte_id);
    }
  }
  return res;
}

/** Minutes travaillées d'un service, pauses déduites. Un service en cours est compté jusqu'à `maintenant`. */
export function minutesService(s: Service, maintenant = Date.now()) {
  const fin = s.depart ? t(s.depart) : maintenant;
  const pauses = s.pauses.reduce((tot, p) => tot + ((p.fin ? t(p.fin) : maintenant) - t(p.debut)), 0);
  return Math.max(0, (fin - t(s.arrivee) - pauses) / 60000);
}

export function minutesPause(s: Service, maintenant = Date.now()) {
  return s.pauses.reduce((tot, p) => tot + ((p.fin ? t(p.fin) : maintenant) - t(p.debut)) / 60000, 0);
}

export function etatService(s: Service | undefined): Etat {
  if (!s) return "absent";
  if (s.depart) return "termine";
  return s.pauses.some((p) => !p.fin) ? "pause" : "service";
}

/** Prochain pointage logique selon l'état, dans l'ordre d'importance pour l'interface. */
export function actionsPossibles(etat: Etat, pauseActive: boolean): TypePointage[] {
  if (etat === "service") return pauseActive ? ["depart", "pause_debut"] : ["depart"];
  if (etat === "pause") return ["pause_fin"];
  return ["arrivee"];
}

export function heure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Écart en minutes entre un horodatage et une heure prévue (HH:MM[:SS]) le même jour ; positif = en retard. */
export function ecartMinutes(horodatage: string, heurePrevue: string, date: string) {
  const [h, m] = heurePrevue.split(":").map(Number);
  const [a, mo, j] = date.split("-").map(Number);
  const prevu = new Date(a, mo - 1, j, h, m).getTime();
  return Math.round((new Date(horodatage).getTime() - prevu) / 60000);
}

/** Au-delà, un service sans départ est un oubli de pointage, pas un service en cours. */
export const DUREE_MAX_SERVICE_H = 16;

/** Services vus « aujourd'hui » : commencés aujourd'hui, ou service de nuit encore ouvert depuis la veille. */
export function servicesDuJour(tous: Service[], jour: string, maintenant = Date.now()) {
  return tous.filter(
    (s) => s.date === jour || (!s.depart && s.date < jour && maintenant - t(s.arrivee) < DUREE_MAX_SERVICE_H * 3600000),
  );
}

export function csv(lignes: (string | number)[][]) {
  return lignes.map((l) => l.map((c) => (/[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(";")).join("\n");
}
