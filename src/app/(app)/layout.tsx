"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { moduleDeRoute } from "@/lib/modules";
import { useSession } from "@/lib/session";

function Suspendu() {
  const { etat, deconnexion, changerEtablissement } = useSession();
  if (etat.statut !== "connecte") return null;
  const autres = etat.sites.filter((s) => s.etablissement.id !== etat.etablissement.id);
  return (
    <div className="center-screen">
      <div className="card soon-card" style={{ maxWidth: 460 }}>
        <h1>Accès suspendu</h1>
        <p>L&apos;accès de {etat.etablissement.nom} à Juliette est suspendu. Pour le rétablir, contacte l&apos;équipe Juliette.</p>
        <p style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {autres.map((s) => (
            <button key={s.etablissement.id} className="btn" onClick={() => changerEtablissement(s.etablissement.id)}>
              Ouvrir {s.etablissement.nom}
            </button>
          ))}
          <button className="btn btn-primary" onClick={deconnexion}>
            Se déconnecter
          </button>
        </p>
      </div>
    </div>
  );
}

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
  if (etat.suspendu && !pathname.startsWith("/console")) return <Suspendu />;
  return <Shell>{children}</Shell>;
}
