// Client Supabase côté serveur, avec la clé service_role.
//
// ATTENTION : cette clé contourne INTÉGRALEMENT la sécurité au niveau des lignes. Un fichier qui
// l'importe ne doit jamais être envoyé au navigateur — donc uniquement des routes sous src/app/api
// avec `export const runtime = "nodejs"`.
//
// Toute route qui s'en sert doit vérifier elle-même l'identité de l'appelant et en déduire son
// établissement : sans ça, n'importe qui peut lire ou modifier les données de n'importe quel
// restaurant en changeant un identifiant dans l'URL.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!url || !cleService) return null;
  if (!admin) {
    admin = createClient(url, cleService, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return admin;
}
