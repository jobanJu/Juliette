"use client";

// Pointeuse : authentification du directeur à l'activation, puis la borne garde un jeton
// limité aux pointages et ferme la session utilisateur.

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import Icone from "@/components/Icone";
import type { NomIcone } from "@/components/Icone";
import Marque from "@/components/Marque";

const CLE = "juliette.pointeuse.jeton";
const LONGUEUR_CODE = 6;

type Type = "arrivee" | "depart" | "pause_debut" | "pause_fin";
type Personne = { prenom: string; nom: string; dernier: Type | null; depuis: string | null };
type Ecran = { etape: "code" } | { etape: "choix"; code: string; p: Personne } | { etape: "ok"; prenom: string; type: Type; heure: string };

const LIBELLES: Record<Type, { bouton: string; icone: NomIcone; message: (p: string) => string; ton: string }> = {
  arrivee: { bouton: "Arrivée", icone: "arrivee", message: (p) => `Bonne journée ${p} !`, ton: "arrivee" },
  depart: { bouton: "Départ", icone: "deconnexion", message: (p) => `À bientôt ${p} !`, ton: "depart" },
  pause_debut: { bouton: "Début de pause", icone: "pause", message: (p) => `Bonne pause ${p}`, ton: "pause" },
  pause_fin: { bouton: "Fin de pause", icone: "reprise", message: (p) => `Bon retour ${p}`, ton: "arrivee" },
};

