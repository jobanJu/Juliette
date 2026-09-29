"use client";

// Session Juliette : qui est connecté, dans quel établissement, avec quels modules.
//
// L'authentification est celle de Supabase (e-mail + mot de passe). Aucun compte ni mot de passe
// n'est stocké dans le navigateur : on n'y garde que l'établissement choisi. Les droits sont ceux
// de la base (RLS + acces_module_de), l'interface ne fait que les refléter.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { MODULES } from "@/lib/modules";

export type Role = "directeur" | "responsable" | "salarie";

export type Compte = {
  id: string;
  etablissement_id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  role: Role;
  statut: "invite" | "actif" | "parti";
  poste: string | null;
  avatar_url: string | null;
};

export type Etablissement = { id: string; nom: string; ville: string | null; code: string };

type Etat =
  | { statut: "chargement" }
  | { statut: "anonyme" }
  | {
      statut: "connecte";
      compte: Compte;
      etablissement: Etablissement;
      sites: { compte: Compte; etablissement: Etablissement }[];
      modules: Set<string>;
      /** Établissement suspendu par l'équipe Juliette : l'application est bloquée. */
      suspendu: boolean;
    };

type Session = {
  etat: Etat;
  connexion: (code: string, email: string, motDePasse: string) => Promise<string | null>;
  /** Première connexion d'un salarié invité. */
  activation: (code: string, email: string, motDePasse: string) => Promise<string | null>;
  deconnexion: () => Promise<void>;
  changerEtablissement: (etablissementId: string) => void;
};

const CLE_SITE = "juliette.etablissement";
const Ctx = createContext<Session | null>(null);

function lireSite(): string | null {
  try {
    return localStorage.getItem(CLE_SITE);
  } catch {
    return null;
  }
}

function ecrireSite(id: string | null) {
  try {
    if (id) localStorage.setItem(CLE_SITE, id);
    else localStorage.removeItem(CLE_SITE);
  } catch {}
}

async function chargerSites() {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data: comptes, error } = await sb.rpc("mes_comptes");
  if (error || !comptes?.length) return [];
  const actifs = (comptes as Compte[]).filter((c) => c.statut !== "parti");
  const ids = [...new Set(actifs.map((c) => c.etablissement_id))];
  const { data: etabs } = await sb.from("etablissements").select("id, nom, ville, code").in("id", ids);
  const parId = new Map((etabs ?? []).map((e) => [e.id, e as Etablissement]));
  return actifs
    .filter((c) => parId.has(c.etablissement_id))
    .map((c) => ({ compte: c, etablissement: parId.get(c.etablissement_id)! }));
}

/** Droits fins qui ne sont pas des pages : réglages d'un module, historique, etc. */
const DROITS_FINS = ["haccp-parametres", "haccp-historique", "configuration-commandes"];

/** Modules toujours visibles, même si l'établissement masque le reste. */
export const MODULES_ESSENTIELS = ["dashboard", "parametres", "accreditations"];

async function chargerModules(etablissementId: string, role: Role): Promise<Set<string>> {
  const sb = getSupabaseClient();
  if (!sb) return new Set(["dashboard"]);
  // Modules que l'établissement a choisi de ne pas utiliser : retirés pour tout le monde.
  const { data: etab } = await sb.from("etablissements").select("modules_masques").eq("id", etablissementId).maybeSingle();
  const masques = new Set(((etab?.modules_masques ?? []) as string[]).filter((m) => !MODULES_ESSENTIELS.includes(m)));
  const autorises = await droitsDe(sb, etablissementId, role);
  for (const m of masques) autorises.delete(m);
  return autorises;
}

