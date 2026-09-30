// E-mails de service envoyés par Juliette elle-même (mot de passe oublié, bienvenue…), via Mailjet.
// Serveur uniquement. Variables : MAILJET_API_KEY, MAILJET_API_SECRET et EMAIL_SERVICE_EXPEDITEUR,
// une adresse validée dans Mailjet (par exemple bonjour@<domaine de Juliette>).

const cle = process.env.MAILJET_API_KEY?.trim();
const secret = process.env.MAILJET_API_SECRET?.trim();
const expediteur = process.env.EMAIL_SERVICE_EXPEDITEUR?.trim();

export const emailServiceConfigure = () => Boolean(cle && secret && expediteur);

export async function envoyerEmailService(m: { a: string; sujet: string; texte: string; html: string }): Promise<boolean> {
  if (!emailServiceConfigure()) return false;
  const r = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${cle}:${secret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ Messages: [{ From: { Email: expediteur, Name: "Juliette" }, To: [{ Email: m.a }], Subject: m.sujet, TextPart: m.texte, HTMLPart: m.html }] }),
  }).catch(() => null);
  if (!r?.ok) return false;
  const corps = (await r.json().catch(() => ({}))) as { Messages?: { Status?: string }[] };
  return corps.Messages?.[0]?.Status === "success";
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Mise en page commune des e-mails de service : un titre, un texte, un bouton. */
export function gabaritEmail(titre: string, paragraphes: string[], bouton: { texte: string; lien: string }, pied: string) {
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#272435;max-width:520px;margin:0 auto;padding:24px">
<p style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#4b36a8;margin:0 0 20px">Juliette</p>
<h1 style="font-size:20px;margin:0 0 14px">${echapper(titre)}</h1>
${paragraphes.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${echapper(p)}</p>`).join("")}
<p style="margin:22px 0"><a href="${echapper(bouton.lien)}" style="display:inline-block;background:#7357d9;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${echapper(bouton.texte)}</a></p>
<p style="font-size:13px;color:#8d899c;line-height:1.5;margin:0">${echapper(pied)}</p>
</div>`;
  const texte = [titre, "", ...paragraphes, "", `${bouton.texte} : ${bouton.lien}`, "", pied].join("\n");
  return { html, texte };
}
