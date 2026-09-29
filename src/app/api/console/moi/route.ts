// La console est-elle accessible à l'appelant ? (200 si membre de l'équipe Juliette, 404 sinon)
import { NextResponse } from "next/server";
import { equipeJuliette } from "@/lib/console";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const acces = await equipeJuliette(request);
  if (acces instanceof NextResponse) return acces;
  return NextResponse.json({ equipe: true });
}
