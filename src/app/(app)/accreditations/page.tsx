"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Les accréditations vivent désormais dans Paramètres → Établissement.
export default function AncienneAdresse() {
  const router = useRouter();
  useEffect(() => router.replace("/parametres?onglet=accreditations"), [router]);
  return <div className="center-screen">Chargement…</div>;
}
