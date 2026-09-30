"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icone from "@/components/Icone";
import type { NomIcone } from "@/components/Icone";
import { getSupabaseClient } from "@/lib/supabase";

type Etape = { cle: string; titre: string; detail: string; href: string; icone: NomIcone; fait: boolean };

const CLE_MASQUE = (id: string) => `juliette-mise-en-route-masquee-${id}`;

// Tableau de bord du directeur : les étapes d'installation restantes, cochées au fil de l'eau.
export default function MiseEnRoute({ etablissementId }: { etablissementId: string }) {
  const [etapes, setEtapes] = useState<Etape[] | null>(null);
  const [masquee, setMasquee] = useState(true);

  useEffect(() => {
    try {
      setMasquee(localStorage.getItem(CLE_MASQUE(etablissementId)) === "1");
    } catch {
      setMasquee(false);
    }
    const sb = getSupabaseClient()!;
    const e = etablissementId;
    const nb = (r: { count: number | null; error: unknown }) => (r.error ? 0 : (r.count ?? 0));
    Promise.all([
      sb.from("produits").select("id", { count: "exact", head: true }).eq("etablissement_id", e),
      sb.from("comptes").select("id", { count: "exact", head: true }).eq("etablissement_id", e),
      sb.from("zones_stockage").select("id", { count: "exact", head: true }).eq("etablissement_id", e),
      sb.from("haccp_config").select("data").eq("etablissement_id", e).eq("cle", "equipements").maybeSingle(),
      sb.rpc("badgeuses_liste", { p_etablissement_id: e }),
      sb.from("fiches_techniques").select("id", { count: "exact", head: true }).eq("etablissement_id", e),
    ]).then(([produits, comptes, zones, equipements, bornes, fiches]) => {
      const eq = equipements.data?.data as unknown;
      const frigos = Array.isArray(eq) ? eq.length : eq && typeof eq === "object" ? Object.keys(eq).length : 0;
      setEtapes([
        { cle: "produits", titre: "Importer tes produits", detail: "Depuis le fichier Excel de ton grossiste", href: "/inventaire", icone: "envoyer", fait: nb(produits) > 0 },
        { cle: "equipe", titre: "Inviter ton équipe", detail: "Chacun active son compte avec le code", href: "/equipe", icone: "equipe", fait: nb(comptes) > 1 },
        { cle: "zones", titre: "Créer les zones de stockage", detail: "Chambre froide, réserve, bar…", href: "/inventaire", icone: "stock", fait: nb(zones) > 0 },
        { cle: "haccp", titre: "Déclarer tes frigos", detail: "Pour le relevé des températures", href: "/haccp", icone: "frigo", fait: frigos > 0 },
        { cle: "pointeuse", titre: "Installer la pointeuse", detail: "Sur la tablette de l'entrée", href: "/parametres?onglet=pointeuse", icone: "horloge", fait: ((bornes.data ?? []) as { revoquee_at: string | null }[]).some((x) => !x.revoquee_at) },
        { cle: "fiches", titre: "Créer une fiche technique", detail: "Recette, grammages et coût matière", href: "/fiche-technique", icone: "cuisine", fait: nb(fiches) > 0 },
      ]);
    });
  }, [etablissementId]);

  if (!etapes || masquee) return null;
  const faites = etapes.filter((x) => x.fait).length;
  if (faites === etapes.length) return null;

  return (
    <section className="card mise-en-route">
      <div className="card-head">
        <div>
          <h2>Mise en route</h2>
          <small className="hint">
            {faites} étape{faites > 1 ? "s" : ""} sur {etapes.length} · <Link href="/aide#premiers-pas">voir le guide</Link>
          </small>
        </div>
        <button
          className="icon-btn"
          aria-label="Masquer la mise en route"
          title="Masquer"
          onClick={() => {
            setMasquee(true);
            try {
              localStorage.setItem(CLE_MASQUE(etablissementId), "1");
            } catch {}
          }}
        >
          ✕
        </button>
      </div>
      <div className="barre-progression">
        <i style={{ width: `${(faites / etapes.length) * 100}%` }} />
      </div>
      <div className="mise-en-route-etapes">
        {etapes.map((x) => (
          <Link key={x.cle} href={x.href} className={`mise-en-route-etape${x.fait ? " fait" : ""}`}>
            <span className={`chip-ic ${x.fait ? "t-mint" : "t-lav"}`}>{x.fait ? <Icone nom="controle" /> : <Icone nom={x.icone} />}</span>
            <span>
              <b>{x.titre}</b>
              <small>{x.fait ? "Fait" : x.detail}</small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
