"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { useStock } from "@/lib/useStock";
import { euros, formatQte, memeNom, quantiteSuggeree, STATUT_STOCK } from "@/lib/stock";
import type { EtatStock, Produit } from "@/lib/stock";
import ModalProduit from "@/components/stock/ModalProduit";
import ModalZones from "@/components/stock/ModalZones";
import ModalImport from "@/components/stock/ModalImport";
import ModalClasser from "@/components/stock/ModalClasser";
import { devinerCategorie, FAMILLES, ORDRE_FAMILLES } from "@/lib/categories";
import type { Famille } from "@/lib/categories";
import Modal from "@/components/Modal";
import Icone from "@/components/Icone";

type Onglet = "stock" | "compter";

export default function Stocks() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const { d, stocks, recharger } = useStock(etablissement.id);
  const sb = getSupabaseClient()!;

  const [onglet, setOnglet] = useState<Onglet>("stock");
  const [recherche, setRecherche] = useState("");
  const [zone, setZone] = useState("toutes");
  const [fournisseur, setFournisseur] = useState("tous");
  const [statut, setStatut] = useState<EtatStock["statut"] | "tous">("tous");
  const [famille, setFamille] = useState<Famille | "toutes" | "a_classer">("toutes");
  const [sousCategorie, setSousCategorie] = useState("toutes");
  const [importOuvert, setImportOuvert] = useState(false);
  const [classerOuvert, setClasserOuvert] = useState(false);
  const [produit, setProduit] = useState<Produit | "nouveau" | null>(null);
  const [zonesOuvert, setZonesOuvert] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const sauve = (m: string) => {
    setProduit(null);
    setZonesOuvert(false);
    setImportOuvert(false);
    setClasserOuvert(false);
    setToast(m);
    recharger();
  };

  const zonesDe = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const pz of d?.produitZones ?? []) m.set(pz.produit_id, [...(m.get(pz.produit_id) ?? []), pz.zone_id]);
    return m;
  }, [d]);

  const lignes = useMemo(() => {
    if (!d) return [];
    const q = recherche.trim().toLowerCase();
    return d.produits
      .map((p) => ({ p, s: stocks.get(p.id) as EtatStock }))
      .filter(({ p }) => !q || `${p.nom} ${p.fournisseur ?? ""} ${p.reference_fournisseur ?? ""} ${p.sous_categorie ?? ""}`.toLowerCase().includes(q))
      .filter(({ p }) => famille === "toutes" || (famille === "a_classer" ? !p.famille : p.famille === famille))
      .filter(({ p }) => sousCategorie === "toutes" || (p.sous_categorie ?? "") === sousCategorie)
      .filter(({ p }) => zone === "toutes" || (zone === "aucune" ? !zonesDe.has(p.id) : zonesDe.get(p.id)?.includes(zone)))
      .filter(({ p }) => fournisseur === "tous" || (fournisseur === "aucun" ? !p.fournisseur : memeNom(p.fournisseur, fournisseur)))
      .filter(({ s }) => statut === "tous" || s.statut === statut)
      .sort((a, b) => ["rupture", "bas", "ok", "inconnu"].indexOf(a.s.statut) - ["rupture", "bas", "ok", "inconnu"].indexOf(b.s.statut) || a.p.nom.localeCompare(b.p.nom));
  }, [d, stocks, recherche, zone, fournisseur, statut, zonesDe, famille, sousCategorie]);

  // Nombre de produits par famille, pour les onglets de filtre.
  const parFamille = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of d?.produits ?? []) m.set(p.famille ?? "a_classer", (m.get(p.famille ?? "a_classer") ?? 0) + 1);
    return m;
  }, [d]);
  const sousCategories = useMemo(
    () => (famille === "toutes" || famille === "a_classer" ? [] : [...new Set((d?.produits ?? []).filter((p) => p.famille === famille).map((p) => p.sous_categorie ?? ""))].sort((a, b) => (a ? (b ? a.localeCompare(b) : -1) : 1))),
    [d, famille],
  );
  const aClasser = useMemo(() => (d?.produits ?? []).filter((p) => !p.famille || !p.sous_categorie).map((p) => ({ p, g: devinerCategorie(p.nom, p.famille ?? p.conservation) })).filter(({ p, g }) => (!p.famille && g.famille) || (!p.sous_categorie && g.sous_categorie && g.famille === (p.famille ?? g.famille))), [d]);

  const stats = useMemo(() => {
    if (!d) return null;
    let valeur = 0;
    let alertes = 0;
    let inconnus = 0;
    let dernier = "";
    for (const p of d.produits) {
      const s = stocks.get(p.id) as EtatStock;
      if (s.quantite != null && s.quantite > 0 && p.prix_unitaire) valeur += s.quantite * Number(p.prix_unitaire);
      if (s.statut === "rupture" || s.statut === "bas") alertes++;
      if (s.statut === "inconnu") inconnus++;
      if (s.depuis && s.depuis > dernier) dernier = s.depuis;
    }
    return { valeur, alertes, inconnus, dernier };
  }, [d, stocks]);

  const nomsFournisseurs = useMemo(() => [...new Set((d?.produits ?? []).map((p) => p.fournisseur?.trim()).filter(Boolean) as string[])].sort(), [d]);
  const enListe = useMemo(() => new Set((d?.liste ?? []).map((l) => l.produit_id)), [d]);

  async function aCommander(p: Produit, s: EtatStock) {
    const q = quantiteSuggeree(p, s.quantite) ?? 1;
    const { error } = await sb.from("commande_liste").upsert({ etablissement_id: etablissement.id, produit_id: p.id, quantite: q, added_by: compte.id }, { onConflict: "etablissement_id,produit_id" });
    setToast(error ? "Ajout refusé : réservé aux responsables" : `${p.nom} : ${formatQte(q, p.unite)} ajouté(s) à la liste de commande`);
    recharger();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Stock & achats</p>
          <h1>Stocks</h1>
          <p>Stock théorique = dernier inventaire + réceptions − pertes − ventes en salle.</p>
        </div>
        {gestion && (
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setZonesOuvert(true)}>
              Zones de stockage
            </button>
            {aClasser.length > 0 && (
              <button className="btn" onClick={() => setClasserOuvert(true)}>
                <Icone nom="magie" /> Classer automatiquement ({aClasser.length})
              </button>
            )}
            <button className="btn" onClick={() => setImportOuvert(true)}>
              <Icone nom="envoyer" /> Importer depuis Excel
            </button>
            <button className="btn btn-primary" onClick={() => setProduit("nouveau")}>
              + Produit
            </button>
          </span>
        )}
      </div>

      <div className="week-nav">
        <div className="seg seg-inline" role="tablist">
          <button role="tab" aria-selected={onglet === "stock"} className={onglet === "stock" ? "on" : ""} onClick={() => setOnglet("stock")}>
            État du stock
          </button>
          <button role="tab" aria-selected={onglet === "compter"} className={onglet === "compter" ? "on" : ""} onClick={() => setOnglet("compter")}>
            Faire l&apos;inventaire
          </button>
        </div>
      </div>

      {!d || !stats ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      ) : onglet === "compter" ? (
        <Comptage etablissementId={etablissement.id} compteId={compte.id} gestion={gestion} d={d} stocks={stocks} zonesDe={zonesDe} onSaved={sauve} onZones={() => setZonesOuvert(true)} />
      ) : (
        <>
          <div className="grid-stats" style={{ marginBottom: 14 }}>
            <div className="card stat">
              <div className="stat-top">Valeur du stock</div>
              <div className="stat-value">{euros(stats.valeur)}</div>
              <div className="stat-foot">HT, produits inventoriés</div>
            </div>
            <button className="card stat" onClick={() => setStatut(statut === "bas" ? "tous" : "bas")}>
              <div className="stat-top">À réapprovisionner</div>
              <div className="stat-value" style={{ color: stats.alertes ? "var(--peach-ink)" : undefined }}>
                {stats.alertes}
              </div>
              <div className="stat-foot">en rupture ou sous le seuil</div>
            </button>
            <button className="card stat" onClick={() => setStatut(statut === "inconnu" ? "tous" : "inconnu")}>
              <div className="stat-top">Jamais inventoriés</div>
              <div className="stat-value">{stats.inconnus}</div>
              <div className="stat-foot">sur {d.produits.length} produits</div>
            </button>
            <div className="card stat">
              <div className="stat-top">Dernier comptage</div>
              <div className="stat-value" style={{ fontSize: 22 }}>
                {stats.dernier ? new Date(stats.dernier).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}
              </div>
              <div className="stat-foot">{stats.dernier ? new Date(stats.dernier).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "aucun inventaire"}</div>
            </div>
          </div>

          <div className="tabs-scroll" style={{ marginBottom: 10 }}>
            <nav className="haccp-tabs familles-tabs" aria-label="Familles de produits">
              <button className={famille === "toutes" ? "on" : ""} onClick={() => { setFamille("toutes"); setSousCategorie("toutes"); }}>
                Tout <small>{d.produits.length}</small>
              </button>
              {ORDRE_FAMILLES.filter((f) => parFamille.has(f)).map((f) => (
                <button key={f} className={famille === f ? "on" : ""} onClick={() => { setFamille(f); setSousCategorie("toutes"); }}>
                  <Icone nom={FAMILLES[f].icone} taille={15} /> {FAMILLES[f].label} <small>{parFamille.get(f)}</small>
                </button>
              ))}
              {parFamille.has("a_classer") && (
                <button className={famille === "a_classer" ? "on" : ""} onClick={() => { setFamille("a_classer"); setSousCategorie("toutes"); }}>
                  À classer <small>{parFamille.get("a_classer")}</small>
                </button>
              )}
            </nav>
          </div>
          {sousCategories.length > 1 && (
            <div className="chips" style={{ marginBottom: 10 }}>
              <button className={`chip${sousCategorie === "toutes" ? " on" : ""}`} onClick={() => setSousCategorie("toutes")}>
                Toutes
              </button>
              {sousCategories.map((sc) => (
                <button key={sc || "aucune"} className={`chip${sousCategorie === sc ? " on" : ""}`} onClick={() => setSousCategorie(sc)}>
                  {sc || "Sans sous-catégorie"}
                </button>
              ))}
            </div>
          )}

          <div className="filters">
            <label className="search" style={{ flex: "1 1 220px", background: "var(--card)" }}>
              <Icone nom="recherche" taille={15} />
              <input placeholder="Produit, fournisseur, référence…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            </label>
            <select className="select-sm" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
              <option value="toutes">Toutes les zones</option>
              {d.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.titre}
                </option>
              ))}
              <option value="aucune">Sans zone</option>
            </select>
            <select className="select-sm" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} aria-label="Fournisseur">
              <option value="tous">Tous les fournisseurs</option>
              {nomsFournisseurs.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              <option value="aucun">Sans fournisseur</option>
            </select>
            <select className="select-sm" value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} aria-label="Statut">
              <option value="tous">Tous les statuts</option>
              {Object.entries(STATUT_STOCK).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <section className="card" style={{ padding: "16px 6px 6px" }}>
            {!lignes.length ? (
              <div className="empty">
                {d.produits.length ? (
                  "Aucun produit ne correspond."
                ) : (
                  <>
                    <b>Le catalogue est vide</b>
                    Importe ta liste de produits depuis Excel plutôt que de les saisir un par un.
                    {gestion && (
                      <p style={{ marginTop: 14 }}>
                        <button className="btn btn-primary" onClick={() => setImportOuvert(true)}>
                          <Icone nom="envoyer" /> Importer depuis Excel
                        </button>
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Catégorie</th>
                      <th>Zone</th>
                      <th style={{ textAlign: "right" }}>Stock</th>
                      <th style={{ textAlign: "right" }}>Seuil / cible</th>
                      <th style={{ textAlign: "right" }}>Valeur</th>
                      <th>Statut</th>
                      {gestion && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map(({ p, s }) => (
                      <tr key={p.id} className={gestion ? "clickable" : ""} onClick={() => gestion && setProduit(p)}>
                        <td>
                          <b style={{ fontWeight: 600 }}>{p.nom}</b>
                          <small className="justif">{[p.fournisseur, p.conditionnement].filter(Boolean).join(" · ") || "—"}</small>
                        </td>
                        <td>
                          {p.famille ? (
                            <>
                              <span className={`pill ${FAMILLES[p.famille].ton}`}>{FAMILLES[p.famille].label}</span>
                              {p.sous_categorie && <small className="justif">{p.sous_categorie}</small>}
                            </>
                          ) : (
                            <span className="hint">À classer</span>
                          )}
                        </td>
                        <td>
                          <span className="person-tags">
                            {(zonesDe.get(p.id) ?? []).map((zid) => {
                              const z = d.zones.find((x) => x.id === zid);
                              return z ? (
                                <span key={zid} className="zone-tag" style={{ borderColor: z.couleur ?? undefined }}>
                                  {z.titre}
                                </span>
                              ) : null;
                            })}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <b>{formatQte(s.quantite, p.unite)}</b>
                          {s.depuis && <small className="justif">inv. {new Date(s.depuis).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</small>}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }} className="hint">
                          {p.seuil != null || p.niveau_cible != null ? `${formatQte(p.seuil)} / ${formatQte(p.niveau_cible)}` : "—"}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{s.quantite != null && s.quantite > 0 && p.prix_unitaire ? euros(s.quantite * Number(p.prix_unitaire)) : "—"}</td>
                        <td>
                          <span className={`pill ${STATUT_STOCK[s.statut].ton}`}>{STATUT_STOCK[s.statut].label}</span>
                        </td>
                        {gestion && (
                          <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                            {enListe.has(p.id) ? (
                              <Link href="/aide-commande" className="hint" style={{ whiteSpace: "nowrap" }}>
                                ✓ en liste
                              </Link>
                            ) : (
                              <button className="btn" style={{ height: 30, whiteSpace: "nowrap" }} onClick={() => aCommander(p, s)} title="Ajouter à la liste de commande">
                                + Commander
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {produit && d && (
        <ModalProduit
          etablissementId={etablissement.id}
          produit={produit === "nouveau" ? undefined : produit}
          zonesDuProduit={produit === "nouveau" ? (zone !== "toutes" && zone !== "aucune" ? [zone] : []) : (zonesDe.get(produit.id) ?? [])}
          zones={d.zones}
          fournisseurs={d.fournisseurs}
          onClose={() => setProduit(null)}
          onSaved={sauve}
        />
      )}
      {importOuvert && d && (
        <ModalImport etablissementId={etablissement.id} compteId={compte.id} produits={d.produits} fournisseurs={d.fournisseurs} onClose={() => setImportOuvert(false)} onSaved={sauve} />
      )}
      {classerOuvert && <ModalClasser propositions={aClasser} onClose={() => setClasserOuvert(false)} onSaved={sauve} />}
      {zonesOuvert && d && (
        <ModalZones etablissementId={etablissement.id} zones={d.zones} nbProduits={(id) => d.produitZones.filter((x) => x.zone_id === id).length} onClose={() => setZonesOuvert(false)} onSaved={sauve} />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function Comptage({
  etablissementId,
  compteId,
  gestion,
  d,
  stocks,
  zonesDe,
  onSaved,
  onZones,
}: {
  etablissementId: string;
  compteId: string;
  gestion: boolean;
  d: NonNullable<ReturnType<typeof useStock>["d"]>;
  stocks: Map<string, EtatStock>;
  zonesDe: Map<string, string[]>;
  onSaved: (m: string) => void;
  onZones: () => void;
}) {
  const [zoneId, setZoneId] = useState(d.zones[0]?.id ?? "");
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ranger, setRanger] = useState(false);

  if (!d.zones.length) {
    return (
      <section className="card empty">
        <b>Aucune zone de stockage</b>
        L&apos;inventaire se fait zone par zone (chambre froide, réserve…).
        {gestion && (
          <p style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={onZones}>
              Créer les zones
            </button>
          </p>
        )}
      </section>
    );
  }

  const zone = d.zones.find((z) => z.id === zoneId) ?? d.zones[0];
  const produits = d.produits.filter((p) => zonesDe.get(p.id)?.includes(zone.id));
  const dernierIci = (pid: string) => d.releves.filter((r) => r.produit_id === pid && r.zone_id === zone.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const saisis = produits.filter((p) => (valeurs[p.id] ?? "").trim() !== "");

  async function enregistrer() {
    setErreur(null);
    const lignes = saisis.map((p) => ({ p, v: Number(valeurs[p.id].replace(",", ".")) }));
    if (lignes.some((l) => !Number.isFinite(l.v) || l.v < 0)) return setErreur("Les quantités doivent être des nombres positifs.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!
      .from("inventaire_releves")
      .insert(lignes.map((l) => ({ etablissement_id: etablissementId, produit_id: l.p.id, zone_id: zone.id, valeur: l.v, created_by: compteId })));
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    setValeurs({});
    onSaved(`${zone.titre} : ${lignes.length} produit(s) compté(s)`);
  }

  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>
        {d.zones.map((z) => (
          <button key={z.id} className={`chip${z.id === zone.id ? " on" : ""}`} onClick={() => { setZoneId(z.id); setValeurs({}); }}>
            {z.titre} · {d.produitZones.filter((x) => x.zone_id === z.id).length}
          </button>
        ))}
      </div>
      <section className="card">
        <div className="card-head">
          <h2>
            {zone.titre} <span className="hint">· {saisis.length} / {produits.length} saisi(s)</span>
          </h2>
          {gestion && (
            <button className="btn" style={{ height: 32 }} onClick={() => setRanger(true)}>
              Ranger des produits ici
            </button>
          )}
        </div>
        {!produits.length ? (
          <div className="empty">
            <b>Aucun produit rangé dans cette zone</b>
            {gestion ? "Clique sur « Ranger des produits ici » pour choisir ce qu'on y trouve." : "Un responsable doit y ranger des produits."}
          </div>
        ) : (
          <div className="count-list">
            {produits.map((p) => {
              const s = stocks.get(p.id);
              const r = dernierIci(p.id);
              return (
                <label key={p.id} className={`count-row${(valeurs[p.id] ?? "").trim() ? " filled" : ""}`}>
                  <span className="main-txt" style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13 }}>{p.nom}</b>
                    <small className="hint">
                      {p.conditionnement ? `${p.conditionnement} · ` : ""}
                      {r ? `dernier comptage ici : ${formatQte(r.valeur, p.unite)}` : "jamais compté ici"}
                      {s?.quantite != null ? ` · théorique ${formatQte(s.quantite, p.unite)}` : ""}
                    </small>
                  </span>
                  <span className="temp-input" style={{ width: 150 }}>
                    <input inputMode="decimal" value={valeurs[p.id] ?? ""} onChange={(e) => setValeurs((v) => ({ ...v, [p.id]: e.target.value }))} placeholder="—" aria-label={`Quantité ${p.nom}`} disabled={!gestion} />
                    <span>{p.unite}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {erreur && (
          <div className="error" role="alert" style={{ marginTop: 10 }}>
            {erreur}
          </div>
        )}
        {gestion && produits.length > 0 && (
          <div className="count-foot">
            <span className="hint">Laisse vide ce que tu n&apos;as pas compté. Mets 0 si le produit est absent.</span>
            <button className="btn btn-primary" onClick={enregistrer} disabled={envoi || !saisis.length}>
              {envoi ? "Enregistrement…" : `Enregistrer ${saisis.length} comptage(s)`}
            </button>
          </div>
        )}
      </section>
      {ranger && <ModalRanger zoneId={zone.id} zoneTitre={zone.titre} produits={d.produits} dejaIci={new Set(produits.map((p) => p.id))} zonesDe={zonesDe} onClose={() => setRanger(false)} onSaved={(m) => { setRanger(false); onSaved(m); }} />}
    </>
  );
}

function ModalRanger({ zoneId, zoneTitre, produits, dejaIci, zonesDe, onClose, onSaved }: { zoneId: string; zoneTitre: string; produits: Produit[]; dejaIci: Set<string>; zonesDe: Map<string, string[]>; onClose: () => void; onSaved: (m: string) => void }) {
  const [choix, setChoix] = useState<Set<string>>(() => new Set(dejaIci));
  const [q, setQ] = useState("");
  const [sansZone, setSansZone] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const liste = produits.filter((p) => (!q.trim() || p.nom.toLowerCase().includes(q.trim().toLowerCase())) && (!sansZone || dejaIci.has(p.id) || !zonesDe.has(p.id)));

  async function valider() {
    const sb = getSupabaseClient()!;
    const ajouts = [...choix].filter((id) => !dejaIci.has(id));
    const retraits = [...dejaIci].filter((id) => !choix.has(id));
    setEnvoi(true);
    const e1 = ajouts.length ? (await sb.from("produit_zones").insert(ajouts.map((produit_id) => ({ produit_id, zone_id: zoneId })))).error : null;
    const e2 = retraits.length ? (await sb.from("produit_zones").delete().eq("zone_id", zoneId).in("produit_id", retraits)).error : null;
    setEnvoi(false);
    if (e1 || e2) return setErreur("Modification refusée.");
    onSaved(`${zoneTitre} : ${ajouts.length} ajouté(s), ${retraits.length} retiré(s)`);
  }

  return (
    <Modal
      titre={`Ranger dans « ${zoneTitre} »`}
      sousTitre={`${choix.size} produit(s) sélectionné(s)`}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={valider} disabled={envoi}>
            Valider
          </button>
        </>
      }
    >
      <label className="search" style={{ background: "var(--card)" }}>
        <Icone nom="recherche" taille={15} />
        <input placeholder="Rechercher un produit" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={sansZone} onChange={(e) => setSansZone(e.target.checked)} /> Seulement les produits sans zone
      </label>
      <div className="pick-list" style={{ maxHeight: 360 }}>
        {liste.map((p) => (
          <label key={p.id} className="pick">
            <input
              type="checkbox"
              checked={choix.has(p.id)}
              onChange={() => {
                const s = new Set(choix);
                if (s.has(p.id)) s.delete(p.id);
                else s.add(p.id);
                setChoix(s);
              }}
            />
            <span>
              {p.nom} <small className="hint">{p.fournisseur ?? ""}</small>
            </span>
          </label>
        ))}
        {!liste.length && <p className="hint">Aucun produit.</p>}
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
