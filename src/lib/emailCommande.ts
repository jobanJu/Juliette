// Contenu de l'e-mail de commande envoyé à un fournisseur (texte et HTML). Pur : testable, et
// utilisé côté serveur par /api/commandes/envoyer.

export type LigneEmail = { nom: string; unite: string; quantite: number; prixUnitaireHT?: number; reference?: string | null };

export type DonneesEmail = {
  etablissement: string;
  adresse: string | null;
  telephone: string | null;
  fournisseur: string;
  signataire: string;
  date: Date;
  lignes: LigneEmail[];
};

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const qte = (n: number) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function sujetCommande(d: DonneesEmail) {
  return `Commande ${d.etablissement} du ${d.date.toLocaleDateString("fr-FR")}`;
}

export function totalHT(lignes: LigneEmail[]) {
  return lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prixUnitaireHT ?? 0), 0);
}

export function texteCommande(d: DonneesEmail) {
  const total = totalHT(d.lignes);
  return [
    `Bonjour,`,
    ``,
    `Merci de nous livrer la commande suivante pour ${d.etablissement} :`,
    ``,
    ...d.lignes.map((l) => `- ${l.nom}${l.reference ? ` (réf. ${l.reference})` : ""} : ${qte(l.quantite)} ${l.unite}`),
    ``,
    ...(total > 0 ? [`Montant estimé : ${eur(total)} HT.`] : []),
    `Merci de nous confirmer la date de livraison.`,
    ``,
    `Cordialement,`,
    d.signataire,
    d.etablissement,
    ...(d.adresse ? [d.adresse] : []),
    ...(d.telephone ? [d.telephone] : []),
  ].join("\n");
}

export function htmlCommande(d: DonneesEmail) {
  const total = totalHT(d.lignes);
  const lignes = d.lignes
    .map(
      (l) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee">${echapper(l.nom)}${l.reference ? `<br><span style="color:#888;font-size:12px">réf. ${echapper(l.reference)}</span>` : ""}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap"><b>${qte(l.quantite)}</b> ${echapper(l.unite)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#272435;max-width:560px">
<p>Bonjour,</p>
<p>Merci de nous livrer la commande suivante pour <b>${echapper(d.etablissement)}</b> :</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">${lignes}</table>
${total > 0 ? `<p style="margin-top:14px">Montant estimé : <b>${eur(total)} HT</b>.</p>` : ""}
<p>Merci de nous confirmer la date de livraison.</p>
<p>Cordialement,<br>${echapper(d.signataire)}<br><b>${echapper(d.etablissement)}</b>${d.adresse ? `<br>${echapper(d.adresse)}` : ""}${d.telephone ? `<br>${echapper(d.telephone)}` : ""}</p>
</div>`;
}