function lireJeton() {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

export default function Borne() {
  const [jeton, setJeton] = useState<string | null | undefined>(undefined);
  const [infos, setInfos] = useState<{ etablissement: string; nom: string; pause: boolean } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => {
    // Lecture différée : l'appareil (et son jeton) n'existe que côté navigateur.
    const t = setTimeout(() => {
      setJeton(lireJeton());
      setHeure(new Date());
    }, 0);
    const i = setInterval(() => setHeure(new Date()), 1000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);

  useEffect(() => {
    if (!jeton) return;
    getSupabaseClient()!
      .rpc("badgeuse_infos", { p_jeton: jeton })
      .then(({ data, error }) => {
        if (error || !data?.length) {
          // Jeton révoqué ou inconnu : on revient à l'activation.
          try {
            localStorage.removeItem(CLE);
          } catch {}
          setJeton(null);
          return;
        }
        setInfos({ etablissement: data[0].etablissement, nom: data[0].nom, pause: data[0].pause_active });
      });
  }, [jeton]);

  if (jeton === undefined) return <div className="borne" />;
  if (!jeton) return <Activation onActive={(j) => setJeton(j)} />;
  if (!infos) return <div className="borne"><p className="borne-attente">Connexion…</p></div>;
  return <Clavier jeton={jeton} infos={infos} heure={heure} onDesactive={() => { setJeton(null); setInfos(null); }} />;
}

function Activation({ onActive }: { onActive: (j: string) => void }) {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function activer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const sb = getSupabaseClient()!;
    const { error: erreurConnexion } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: mdp });
    if (erreurConnexion) {
      setEnvoi(false);
      return setErreur("E-mail ou mot de passe incorrect.");
    }
    const { data, error } = await sb.rpc("badgeuse_activer_directeur", { p_nom: nom || "Pointeuse" });
    await sb.auth.signOut();
    setEnvoi(false);
    const r = data?.[0];
    if (error || !r) return setErreur("Activation impossible pour le moment. Vérifie la connexion.");
    if (r.erreur) return setErreur(r.erreur);
    try {
      localStorage.setItem(CLE, r.jeton);
    } catch {
      return setErreur("Cet appareil n'autorise pas l'enregistrement (navigation privée ?).");
    }
    onActive(r.jeton);
  }

  return (
    <div className="login">
      <aside className="login-art">
        <div className="brand">
          <Marque />Juliette
        </div>
        <div>
          <h2>Pointeuse</h2>
          <p>Pose cette tablette à l&apos;entrée : chaque salarié pointe avec son code à 6 chiffres, visible dans sa fiche Équipe.</p>
        </div>
        <small style={{ opacity: 0.6 }}>Activation réservée au directeur</small>
      </aside>
      <div className="login-form">
        <form onSubmit={activer}>
          <div className="brand" style={{ marginBottom: 10 }}>
            <Marque />Juliette
          </div>
          <div>
            <h1>Activer la pointeuse</h1>
            <p style={{ margin: "6px 0 4px", color: "var(--muted)", fontSize: 13 }}>Connecte-toi avec les identifiants habituels du directeur.</p>
          </div>
          <div className="field">
            <label htmlFor="b-email">E-mail du directeur</label>
            <input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="b-mdp">Mot de passe du directeur</label>
            <input id="b-mdp" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="field">
            <label htmlFor="b-nom">Nom de cet appareil</label>
            <input id="b-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Tablette entrée cuisine" />
          </div>
          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
          <button className="btn btn-primary" style={{ height: 48 }} disabled={envoi}>
            {envoi ? "Activation…" : "Activer cet appareil"}
          </button>
          <p className="hint" style={{ textAlign: "center" }}>
            <Link href="/" style={{ color: "var(--purple-ink)", fontWeight: 600 }}>
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function actionsPour(dernier: Type | null, pause: boolean): Type[] {
  if (dernier === "arrivee" || dernier === "pause_fin") return pause ? ["depart", "pause_debut"] : ["depart"];
  if (dernier === "pause_debut") return ["pause_fin"];
  return ["arrivee"];
}

function Clavier({ jeton, infos, heure, onDesactive }: { jeton: string; infos: { etablissement: string; nom: string; pause: boolean }; heure: Date | null; onDesactive: () => void }) {
  const [code, setCode] = useState("");
  const [ecran, setEcran] = useState<Ecran>({ etape: "code" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [reglages, setReglages] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sb = getSupabaseClient()!;

  const revenir = useCallback(() => {
    setCode("");
    setErreur(null);
    setEcran({ etape: "code" });
  }, []);

  // Retour automatique à l'écran d'accueil : 4 s après un pointage, 20 s sans action sinon.
  useEffect(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    if (ecran.etape === "code" && !code) return;
    minuteur.current = setTimeout(revenir, ecran.etape === "ok" ? 4000 : 20000);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [ecran, code, revenir]);

  const identifier = useCallback(
    async (c: string) => {
      setEnvoi(true);
      setErreur(null);
      const { data, error } = await sb.rpc("badgeuse_identifier", { p_jeton: jeton, p_code: c });
      setEnvoi(false);
      const r = data?.[0];
      if (error) return setErreur("Pointeuse déconnectée : vérifie Internet.");
      if (!r || r.erreur) {
        setCode("");
        return setErreur(r?.erreur ?? "Code inconnu");
      }
      setEcran({ etape: "choix", code: c, p: { prenom: r.prenom, nom: r.nom, dernier: r.dernier_type, depuis: r.dernier_at } });
    },
    [sb, jeton],
  );

  function touche(t: string) {
    if (envoi || ecran.etape !== "code") return;
    setErreur(null);
    if (t === "⌫") return setCode((c) => c.slice(0, -1));
    if (t === "C") return setCode("");
    const n = (code + t).slice(0, LONGUEUR_CODE);
    setCode(n);
    if (n.length === LONGUEUR_CODE) identifier(n);
  }

  // Clavier physique (tablette avec clavier, ordinateur).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (reglages) return;
      if (/^\d$/.test(e.key)) touche(e.key);
      else if (e.key === "Backspace") touche("⌫");
      else if (e.key === "Escape") revenir();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  async function pointer(type: Type) {
    if (ecran.etape !== "choix") return;
    setEnvoi(true);
    const { data, error } = await sb.rpc("badgeuse_pointer", { p_jeton: jeton, p_code: ecran.code, p_type: type });
    setEnvoi(false);
    if (error || !data?.[0]) return setErreur("Pointage refusé : réessaie.");
    setEcran({ etape: "ok", prenom: data[0].prenom, type, heure: new Date(data[0].horodatage).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) });
    setCode("");
  }

  return (
    <div className="borne">
      <header className="borne-haut">
        <span className="brand" style={{ fontSize: 17 }}>
          <Marque taille={28} />
          {infos.etablissement}
        </span>
        <button className="icon-btn" onClick={() => setReglages(true)} aria-label="Réglages de la pointeuse">
          <Icone nom="reglages" taille={20} />
        </button>
      </header>

      <div className="borne-heure">
        {heure ? heure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
        <small>{heure ? heure.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : ""}</small>
      </div>

      {ecran.etape === "code" && (
        <div className="borne-zone">
          <p className="borne-invite">Tape ton code de pointage</p>
          <div className="borne-points" aria-label={`${code.length} chiffre(s) saisi(s)`}>
            {Array.from({ length: LONGUEUR_CODE }, (_, i) => (
              <span key={i} className={i < code.length ? "plein" : ""} />
            ))}
          </div>
          <p className="borne-erreur" role="alert">
            {erreur ?? (envoi ? "…" : " ")}
          </p>
          <div className="borne-clavier">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((t) => (
              <button key={t} onClick={() => touche(t)} className={t === "C" || t === "⌫" ? "fonction" : ""} disabled={envoi} aria-label={t === "⌫" ? "Effacer" : t === "C" ? "Tout effacer" : t}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {ecran.etape === "choix" && (
        <div className="borne-zone">
          <p className="borne-bonjour">Bonjour {ecran.p.prenom}</p>
          <p className="borne-invite">
            {ecran.p.dernier === "arrivee" || ecran.p.dernier === "pause_fin"
              ? `En service depuis ${new Date(ecran.p.depuis!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
              : ecran.p.dernier === "pause_debut"
                ? `En pause depuis ${new Date(ecran.p.depuis!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "Pas encore pointé aujourd'hui"}
          </p>
          <div className="borne-actions">
            {actionsPour(ecran.p.dernier, infos.pause).map((t) => (
              <button key={t} className={`borne-action ${LIBELLES[t].ton}`} onClick={() => pointer(t)} disabled={envoi}>
                <span><Icone nom={LIBELLES[t].icone} taille={30} /></span>
                {LIBELLES[t].bouton}
              </button>
            ))}
          </div>
          {erreur && <p className="borne-erreur">{erreur}</p>}
          <button className="btn" onClick={revenir} style={{ marginTop: 18 }}>
            Ce n&apos;est pas moi
          </button>
        </div>
      )}

      {ecran.etape === "ok" && (
        <div className={`borne-zone borne-ok ${LIBELLES[ecran.type].ton}`}>
          <span className="borne-coche">✓</span>
          <p className="borne-bonjour">{LIBELLES[ecran.type].message(ecran.prenom)}</p>
          <p className="borne-invite">
            {LIBELLES[ecran.type].bouton} enregistré{ecran.type.startsWith("pause") ? "" : "e"} à {ecran.heure}
          </p>
        </div>
      )}

      {reglages && <Reglages jeton={jeton} nom={infos.nom} onClose={() => setReglages(false)} onDesactive={onDesactive} />}
    </div>
  );
}

function Reglages({ jeton, nom, onClose, onDesactive }: { jeton: string; nom: string; onClose: () => void; onDesactive: () => void }) {
  async function desactiver() {
    await getSupabaseClient()!.rpc("badgeuse_desactiver_jeton", { p_jeton: jeton });
    try {
      localStorage.removeItem(CLE);
    } catch {}
    onDesactive();
  }

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Réglages de la pointeuse">
        <div className="modal-head">
          <div>
            <h2>{nom}</h2>
            <p>Réglages de cette pointeuse</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ fontSize: 13 }}>
            Tu peux retirer cet appareil ici. Le directeur peut aussi le révoquer à distance depuis Paramètres → Pointeuse.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-danger" onClick={desactiver}>
            Désactiver cet appareil
          </button>
        </div>
      </div>
    </div>
  );
}