async function droitsDe(sb: NonNullable<ReturnType<typeof getSupabaseClient>>, etablissementId: string, role: Role): Promise<Set<string>> {
  const cles = [...MODULES.map((m) => m.module), ...DROITS_FINS];
  if (role === "directeur") return new Set(cles);
  const reponses = await Promise.all(
    cles.map((cle) =>
      sb.rpc("acces_module_de", { p_etablissement_id: etablissementId, p_module: cle }).then((r) => [cle, r.data === true] as const),
    ),
  );
  const autorises = new Set(reponses.filter(([, ok]) => ok).map(([m]) => m));
  autorises.add("dashboard");
  // Les relevés HACCP sont ouverts à tout membre actif (RLS des tables haccp_*), quel que soit le poste.
  autorises.add("haccp");
  // Chacun gère son propre compte ; la page réserve la partie restaurant au directeur.
  autorises.add("parametres");
  return autorises;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>(() => (getSupabaseClient() ? { statut: "chargement" } : { statut: "anonyme" }));

  const ouvrir = useCallback(async (siteVoulu: string | null) => {
    const sites = await chargerSites();
    if (!sites.length) {
      setEtat({ statut: "anonyme" });
      return false;
    }
    const choisi = sites.find((s) => s.etablissement.id === siteVoulu) ?? sites[0];
    ecrireSite(choisi.etablissement.id);
    const [modules, suspension] = await Promise.all([
      chargerModules(choisi.etablissement.id, choisi.compte.role),
      getSupabaseClient()!.rpc("etablissement_suspendu", { p_etablissement_id: choisi.etablissement.id }),
    ]);
    setEtat({ statut: "connecte", compte: choisi.compte, etablissement: choisi.etablissement, sites, modules, suspendu: suspension.data === true });
    return true;
  }, []);

  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      if (data.session) ouvrir(lireSite());
      else setEtat({ statut: "anonyme" });
    });
    const { data: abonnement } = sb.auth.onAuthStateChange((evenement) => {
      if (evenement === "SIGNED_OUT") setEtat({ statut: "anonyme" });
    });
    return () => abonnement.subscription.unsubscribe();
  }, [ouvrir]);

  const connexion = useCallback(
    async (code: string, email: string, motDePasse: string) => {
      const sb = getSupabaseClient();
      if (!sb) return "Connexion au serveur indisponible.";
      const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse });
      if (error) return "E-mail ou mot de passe incorrect.";
      let sites = await chargerSites();
      let site = sites.find((s) => s.etablissement.code.toUpperCase() === code.trim().toUpperCase());
      if (!site) {
        // Invitation en attente pour cet e-mail dans cet établissement : on la rattache au compte.
        const { error: errInvit } = await sb.rpc("rejoindre_etablissement", { p_code: code.trim(), p_email: email.trim() });
        if (!errInvit) {
          sites = await chargerSites();
          site = sites.find((s) => s.etablissement.code.toUpperCase() === code.trim().toUpperCase());
        }
      }
      if (!site) {
        await sb.auth.signOut();
        return sites.length
          ? "Ce compte n'est pas rattaché à cet établissement. Vérifie le code."
          : "Aucun établissement actif n'est rattaché à ce compte.";
      }
      await ouvrir(site.etablissement.id);
      return null;
    },
    [ouvrir],
  );

  const activation = useCallback(
    async (code: string, email: string, motDePasse: string) => {
      const sb = getSupabaseClient();
      if (!sb) return "Connexion au serveur indisponible.";
      const adresse = email.trim().toLowerCase();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) {
        const reponse = await fetch("/api/activer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim(), email: adresse, motDePasse }),
        });
        const resultat = await reponse.json().catch(() => null);
        if (!reponse.ok) return resultat?.erreur ?? "Activation impossible pour le moment. Réessaie dans un instant.";
        const { error } = await sb.auth.signInWithPassword({ email: adresse, password: motDePasse });
        if (error) return "Compte créé, mais connexion impossible. Essaie de te connecter avec ton mot de passe.";
      }
      // La connexion rattache l'invitation au compte Auth.
      const err = await connexion(code, adresse, motDePasse);
      if (err) return "Aucune invitation ne correspond à ce code et cet e-mail. Vérifie-les avec ton responsable.";
      return null;
    },
    [connexion],
  );

  const deconnexion = useCallback(async () => {
    ecrireSite(null);
    await getSupabaseClient()?.auth.signOut();
    setEtat({ statut: "anonyme" });
  }, []);

  const changerEtablissement = useCallback(
    (id: string) => {
      setEtat({ statut: "chargement" });
      ouvrir(id);
    },
    [ouvrir],
  );

  const valeur = useMemo(
    () => ({ etat, connexion, activation, deconnexion, changerEtablissement }),
    [etat, connexion, activation, deconnexion, changerEtablissement],
  );
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession doit être utilisé dans <SessionProvider>");
  return s;
}

/** Raccourci pour les pages protégées : garanti connecté (le layout redirige sinon). */
export function useConnecte() {
  const { etat } = useSession();
  if (etat.statut !== "connecte") throw new Error("Page protégée rendue hors session");
  return etat;
}

export function nomComplet(c: Pick<Compte, "prenom" | "nom" | "email">) {
  return [c.prenom, c.nom].filter(Boolean).join(" ") || c.email || "Sans nom";
}

export function initiales(c: Pick<Compte, "prenom" | "nom" | "email">) {
  const n = nomComplet(c).split(/\s+/);
  return ((n[0]?.[0] ?? "") + (n[1]?.[0] ?? "")).toUpperCase() || "?";
}

export const ROLE_LABEL: Record<Role, string> = { directeur: "Directeur", responsable: "Responsable", salarie: "Salarié" };
