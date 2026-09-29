// Console : vue d'ensemble de tous les établissements clients.
import { NextResponse } from "next/server";
import { equipeJuliette } from "@/lib/console";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const acces = await equipeJuliette(request);
  if (acces instanceof NextResponse) return acces;
  const { data, error } = await acces.admin.rpc("admin_etablissements");
  if (error) return NextResponse.json({ erreur: "lecture" }, { status: 500 });
  return NextResponse.json({ etablissements: data });
}
