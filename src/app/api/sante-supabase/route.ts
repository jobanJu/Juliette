// Vérification de la connexion à Supabase : à ouvrir une fois après configuration du .env.local,
// pour confirmer que l'application parle bien à la base avant d'y brancher les modules.
// Ne renvoie aucune donnée métier, seulement l'état de la connexion.

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ENTETES = { "Content-Type": "application/json; charset=utf-8" };

export async function GET() {
  const publique = getSupabaseClient();
  const admin = getSupabaseAdmin();

  const etat = {
    clePublique: Boolean(publique),
    cleService: Boolean(admin),
    lectureBase: false,
    nbEtablissements: 0,
    message: "",
  };

  if (!admin) {
    etat.message = "SUPABASE_SERVICE_ROLE_KEY absente de .env.local — les routes serveur ne peuvent pas lire la base.";
    return NextResponse.json(etat, { status: 200, headers: ENTETES });
  }

  const { count, error } = await admin.from("etablissements").select("id", { count: "exact", head: true });
  if (error) {
    etat.message = "Connexion refusée par Supabase — vérifie l'URL et la clé service_role.";
    return NextResponse.json(etat, { status: 200, headers: ENTETES });
  }

  etat.lectureBase = true;
  etat.nbEtablissements = count ?? 0;
  etat.message = "Connexion établie.";
  return NextResponse.json(etat, { headers: ENTETES });
}
