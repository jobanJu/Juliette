// Console de l'équipe Juliette : contrôle d'accès côté serveur.
// Uniquement pour les routes /api/console/* (runtime nodejs) : utilise la clé de service.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Vérifie que l'appelant (jeton de session) fait partie de l'équipe Juliette. */
export async function equipeJuliette(request: Request): Promise<{ admin: SupabaseClient; userId: string } | NextResponse> {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ erreur: "serveur" }, { status: 503 });
  const jeton = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return NextResponse.json({ erreur: "non_connecte" }, { status: 401 });
  const { data } = await admin.auth.getUser(jeton);
  if (!data.user) return NextResponse.json({ erreur: "non_connecte" }, { status: 401 });
  const { data: membre } = await admin.from("equipe_juliette").select("auth_user_id").eq("auth_user_id", data.user.id).maybeSingle();
  // 404 plutôt que 403 : la console n'a pas à révéler son existence.
  if (!membre) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  return { admin, userId: data.user.id };
}

export const FORMULES = ["essai", "essentiel", "pro", "premium", "offert"] as const;
export const STATUTS_CAISSE = ["aucune", "demandee", "en_cours", "connectee", "erreur"] as const;
