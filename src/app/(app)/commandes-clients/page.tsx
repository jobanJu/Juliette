"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { nomComplet, useConnecte } from "@/lib/session";
import { iso } from "@/lib/planning";
import { COLONNES_FICHE } from "@/lib/fiches";
import type { Fiche } from "@/lib/fiches";
import { COLONNES_BON, etapeVente, euros, totalBon } from "@/lib/salle";
import type { ArticleCarte, Bon, TableSalle } from "@/lib/salle";
import type { Produit } from "@/lib/stock";
import ModalTable from "@/components/salle/ModalTable";
import ModalVente from "@/components/salle/ModalVente";
import Cuisine from "@/components/salle/Cuisine";
import Carte from "@/components/salle/Carte";
import Icone from "@/components/Icone";

type Onglet = "salle" | "ventes" | "cuisine" | "carte";

export default function CommandesClients() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;

  const [onglet, setOnglet] = useState<Onglet>("salle");
  const [tables, setTables] = useState<TableSalle[]>([]);
  const [carte, setCarte] = useState<ArticleCarte[]>([]);
  const [bons, setBons] = useState<Bon[] | null>(null);
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [produits, setProduits] = useState<Map<string, Produit>>(new Map());
  const [ouverte, setOuverte] = useState<TableSalle | null>(null);
  const [vente, setVente] = useState<{ type: "emporter" | "livraison"; bon?: Bon } | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vivant = true;
    const debutJour = new Date(iso(new Date()) + "T00:00").toISOString();
    Promise.all([
      sb.from("tables_salle").select("id, nom, couverts_max, ordre, active").eq("etablissement_id", etablissement.id).order("ordre").order("nom"),
      sb.from("menu_salle").select("id, nom, categorie, prix_centimes, etat_stock, composition, ordre, ingredients, cout_matiere_centimes").eq("etablissement_id", etablissement.id).order("ordre"),
      sb.from("commandes_salle").select(COLONNES_BON).eq("etablissement_id", etablissement.id).or(`statut.in.(en_cours,envoyee),updated_at.gte.${debutJour}`).order("created_at").limit(500),
      sb.from("fiches_techniques").select(COLONNES_FICHE.replace(", images", "")).eq("etablissement_id", etablissement.id),
      gestion ? sb.from("produits").select("id, nom, unite, prix_unitaire").eq("etablissement_id", etablissement.id) : null,
    ]).then(([t, c, b, f, p]) => {
      if (!vivant) return;
      setTables((t.data ?? []) as TableSalle[]);
      setCarte((c.data ?? []) as ArticleCarte[]);
      setBons((b.data ?? []) as Bon[]);
      setFiches((f.data ?? []) as unknown as Fiche[]);
      setProduits(new Map(((p?.data ?? []) as Produit[]).map((x) => [x.id, x])));
      setMaintenant(Date.now());
    });
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, gestion, version]);

  // Temps réel : la salle et la cuisine voient les bons des autres sans recharger.
  useEffect(() => {
    const canal = sb
      .channel(`salle-${etablissement.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "commandes_salle", filter: `etablissement_id=eq.${etablissement.id}` }, () => recharger())
      .subscribe();
    const i = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => {
      sb.removeChannel(canal);
      clearInterval(i);
    };
  }, [sb, etablissement.id, recharger]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const ouverts = useMemo(() => (bons ?? []).filter((b) => b.statut === "en_cours" || b.statut === "envoyee"), [bons]);
  const bonsDe = useCallback((t: TableSalle) => ouverts.filter((b) => b.table_id === t.id && (b.type_commande ?? "sur_place") === "sur_place"), [ouverts]);
  const ventes = useMemo(
    () =>
      (bons ?? [])
        .filter((b) => b.type_commande === "emporter" || b.type_commande === "livraison")
        .filter((b) => b.statut === "en_cours" || b.statut === "envoyee")
        .sort((a, b) => (a.heure_souhaitee ?? "99").localeCompare(b.heure_souhaitee ?? "99") || a.created_at.localeCompare(b.created_at)),
    [bons],
  );
  const ventesTerminees = useMemo(() => (bons ?? []).filter((b) => (b.type_commande === "emporter" || b.type_commande === "livraison") && b.statut === "terminee"), [bons]);

  const stats = useMemo(() => {
    const surPlace = ouverts.filter((b) => (b.type_commande ?? "sur_place") === "sur_place" && b.table_id);
    const occupees = new Set(surPlace.map((b) => b.table_id));
    const couverts = [...occupees].reduce((s, id) => s + Math.max(0, ...surPlace.filter((b) => b.table_id === id).map((b) => b.couverts)), 0);
    const jour = iso(new Date(maintenant));
    const encaisse = (bons ?? []).filter((b) => b.statut === "terminee" && iso(new Date(b.updated_at)) === jour).reduce((s, b) => s + totalBon(b), 0);
    const enCours = ouverts.reduce((s, b) => s + totalBon(b), 0);
    const enCuisine = ouverts.filter((b) => b.statut === "envoyee" && !b.servi_at).length;
    return { occupees: occupees.size, couverts, encaisse, enCours, enCuisine };
  }, [ouverts, bons, maintenant]);

  const actives = tables.filter((t) => t.active);
  const sauve = (m?: string) => {
    if (m) setToast(m);
    setOuverte(null);
    recharger();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Salle</p>
          <h1>Commandes clients</h1>
          <p>Prise de commande à la table, envoi en cuisine et décompte automatique du stock.</p>
        </div>
      </div>

      <div className="week-nav">
        <div className="seg seg-inline" role="tablist">
          <button role="tab" aria-selected={onglet === "salle"} className={onglet === "salle" ? "on" : ""} onClick={() => setOnglet("salle")}>
            Plan de salle
          </button>
          <button role="tab" aria-selected={onglet === "ventes"} className={onglet === "ventes" ? "on" : ""} onClick={() => setOnglet("ventes")}>
            À emporter & livraison {ventes.length > 0 && <span className="seg-count">{ventes.length}</span>}
          </button>
          <button role="tab" aria-selected={onglet === "cuisine"} className={onglet === "cuisine" ? "on" : ""} onClick={() => setOnglet("cuisine")}>
            Cuisine {stats.enCuisine > 0 && <span className="seg-count seg-alert">{stats.enCuisine}</span>}
          </button>
          {gestion && (
            <button role="tab" aria-selected={onglet === "carte"} className={onglet === "carte" ? "on" : ""} onClick={() => setOnglet("carte")}>
              Carte & tables
            </button>
          )}
        </div>
      </div>

      {!bons ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      ) : onglet === "salle" ? (
        <>
          <div className="grid-stats" style={{ marginBottom: 14 }}>
            <div className="card stat">
              <div className="stat-top">Tables occupées</div>
              <div className="stat-value">
                {stats.occupees}
                <small>/ {actives.length}</small>
              </div>
              <div className="stat-foot">{stats.couverts} couvert(s) en salle</div>
            </div>
            <button className="card stat" onClick={() => setOnglet("cuisine")}>
              <div className="stat-top">En cuisine</div>
              <div className="stat-value" style={{ color: stats.enCuisine ? "var(--peach-ink)" : undefined }}>
                {stats.enCuisine}
              </div>
              <div className="stat-foot">bon(s) à préparer</div>
            </button>
            <div className="card stat">
              <div className="stat-top">En cours</div>
              <div className="stat-value">{euros(stats.enCours)}</div>
              <div className="stat-foot">tables non encaissées</div>
            </div>
            <div className="card stat">
              <div className="stat-top">Encaissé aujourd&apos;hui</div>
              <div className="stat-value">{euros(stats.encaisse)}</div>
              <div className="stat-foot">tables clôturées</div>
            </div>
          </div>

          {!actives.length ? (
            <section className="card empty">
              <b>Aucune table</b>
              {gestion ? "Crée tes tables dans l'onglet « Carte & tables »." : "Un responsable doit d'abord créer les tables."}
            </section>
          ) : (
            <div className="plan-salle">
              {actives.map((t) => {
                const bs = bonsDe(t);
                const occupe = bs.length > 0;
                const total = bs.reduce((s, b) => s + totalBon(b), 0);
                const premier = bs[0];
                const minutes = premier ? Math.floor((maintenant - new Date(premier.created_at).getTime()) / 60000) : 0;
                const attente = bs.some((b) => b.statut === "envoyee" && !b.servi_at);
                const brouillon = bs.some((b) => b.statut === "en_cours");
                return (
                  <button key={t.id} className={`table-card${occupe ? " occupee" : ""}${attente ? " attente" : ""}`} onClick={() => setOuverte(t)}>
                    <span className="table-num">{t.nom}</span>
                    {occupe ? (
                      <>
                        <b>{euros(total)}</b>
                        <small>
                          {Math.max(...bs.map((b) => b.couverts))} couv. · {minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`}
                        </small>
                        <span className={`pill ${brouillon ? "t-lav" : attente ? "t-peach" : "t-mint"}`}>{brouillon ? "Brouillon" : attente ? "En cuisine" : "Servie"}</span>
                      </>
                    ) : (
                      <>
                        <small>{t.couverts_max} places</small>
                        <span className="pill t-mint">Libre</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : onglet === "ventes" ? (
        <Ventes ventes={ventes} terminees={ventesTerminees} maintenant={maintenant} onNouvelle={(type) => setVente({ type })} onOuvrir={(b) => setVente({ type: b.type_commande === "livraison" ? "livraison" : "emporter", bon: b })} />
      ) : onglet === "cuisine" ? (
        <Cuisine bons={ouverts} onChange={(m) => { if (m) setToast(m); recharger(); }} />
      ) : (
        <Carte etablissementId={etablissement.id} carte={carte} tables={tables} fiches={fiches} produits={produits} onChange={(m) => { if (m) setToast(m); recharger(); }} />
      )}

      {ouverte && (
        <ModalTable
          etablissementId={etablissement.id}
          compteId={compte.id}
          compteNom={nomComplet(compte)}
          table={ouverte}
          bons={bonsDe(ouverte)}
          carte={carte}
          fiches={fiches}
          produits={produits}
          onClose={() => setOuverte(null)}
          onChange={sauve}
        />
      )}

      {vente && (
        <ModalVente
          etablissementId={etablissement.id}
          compteId={compte.id}
          compteNom={nomComplet(compte)}
          type={vente.type}
          bon={vente.bon}
          carte={carte}
          fiches={fiches}
          produits={produits}
          onClose={() => setVente(null)}
          onChange={(m) => {
            if (m) setToast(m);
            setVente(null);
            recharger();
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function Ventes({ ventes, terminees, maintenant, onNouvelle, onOuvrir }: { ventes: Bon[]; terminees: Bon[]; maintenant: number; onNouvelle: (t: "emporter" | "livraison") => void; onOuvrir: (b: Bon) => void }) {
  const ca = terminees.reduce((s, b) => s + totalBon(b), 0);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-primary" onClick={() => onNouvelle("livraison")}>
          <Icone nom="livraison" /> Nouvelle livraison
        </button>
        <button className="btn" onClick={() => onNouvelle("emporter")}>
          <Icone nom="emporter" /> À emporter
        </button>
        <span className="hint" style={{ marginLeft: "auto" }}>
          Aujourd&apos;hui : {terminees.length} commande(s) remise(s) · {euros(ca)}
        </span>
      </div>
      {!ventes.length ? (
        <section className="card empty">
          <b>Aucune commande à emporter ou en livraison en cours</b>
          Crée-en une avec les boutons ci-dessus : elle part en cuisine comme un bon de table.
        </section>
      ) : (
        <div className="ventes-grid">
          {ventes.map((b) => {
            const e = etapeVente(b);
            const minutes = Math.floor((maintenant - new Date(b.created_at).getTime()) / 60000);
            const retard = b.heure_souhaitee ? maintenant > new Date(`${b.created_at.slice(0, 10)}T${b.heure_souhaitee}`).getTime() && e.cle !== "route" : false;
            return (
              <button key={b.id} className={`card vente-card${retard ? " vente-retard" : ""}`} onClick={() => onOuvrir(b)}>
                <span className="vente-top">
                  <span><Icone nom={b.type_commande === "livraison" ? "livraison" : "emporter"} /></span>
                  <b>{b.client_nom}</b>
                  <span className={`pill ${e.ton}`}>{e.label}</span>
                </span>
                <small className="hint">
                  {b.heure_souhaitee ? `${b.type_commande === "livraison" ? "livrer" : "retrait"} à ${b.heure_souhaitee.slice(0, 5)}` : "dès que possible"} · commandée il y a {minutes} min
                  {b.plateforme ? ` · ${b.plateforme}` : ""}
                </small>
                {b.adresse && <small className="vente-adresse">{b.adresse}</small>}
                <small>{b.lignes.map((l) => `${l.quantite} ${l.nom}`).join(", ")}</small>
                <b style={{ justifySelf: "end" }}>{euros(totalBon(b))}</b>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
