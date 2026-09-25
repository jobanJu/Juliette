"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { moduleDeRoute } from "@/lib/modules";
import { useSession } from "@/lib/session";

// Garde des pages internes : non connecté → /login ; module non autorisé → tableau de bord.
export default function EspaceConnecte({ children }: { children: ReactNode }) {
  const { etat } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const mod = moduleDeRoute(pathname);
  const interdit = etat.statut === "connecte" && mod !== undefined && !etat.modules.has(mod.module);

  useEffect(() => {
    if (etat.statut === "anonyme") router.replace("/login");
    else if (interdit) router.replace("/dashboard");
  }, [etat.statut, interdit, router]);

  if (etat.statut !== "connecte" || interdit) {
    return <div className="center-screen">Chargement…</div>;
  }
  return <Shell>{children}</Shell>;
}
