"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { MODULES } from "@/lib/modules";

// Modules pas encore reconstruits : une page claire plutôt qu'un écran vide ou une 404.
export default function ModuleAVenir() {
  const { module } = useParams<{ module: string }>();
  const m = MODULES.find((x) => x.href === `/${module}`);

  if (!m) {
    return (
      <div className="card soon-card">
        <h1>Page introuvable</h1>
        <p>Ce module n&apos;existe pas.</p>
        <p style={{ marginTop: 18 }}>
          <Link className="btn" href="/dashboard">Retour au tableau de bord</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card soon-card">
      <div className="chip-ic t-lav">{m.icon}</div>
      <h1>{m.label}</h1>
      <p>{m.sub}. Ce module est en cours de reconstruction dans la nouvelle version de Juliette. Les données existantes sont conservées dans la base et réapparaîtront ici.</p>
      <p style={{ marginTop: 18 }}>
        <Link className="btn" href="/dashboard">Retour au tableau de bord</Link>
      </p>
    </div>
  );
}
