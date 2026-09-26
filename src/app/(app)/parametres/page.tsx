"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, ROLE_LABEL, useConnecte, useSession } from "@/lib/session";
import { emailValide } from "@/lib/personnel";

type Onglet = "compte" | "restaurant" | "emails";

type Etab = {
  id: string;
  code: string;
  nom: string;
  ville: string | null;
  adresse: string | null;
  adresse_facturation: string | null;
  telephone: string | null;
  email_contact: string | null;
  siret: string | null;
  siren: string | null;
  numero_tva: string | null;
  photo_couverture: string | null;
  pause_pointage_active: boolean | null;
};

/** Réduit une image choisie à `cote` pixels maximum (JPEG), pour la stocker légère. */
function reduireImage(fichier: File, cote: number): Promise<string> {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => ko(new Error("Image illisible"));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => ko(new Error("Image illisible"));
      img.onload = () => {
        const r = Math.min(1, cote / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = lecteur.result as string;
    };
    lecteur.readAsDataURL(fichier);
  });
}

export default function Parametres() {
  const { compte } = useConnecte();
  const [onglet, setOnglet] = useState<Onglet>("compte");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Établissement</p>
          <h1>Paramètres</h1>
          <p>Ton compte et les informations du restaurant.</p>
        </div>
      </div>
      <div className="week-nav">
        <div className="seg seg-inline" role="tablist">
          <button role="tab" aria-selected={onglet === "compte"} className={onglet === "compte" ? "on" : ""} onClick={() => setOnglet("compte")}>
            Mon compte
          </button>
          <button role="tab" aria-selected={onglet === "restaurant"} className={onglet === "restaurant" ? "on" : ""} onClick={() => setOnglet("restaurant")}>
            Restaurant
          </button>
          {compte.role === "directeur" && (
            <button role="tab" aria-selected={onglet === "emails"} className={onglet === "emails" ? "on" : ""} onClick={() => setOnglet("emails")}>
              E-mails automatiques
            </button>
          )}
        </div>
      </div>
      {onglet === "compte" ? <MonCompte onToast={setToast} /> : onglet === "restaurant" ? <Restaurant onToast={setToast} /> : <Emails />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function MonCompte({ onToast }: { onToast: (m: string) => void }) {
  const { compte, etablissement, sites } = useConnecte();
  const { changerEtablissement, deconnexion } = useSession();
  const sb = getSupabaseClient()!;
  const [prenom, setPrenom] = useState(compte.prenom ?? "");
  const [nom, setNom] = useState(compte.nom ?? "");
  const [telephone, setTelephone] = useState("");
  const [naissance, setNaissance] = useState("");
  const [photo, setPhoto] = useState<string | null>(compte.avatar_url);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [mdp, setMdp] = useState({ actuel: "", nouveau: "", confirmation: "" });
  const [erreurMdp, setErreurMdp] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  // Coordonnées privées : lues via la fonction dédiée (voir migration comptes_coordonnees).
  useEffect(() => {
    sb.rpc("comptes_coordonnees", { p_etablissement_id: etablissement.id }).then(({ data }) => {
      const moi = (data ?? []).find((x: { compte_id: string }) => x.compte_id === compte.id);
      if (moi) {
        setTelephone(moi.telephone ?? "");
        setNaissance(moi.date_naissance ?? "");
      }
    });
  }, [sb, etablissement.id, compte.id]);

  async function enregistrer() {
    setErreur(null);
    if (!prenom.trim() || !nom.trim()) return setErreur("Le prénom et le nom sont obligatoires.");
    setEnvoi(true);
    const { error } = await sb.rpc("maj_mon_profil", { p_etablissement_id: etablissement.id, p_prenom: prenom, p_nom: nom, p_telephone: telephone, p_date_naissance: naissance || null, p_avatar_url: photo });
    setEnvoi(false);
    if (error) return setErreur(error.message.includes("lourde") ? "Photo trop lourde." : "Enregistrement refusé.");
    onToast("Profil enregistré");
    changerEtablissement(etablissement.id); // recharge la session pour mettre à jour le nom et la photo partout
  }

  async function changerMdp() {
    setErreurMdp(null);
    if (mdp.nouveau.length < 8) return setErreurMdp("Le nouveau mot de passe doit faire au moins 8 caractères.");
    if (mdp.nouveau !== mdp.confirmation) return setErreurMdp("Les deux mots de passe ne sont pas identiques.");
    const { data } = await sb.auth.getUser();
    const email = data.user?.email;
    if (!email) return setErreurMdp("Session expirée : reconnecte-toi.");
    const verif = await sb.auth.signInWithPassword({ email, password: mdp.actuel });
    if (verif.error) return setErreurMdp("Mot de passe actuel incorrect.");
    const { error } = await sb.auth.updateUser({ password: mdp.nouveau });
    if (error) return setErreurMdp("Changement refusé : choisis un mot de passe plus solide.");
    setMdp({ actuel: "", nouveau: "", confirmation: "" });
    onToast("Mot de passe changé");
  }

  return (
    <div className="fiche-grid">
      <section className="card">
        <div className="card-head">
          <h2>Mon profil</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="avatar avatar-xl">{photo ? <img src={photo} alt="" /> : initiales(compte)}</span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => ref.current?.click()}>
              Changer la photo
            </button>
            {photo && (
              <button className="btn btn-danger-ghost" onClick={() => setPhoto(null)}>
                Retirer
              </button>
            )}
          </span>
          <input
            ref={ref}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await reduireImage(f, 256).catch(() => photo));
            }}
          />
        </div>
        <div className="form-2">
          <div className="field">
            <label htmlFor="c-prenom">Prénom</label>
            <input id="c-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-nom">Nom</label>
            <input id="c-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
        </div>
        <div className="form-2">
          <div className="field">
            <label htmlFor="c-tel">Téléphone</label>
            <input id="c-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-naiss">Date de naissance</label>
            <input id="c-naiss" type="date" value={naissance} onChange={(e) => setNaissance(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>E-mail de connexion</label>
          <input value={compte.email ?? ""} disabled />
        </div>
        {erreur && (
          <div className="error" role="alert">
            {erreur}
          </div>
        )}
        <button className="btn btn-primary" onClick={enregistrer} disabled={envoi} style={{ justifySelf: "start" }}>
          {envoi ? "Enregistrement…" : "Enregistrer mon profil"}
        </button>
      </section>

      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <section className="card">
          <div className="card-head">
            <h2>Mot de passe</h2>
          </div>
          <div className="field">
            <label htmlFor="m-actuel">Mot de passe actuel</label>
            <input id="m-actuel" type="password" autoComplete="current-password" value={mdp.actuel} onChange={(e) => setMdp({ ...mdp, actuel: e.target.value })} />
          </div>
          <div className="form-2">
            <div className="field">
              <label htmlFor="m-nouveau">Nouveau</label>
              <input id="m-nouveau" type="password" autoComplete="new-password" value={mdp.nouveau} onChange={(e) => setMdp({ ...mdp, nouveau: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="m-conf">Confirmation</label>
              <input id="m-conf" type="password" autoComplete="new-password" value={mdp.confirmation} onChange={(e) => setMdp({ ...mdp, confirmation: e.target.value })} />
            </div>
          </div>
          {erreurMdp && (
            <div className="error" role="alert">
              {erreurMdp}
            </div>
          )}
          <button className="btn" onClick={changerMdp} disabled={!mdp.actuel || !mdp.nouveau} style={{ justifySelf: "start" }}>
            Changer le mot de passe
          </button>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Mes établissements</h2>
          </div>
          <div className="rows">
            {sites.map((s) => (
              <div key={s.etablissement.id} className="row">
                <span className="main-txt">
                  <b>{s.etablissement.nom}</b>
                  <small>
                    {s.etablissement.ville ?? ""} · {ROLE_LABEL[s.compte.role]} · code {s.etablissement.code}
                  </small>
                </span>
                {s.etablissement.id === etablissement.id ? (
                  <span className="pill t-mint">Ouvert</span>
                ) : (
                  <button className="btn" style={{ height: 30 }} onClick={() => changerEtablissement(s.etablissement.id)}>
                    Ouvrir
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-danger-ghost" style={{ marginTop: 12, justifySelf: "start" }} onClick={deconnexion}>
            Se déconnecter ({nomComplet(compte)})
          </button>
        </section>
      </div>
    </div>
  );
}

function Restaurant({ onToast }: { onToast: (m: string) => void }) {
  const { compte, etablissement } = useConnecte();
  const { changerEtablissement } = useSession();
  const directeur = compte.role === "directeur";
  const sb = getSupabaseClient()!;
  const [e, setE] = useState<Etab | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [copie, setCopie] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sb.from("etablissements")
      .select("id, code, nom, ville, adresse, adresse_facturation, telephone, email_contact, siret, siren, numero_tva, photo_couverture, pause_pointage_active")
      .eq("id", etablissement.id)
      .single()
      .then(({ data }) => setE(data as Etab));
  }, [sb, etablissement.id]);

  if (!e) return <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />;
  const set = <K extends keyof Etab>(k: K, v: Etab[K]) => setE({ ...e, [k]: v });
  const chiffres = (s: string | null) => (s ?? "").replace(/\s/g, "");

  async function enregistrer() {
    setErreur(null);
    if (!e!.nom.trim()) return setErreur("Le nom du restaurant est obligatoire.");
    if (e!.siret && !/^\d{14}$/.test(chiffres(e!.siret))) return setErreur("Le SIRET compte 14 chiffres.");
    if (e!.siren && !/^\d{9}$/.test(chiffres(e!.siren))) return setErreur("Le SIREN compte 9 chiffres.");
    if (e!.numero_tva && !/^FR[0-9A-Z]{2}\d{9}$/.test(chiffres(e!.numero_tva).toUpperCase())) return setErreur("TVA intracommunautaire : FR + 2 caractères + SIREN (ex. FR12345678901).");
    if (e!.email_contact && !emailValide(e!.email_contact)) return setErreur("E-mail de contact invalide.");
    setEnvoi(true);
    const { error } = await sb
      .from("etablissements")
      .update({
        nom: e!.nom.trim(),
        ville: e!.ville?.trim() || null,
        adresse: e!.adresse?.trim() || null,
        adresse_facturation: e!.adresse_facturation?.trim() || null,
        telephone: e!.telephone?.trim() || null,
        email_contact: e!.email_contact?.trim() || null,
        siret: chiffres(e!.siret) || null,
        siren: chiffres(e!.siren) || (chiffres(e!.siret).length === 14 ? chiffres(e!.siret).slice(0, 9) : null),
        numero_tva: chiffres(e!.numero_tva).toUpperCase() || null,
        photo_couverture: e!.photo_couverture,
        pause_pointage_active: e!.pause_pointage_active ?? false,
      })
      .eq("id", e!.id);
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé au directeur.");
    onToast("Informations du restaurant enregistrées");
    changerEtablissement(etablissement.id);
  }

  return (
    <fieldset disabled={!directeur} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="fiche-grid">
        <section className="card">
          <div className="card-head">
            <h2>Identité</h2>
          </div>
          <div className="cover" style={e.photo_couverture ? { backgroundImage: `url(${e.photo_couverture})` } : undefined}>
            {directeur && (
              <button className="btn" onClick={() => ref.current?.click()}>
                {e.photo_couverture ? "Changer la photo" : "+ Photo du restaurant"}
              </button>
            )}
            <input
              ref={ref}
              type="file"
              accept="image/*"
              hidden
              onChange={async (x) => {
                const f = x.target.files?.[0];
                if (f) set("photo_couverture", await reduireImage(f, 1200).catch(() => e.photo_couverture));
              }}
            />
          </div>
          <div className="form-2">
            <div className="field">
              <label htmlFor="r-nom">Nom du restaurant</label>
              <input id="r-nom" value={e.nom} onChange={(x) => set("nom", x.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="r-ville">Ville</label>
              <input id="r-ville" value={e.ville ?? ""} onChange={(x) => set("ville", x.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="r-adr">Adresse</label>
            <input id="r-adr" value={e.adresse ?? ""} onChange={(x) => set("adresse", x.target.value)} placeholder="N°, rue, code postal, ville" />
          </div>
          <div className="form-2">
            <div className="field">
              <label htmlFor="r-tel">Téléphone</label>
              <input id="r-tel" type="tel" value={e.telephone ?? ""} onChange={(x) => set("telephone", x.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="r-mail">E-mail de contact</label>
              <input id="r-mail" type="email" value={e.email_contact ?? ""} onChange={(x) => set("email_contact", x.target.value)} placeholder="reçoit les réponses des fournisseurs" />
            </div>
          </div>
          <div className="field">
            <label>Code établissement</label>
            <span className="chosen" style={{ background: "var(--paper)", borderColor: "var(--line)" }}>
              <b className="code-badge" style={{ background: "transparent", border: 0 }}>
                {e.code}
              </b>
              <button type="button" className="link-btn" onClick={() => navigator.clipboard.writeText(e.code).then(() => setCopie(true))}>
                {copie ? "✓ Copié" : "Copier"}
              </button>
            </span>
            <span className="hint">Le code que tes salariés tapent pour se connecter. Il ne se modifie pas.</span>
          </div>
        </section>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <section className="card">
            <div className="card-head">
              <h2>Informations légales</h2>
            </div>
            <div className="form-2">
              <div className="field">
                <label htmlFor="r-siret">SIRET</label>
                <input id="r-siret" inputMode="numeric" value={e.siret ?? ""} onChange={(x) => set("siret", x.target.value)} placeholder="14 chiffres" />
              </div>
              <div className="field">
                <label htmlFor="r-siren">SIREN</label>
                <input id="r-siren" inputMode="numeric" value={e.siren ?? ""} onChange={(x) => set("siren", x.target.value)} placeholder="déduit du SIRET" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="r-tva">N° de TVA intracommunautaire</label>
              <input id="r-tva" value={e.numero_tva ?? ""} onChange={(x) => set("numero_tva", x.target.value)} placeholder="FR12345678901" />
            </div>
            <div className="field">
              <label htmlFor="r-fact">Adresse de facturation (si différente)</label>
              <input id="r-fact" value={e.adresse_facturation ?? ""} onChange={(x) => set("adresse_facturation", x.target.value)} />
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Réglages</h2>
            </div>
            <label className="switch">
              <input type="checkbox" checked={!!e.pause_pointage_active} onChange={(x) => set("pause_pointage_active", x.target.checked)} />
              <span className="switch-track" />
              Les salariés pointent leurs pauses
            </label>
          </section>

          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
          {directeur ? (
            <button type="button" className="btn btn-primary" onClick={enregistrer} disabled={envoi} style={{ justifySelf: "start" }}>
              {envoi ? "Enregistrement…" : "Enregistrer"}
            </button>
          ) : (
            <p className="hint">Seul le directeur modifie ces informations.</p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

function Emails() {
  const [configure, setConfigure] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/commandes/envoyer")
      .then((r) => r.json())
      .then((j) => setConfigure(Boolean(j.configure)))
      .catch(() => setConfigure(false));
  }, []);

  return (
    <section className="card" style={{ maxWidth: 720 }}>
      <div className="card-head">
        <h2>Envoi automatique des commandes fournisseurs</h2>
        {configure !== null && <span className={`pill ${configure ? "t-mint" : "t-yellow"}`}>{configure ? "Connecté" : "Pas encore connecté"}</span>}
      </div>
      {configure ? (
        <p className="hint" style={{ fontSize: 13 }}>
          Les commandes validées dans « Commandes » partent automatiquement par e-mail au fournisseur. Les réponses arrivent sur l&apos;e-mail de contact du restaurant (onglet Restaurant).
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10, fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>
            Tout est prêt côté Juliette ; il reste à brancher <b>Resend</b>, le service qui envoie les e-mails. En attendant, les commandes s&apos;envoient depuis ta messagerie.
          </p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Crée un compte sur resend.com et vérifie ton nom de domaine (ex. monrestaurant.fr).</li>
            <li>Crée une clé API.</li>
            <li>
              Dans le fichier <code>.env.local</code> de Juliette, renseigne <code>RESEND_API_KEY=</code> (la clé) et <code>RESEND_FROM_EMAIL=</code> (ex. <code>Mon Restaurant &lt;commandes@monrestaurant.fr&gt;</code>).
            </li>
            <li>Redémarre Juliette : ce panneau passe à « Connecté ».</li>
          </ol>
        </div>
      )}
    </section>
  );
}
