// Client Supabase côté navigateur.
//
// Utilise la clé publiable : elle est faite pour être exposée, car c'est la sécurité au niveau des
// lignes (RLS) qui décide de ce que chaque personne peut lire ou écrire, pas la clé. Toute
// opération qui doit contourner la RLS passe par une route serveur (voir supabase-admin.ts).
//
// Renvoie null si les variables d'environnement ne sont pas configurées, pour que l'application
// démarre quand même plutôt que de planter au premier rendu.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!url || !cle) return null;
  if (!client) client = createClient(url, cle);
  return client;
}

export function supabaseConfigure(): boolean {
  return Boolean(url && cle);
}
