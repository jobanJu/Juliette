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
    };

type Session = {
  etat: Etat;
  connexion: (code: string, email: string, motDePasse: string) => Promise<string | null>;
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

async function chargerModules(etablissementId: string, role: Role): Promise<Set<string>> {
  if (role === "directeur") return new Set(MODULES.map((m) => m.module));
  const sb = getSupabaseClient();
  if (!sb) return new Set(["dashboard"]);
  const reponses = await Promise.all(
    MODULES.map((m) =>
      sb.rpc("acces_module_de", { p_etablissement_id: etablissementId, p_module: m.module }).then((r) => [m.module, r.data === true] as const),
    ),
  );
  const autorises = new Set(reponses.filter(([, ok]) => ok).map(([m]) => m));
  autorises.add("dashboard");
  // Les relevés HACCP sont ouverts à tout membre actif (RLS des tables haccp_*), quel que soit le poste.
  autorises.add("haccp");
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
    const modules = await chargerModules(choisi.etablissement.id, choisi.compte.role);
    setEtat({ statut: "connecte", compte: choisi.compte, etablissement: choisi.etablissement, sites, modules });
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
      const sites = await chargerSites();
      const site = sites.find((s) => s.etablissement.code.toUpperCase() === code.trim().toUpperCase());
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

  const valeur = useMemo(() => ({ etat, connexion, deconnexion, changerEtablissement }), [etat, connexion, deconnexion, changerEtablissement]);
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
