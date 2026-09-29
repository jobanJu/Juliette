// Identité de l'appelant d'une route API : jeton de session → compte, et vérification de son rôle
// dans l'établissement demandé (via les fonctions SQL de la base, avec SA session).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function appelant(request: Request, etablissementId: unknown, exige: "directeur" | "manager") {
  if (!url || !cleAnon) return NextResponse.json({ erreur: "serveur" }, { status: 500 });
  if (typeof etablissementId !== "string" || !/^[0-9a-f-]{36}$/i.test(etablissementId)) return NextResponse.json({ erreur: "etablissement" }, { status: 400 });
  const jeton = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return NextResponse.json({ erreur: "non_connecte" }, { status: 401 });
  const sb = createClient(url, cleAnon, { global: { headers: { Authorization: `Bearer ${jeton}` } }, auth: { persistSession: false } });
  const { data: u } = await sb.auth.getUser(jeton);
  if (!u.user) return NextResponse.json({ erreur: "non_connecte" }, { status: 401 });
  const [{ data: ok }, { data: compteId }] = await Promise.all([
    sb.rpc(exige === "directeur" ? "est_directeur_de" : "est_manager_de", { p_etablissement_id: etablissementId }),
    sb.rpc("mon_compte_id", { p_etablissement_id: etablissementId }),
  ]);
  if (!ok) return NextResponse.json({ erreur: "interdit" }, { status: 403 });
  return { etablissementId, compteId: (compteId as string | null) ?? null };
}
