// Messagerie : types, pièces jointes et suivi des messages lus.
// Le format des pièces jointes est celui de l'ancien site ({ name, dataUrl, kind }), pour que les
// deux versions lisent les mêmes messages.

export type Groupe = {
  id: string;
  nom: string;
  est_direct: boolean;
  ouvert_a_tous: boolean;
  created_by: string | null;
  created_at: string;
};

export type Membre = { group_id: string; compte_id: string; est_admin: boolean };

export type PieceJointe = { name: string; dataUrl: string; kind: "image" | "file" };

export type Message = {
  id: string;
  group_id: string;
  compte_id: string;
  texte: string;
  attachments: PieceJointe[] | null;
  created_at: string;
};

export const COLONNES_MESSAGE = "id, group_id, compte_id, texte, attachments, created_at";
export const TAILLE_MAX_FICHIER = 2 * 1024 * 1024;
const COTE_MAX_IMAGE = 1600;

/** Lit un fichier choisi ou collé ; les images sont réduites (1600 px, JPEG) pour rester légères. */
export function lirePieceJointe(fichier: File): Promise<PieceJointe> {
  if (fichier.type.startsWith("image/") && fichier.type !== "image/gif") {
    return new Promise((ok, ko) => {
      const lecteur = new FileReader();
      lecteur.onerror = () => ko(new Error("Image illisible"));
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = () => ko(new Error("Image illisible"));
        img.onload = () => {
          const r = Math.min(1, COTE_MAX_IMAGE / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * r);
          c.height = Math.round(img.height * r);
          const ctx = c.getContext("2d");
          if (!ctx) return ko(new Error("Redimensionnement impossible"));
          ctx.drawImage(img, 0, 0, c.width, c.height);
          ok({ name: fichier.name || "photo.jpg", dataUrl: c.toDataURL("image/jpeg", 0.82), kind: "image" });
        };
        img.src = lecteur.result as string;
      };
      lecteur.readAsDataURL(fichier);
    });
  }
  if (fichier.size > TAILLE_MAX_FICHIER) return Promise.reject(new Error("Fichier trop lourd (2 Mo maximum)"));
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => ko(new Error("Lecture du fichier impossible"));
    lecteur.onload = () => ok({ name: fichier.name, dataUrl: lecteur.result as string, kind: fichier.type.startsWith("image/") ? "image" : "file" });
    lecteur.readAsDataURL(fichier);
  });
}

// Messages lus : mémorisés sur l'appareil (dernière date vue par conversation).
const cleLus = (compteId: string) => `juliette.lus.${compteId}`;

export function lireLus(compteId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(cleLus(compteId)) ?? "{}");
  } catch {
    return {};
  }
}

export function marquerLu(compteId: string, groupId: string, quand: string) {
  try {
    const lus = lireLus(compteId);
    if ((lus[groupId] ?? "") >= quand) return;
    lus[groupId] = quand;
    localStorage.setItem(cleLus(compteId), JSON.stringify(lus));
  } catch {}
}

export function heureMessage(iso: string) {
  const d = new Date(iso);
  const auj = new Date();
  const hier = new Date(auj.getTime() - 864e5);
  if (d.toDateString() === auj.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hier.toDateString()) return "hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function jourMessage(iso: string) {
  const d = new Date(iso);
  const auj = new Date();
  if (d.toDateString() === auj.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === new Date(auj.getTime() - 864e5).toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Rend les liens cliquables sans interpréter de HTML. */
export function morceauxTexte(texte: string) {
  return texte.split(/(https?:\/\/[^\s]+)/g).map((t, i) => ({ t, lien: i % 2 === 1 }));
}
