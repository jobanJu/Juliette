// Boîte mail : adresses de réception et lecture des e-mails transmis par le prestataire.
// Pur (pas d'accès réseau) : utilisé par /api/emails/entrants et par l'envoi des commandes.
//
// Adresse d'un établissement : « <code>.<jeton>@<domaine> », ex. demo02.x7k2p9ab@reponses.juliette.app.
// Le code rend l'adresse lisible ; le jeton (aléatoire) empêche de deviner celle d'un autre restaurant.

export type PieceJointe = { nom: string; type: string; contenuBase64: string };
export type EmailEntrant = { deEmail: string; deNom: string | null; a: string[]; sujet: string; texte: string; html: string | null; pieces: PieceJointe[] };

export function adresseReception(code: string, jeton: string, domaine: string) {
  return `${code.toLowerCase().replace(/[^a-z0-9-]/g, "")}.${jeton}@${domaine}`;
}

/** Retrouve le jeton d'établissement dans une adresse de destination (ignore le « +suffixe »). */
export function jetonDepuisAdresse(adresse: string, domaine: string) {
  const m = adresse.trim().toLowerCase().match(/^([^@\s]+)@([^>\s]+)$/);
  if (!m || m[2] !== domaine.toLowerCase()) return null;
  const local = m[1].split("+")[0];
  const jeton = local.split(".").pop();
  return jeton && /^[a-z0-9]{6,32}$/.test(jeton) ? jeton : null;
}

/** Référence courte d'une commande, reprise dans le sujet pour rattacher la réponse. */
export const refCommande = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();
export function refDepuisSujet(sujet: string) {
  return sujet.match(/r[ée]f\.?\s*([0-9A-F]{8})\b/i)?.[1]?.toUpperCase() ?? null;
}

/** « Nom <adresse@x.fr> » → { email, nom } */
export function analyserAdresse(s: string): { email: string; nom: string | null } {
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim().toLowerCase(), nom: m[1].trim() || null };
  return { email: s.trim().toLowerCase(), nom: null };
}

const listeAdresses = (s: unknown) =>
  String(s ?? "")
    .split(",")
    .map((x) => analyserAdresse(x).email)
    .filter((x) => x.includes("@"));

/** Accepte le format Mailjet (Parse API), Postmark (inbound) ou un format simple { from, to, subject, text, html }. */
export function normaliserEntrant(p: Record<string, unknown>): EmailEntrant | null {
  // Postmark
  if (p.FromFull || p.TextBody !== undefined) {
    const de = (p.FromFull as { Email?: string; Name?: string }) ?? analyserAdresse(String(p.From ?? ""));
    const email = "Email" in de ? de.Email : (de as { email: string }).email;
    if (!email) return null;
    const pieces = ((p.Attachments as { Name: string; Content: string; ContentType: string }[]) ?? []).map((a) => ({ nom: a.Name, type: a.ContentType, contenuBase64: a.Content }));
    return {
      deEmail: String(email).toLowerCase(),
      deNom: ("Name" in de ? de.Name : (de as { nom: string | null }).nom) || null,
      a: [...listeAdresses(p.OriginalRecipient), ...listeAdresses(p.To)],
      sujet: String(p.Subject ?? ""),
      texte: String(p.TextBody ?? ""),
      html: p.HtmlBody ? String(p.HtmlBody) : null,
      pieces,
    };
  }
  // Mailjet Parse API
  if (p["Text-part"] !== undefined || p.Sender !== undefined) {
    const de = analyserAdresse(String(p.From ?? p.Sender ?? ""));
    if (!de.email.includes("@")) return null;
    const parts = (p.Parts as { Headers?: Record<string, string>; ContentRef?: string }[]) ?? [];
    const pieces: PieceJointe[] = [];
    for (const [k, v] of Object.entries(p)) {
      if (!/^Attachment\d+$/.test(k) || typeof v !== "string") continue;
      const part = parts.find((x) => x.ContentRef === k);
      const ct = part?.Headers?.["Content-Type"] ?? "application/octet-stream";
      const nom = ct.match(/name="?([^";]+)"?/i)?.[1] ?? part?.Headers?.["Content-Disposition"]?.match(/filename="?([^";]+)"?/i)?.[1] ?? k;
      pieces.push({ nom, type: ct.split(";")[0].trim(), contenuBase64: v });
    }
    return {
      deEmail: de.email,
      deNom: de.nom,
      a: [...listeAdresses(p.Recipient), ...listeAdresses((p.Headers as Record<string, string> | undefined)?.To)],
      sujet: String(p.Subject ?? ""),
      texte: String(p["Text-part"] ?? ""),
      html: p["Html-part"] ? String(p["Html-part"]) : null,
      pieces,
    };
  }
  // Format simple (tests, autre prestataire)
  if (p.from && p.to) {
    const de = analyserAdresse(String(p.from));
    return { deEmail: de.email, deNom: de.nom, a: listeAdresses(p.to), sujet: String(p.subject ?? ""), texte: String(p.text ?? ""), html: p.html ? String(p.html) : null, pieces: [] };
  }
  return null;
}

/** Nom de fichier sûr pour le stockage. */
export const nomFichierSur = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "piece-jointe";
