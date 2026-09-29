"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { adresseReception, refCommande } from "@/lib/boiteMail";

type Email = {
  id: string;
  de_email: string;
  de_nom: string | null;
  sujet: string | null;
  texte: string | null;
  html: string | null;
  pieces_jointes: { nom: string; type: string; taille: number; chemin: string }[];
  fournisseur_id: string | null;
  commande_id: string | null;
  lu: boolean;
  archive: boolean;
  recu_at: string;
};
type Filtre = "recus" | "non-lus" | "fournisseurs" | "archives";

const COLONNES = "id, de_email, de_nom, sujet, texte, html, pieces_jointes, fournisseur_id, commande_id, lu, archive, recu_at";
const taille = (o: number) => (o > 1e6 ? `${(o / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1e3))} Ko`);

function quand(at: string) {
  const d = new Date(at);
  const auj = new Date();
  return d.toDateString() === auj.toDateString() ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function BoiteMail() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Map<string, string>>(new Map());
  const [statut, setStatut] = useState<{ configure: boolean; domaine: string | null } | null>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("recus");
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    fetch("/api/emails/entrants")
      .then((r) => r.json())
      .then(setStatut)
      .catch(() => setStatut({ configure: false, domaine: null }));
    sb.from("etablissements")
      .select("boite_mail_jeton")
      .eq("id", etablissement.id)
      .single()
      .then(({ data }) => setJeton(data?.boite_mail_jeton ?? null));
    sb.from("fournisseurs")
      .select("id, nom")
      .eq("etablissement_id", etablissement.id)
      .then(({ data }) => setFournisseurs(new Map((data ?? []).map((f) => [f.id, f.nom]))));
  }, [sb, etablissement.id]);

  useEffect(() => {
    sb.from("emails_recus")
      .select(COLONNES)
      .eq("etablissement_id", etablissement.id)
      .order("recu_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setEmails((data ?? []) as Email[]));
  }, [sb, etablissement.id, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (emails ?? []).filter((e) => {
      if (filtre === "archives" ? !e.archive : e.archive) return false;
      if (filtre === "non-lus" && e.lu) return false;
      if (filtre === "fournisseurs" && !e.fournisseur_id) return false;
      return !q || `${e.de_nom ?? ""} ${e.de_email} ${e.sujet ?? ""} ${e.texte ?? ""}`.toLowerCase().includes(q);
    });
  }, [emails, filtre, recherche]);

  const nonLus = (emails ?? []).filter((e) => !e.lu && !e.archive).length;
  const courant = (emails ?? []).find((e) => e.id === ouvert) ?? null;

  async function maj(e: Email, champs: Partial<Pick<Email, "lu" | "archive">>, message?: string) {
    setEmails((l) => l?.map((x) => (x.id === e.id ? { ...x, ...champs } : x)) ?? null);
    const { error } = await sb.from("emails_recus").update(champs).eq("id", e.id);
    if (error) {
      setToast("Modification refusée");
      recharger();
    } else if (message) setToast(message);
  }

  function ouvrir(e: Email) {
    setOuvert(e.id);
    if (!e.lu) maj(e, { lu: true });
  }

  async function supprimer(e: Email) {
    if (!confirm("Supprimer définitivement cet e-mail ?")) return;
    const { error } = await sb.from("emails_recus").delete().eq("id", e.id);
    if (error) return setToast("Suppression refusée");
    setOuvert(null);
    setToast("E-mail supprimé");
    recharger();
  }

  async function telecharger(chemin: string, nom: string) {
    const { data } = await sb.storage.from("emails").createSignedUrl(chemin, 120, { download: nom });
    if (data?.signedUrl) window.location.assign(data.signedUrl);
    else setToast("Téléchargement impossible");
  }

  const adresse = statut?.domaine && jeton ? adresseReception(etablissement.code, jeton, statut.domaine) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Pilotage</p>
          <h1>Boîte mail {nonLus > 0 && <span className="pill t-peach" style={{ verticalAlign: "middle" }}>{nonLus} non lu(s)</span>}</h1>
          <p>Les réponses des fournisseurs à tes commandes, et tout ce qui est envoyé à l&apos;adresse du restaurant.</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={recharger}>
            ⟳ Actualiser
          </button>
        </div>
      </div>

      {statut && !statut.configure && (
        <section className="card attente-domaine">
          <div className="card-head">
            <h2>📭 En attente du domaine</h2>
            <span className="pill t-yellow">pré-configurée</span>
          </div>
          <p>
            La boîte est prête : dès que le nom de domaine sera branché, chaque commande partira avec l&apos;adresse de réception de {etablissement.nom} en « Répondre à », et les réponses arriveront ici, rangées par fournisseur et par commande.
          </p>
          {gestion && (
            <ol className="hint">
              <li>Créer un sous-domaine de réception (ex. <code>reponses.ton-domaine.fr</code>) et faire pointer ses MX vers le prestataire d&apos;e-mail (Mailjet Parse API ou Postmark).</li>
              <li>
                Dans le prestataire, envoyer les e-mails reçus vers <code>https://&lt;site&gt;/api/emails/entrants?cle=&lt;clé secrète&gt;</code>.
              </li>
              <li>
                Renseigner <code>INBOUND_EMAIL_DOMAIN</code> et <code>INBOUND_EMAIL_SECRET</code> dans Vercel, puis redéployer.
              </li>
            </ol>
          )}
        </section>
      )}
      {adresse && (
        <p className="hint" style={{ margin: "0 0 12px" }}>
          Adresse de réception : <b>{adresse}</b>{" "}
          <button className="btn" style={{ height: 28, marginLeft: 6 }} onClick={() => navigator.clipboard.writeText(adresse).then(() => setToast("Adresse copiée"))}>
            Copier
          </button>
        </p>
      )}

      <div className="mail-barre">
        <div className="seg seg-inline" role="tablist">
          {(
            [
              ["recus", "Reçus"],
              ["non-lus", `Non lus${nonLus ? ` (${nonLus})` : ""}`],
              ["fournisseurs", "Fournisseurs"],
              ["archives", "Archivés"],
            ] as [Filtre, string][]
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filtre === k} className={filtre === k ? "on" : ""} onClick={() => setFiltre(k)}>
              {l}
            </button>
          ))}
        </div>
        <label className="search" style={{ flex: "1 1 200px", maxWidth: 320 }}>
          <span aria-hidden>⌕</span>
          <input placeholder="Rechercher un e-mail" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
      </div>

      <div className={`mail-grid${courant ? " lecture" : ""}`}>
        <section className="card mail-liste">
          {!emails ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
          ) : !visibles.length ? (
            <div className="empty">{emails.length ? "Aucun e-mail dans cette vue." : "Aucun e-mail reçu pour l'instant."}</div>
          ) : (
            visibles.map((e) => (
              <button key={e.id} className={`mail-item${e.id === ouvert ? " on" : ""}${e.lu ? "" : " non-lu"}`} onClick={() => ouvrir(e)}>
                <span className="mail-de">
                  {!e.lu && <i className="mail-point" aria-label="non lu" />}
                  <b>{e.de_nom || e.de_email}</b>
                  <small>{quand(e.recu_at)}</small>
                </span>
                <span className="mail-sujet">{e.sujet || "(sans objet)"}</span>
                <span className="mail-extrait">
                  {e.fournisseur_id && fournisseurs.get(e.fournisseur_id) && <span className="pill t-lav">{fournisseurs.get(e.fournisseur_id)}</span>}
                  {e.pieces_jointes.length > 0 && <span aria-label="pièce jointe">📎</span>}
                  {(e.texte ?? "").replace(/\s+/g, " ").slice(0, 90)}
                </span>
              </button>
            ))
          )}
        </section>

        {courant && (
          <section className="card mail-lecture">
            <div className="mail-lecture-tete">
              <button className="btn mail-retour" onClick={() => setOuvert(null)}>
                ← Retour
              </button>
              <h2>{courant.sujet || "(sans objet)"}</h2>
              <p className="hint">
                <b>{courant.de_nom || courant.de_email}</b> &lt;{courant.de_email}&gt; · {new Date(courant.recu_at).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}
              </p>
              <div className="mail-badges">
                {courant.fournisseur_id && fournisseurs.get(courant.fournisseur_id) && <span className="pill t-lav">Fournisseur : {fournisseurs.get(courant.fournisseur_id)}</span>}
                {courant.commande_id && <span className="pill t-blue">Commande réf. {refCommande(courant.commande_id)}</span>}
              </div>
              <div className="mail-actions">
                <a className="btn btn-primary" href={`mailto:${courant.de_email}?subject=${encodeURIComponent(`Re: ${courant.sujet ?? ""}`)}`}>
                  ↩ Répondre
                </a>
                <button className="btn" onClick={() => maj(courant, { lu: false }, "Marqué non lu")}>
                  Marquer non lu
                </button>
                <button className="btn" onClick={() => maj(courant, { archive: !courant.archive }, courant.archive ? "Remis dans les reçus" : "Archivé")}>
                  {courant.archive ? "Désarchiver" : "Archiver"}
                </button>
                {gestion && (
                  <button className="btn btn-danger-ghost" onClick={() => supprimer(courant)}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
            {courant.pieces_jointes.length > 0 && (
              <div className="mail-pj">
                {courant.pieces_jointes.map((pj) => (
                  <button key={pj.chemin} className="mail-pj-item" onClick={() => telecharger(pj.chemin, pj.nom)}>
                    📎 <b>{pj.nom}</b> <small>{taille(pj.taille)}</small>
                  </button>
                ))}
              </div>
            )}
            {courant.html ? (
              // HTML du message isolé : aucun script, aucun accès à la page.
              <iframe className="mail-corps" sandbox="" srcDoc={`<base target="_blank"><style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;color:#272435;margin:12px}img{max-width:100%}</style>${courant.html}`} title="Contenu de l'e-mail" />
            ) : (
              <pre className="mail-texte">{courant.texte}</pre>
            )}
          </section>
        )}
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
