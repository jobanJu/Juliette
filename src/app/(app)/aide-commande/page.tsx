"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { nomComplet, useConnecte } from "@/lib/session";
import { useStock } from "@/lib/useStock";
import { euros, formatQte, memeNom, quantiteSuggeree } from "@/lib/stock";
import type { Commande, EtatStock, Fournisseur, LigneCommande, Produit } from "@/lib/stock";
import ModalFournisseur from "@/components/stock/ModalFournisseur";
import Modal from "@/components/Modal";

type Onglet = "liste" | "envoyees" | "fournisseurs";
type Groupe = { cle: string; nom: string; fournisseur: Fournisseur | undefined; lignes: { p: Produit; quantite: number; s: EtatStock | undefined }[] };

export default function Commandes() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const { d, stocks, produitParId, recharger } = useStock(etablissement.id);
  const sb = getSupabaseClient()!;

  const [onglet, setOnglet] = useState<Onglet>("liste");
  const [fournEdit, setFournEdit] = useState<Fournisseur | "nouveau" | null>(null);
  const [preparer, setPreparer] = useState<Groupe | null>(null);
  const [ajout, setAjout] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const sauve = (m: string) => {
    setFournEdit(null);
    setPreparer(null);
    setToast(m);
    recharger();
  };

  const groupes = useMemo<Groupe[]>(() => {
    if (!d) return [];
    const m = new Map<string, Groupe>();
    for (const l of d.liste) {
      const p = produitParId.get(l.produit_id);
      if (!p) continue;
      const cle = (p.fournisseur ?? "").trim().toLowerCase() || "—";
      const g = m.get(cle) ?? { cle, nom: p.fournisseur?.trim() || "Sans fournisseur", fournisseur: d.fournisseurs.find((f) => memeNom(f.nom, p.fournisseur)), lignes: [] };
      g.lignes.push({ p, quantite: Number(l.quantite), s: stocks.get(p.id) });
      m.set(cle, g);
    }
    return [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  }, [d, produitParId, stocks]);

  const suggestions = useMemo(() => {
    if (!d) return [];
    const enListe = new Set(d.liste.map((l) => l.produit_id));
    return d.produits
      .map((p) => ({ p, s: stocks.get(p.id) as EtatStock }))
      .filter(({ p, s }) => !enListe.has(p.id) && (s.statut === "rupture" || s.statut === "bas"))
      .map(({ p, s }) => ({ p, s, q: quantiteSuggeree(p, s.quantite) ?? 1 }));
  }, [d, stocks]);

  const doublons = useMemo(() => {
    const vus = new Map<string, number>();
    for (const f of d?.fournisseurs ?? []) vus.set(f.nom.trim().toLowerCase(), (vus.get(f.nom.trim().toLowerCase()) ?? 0) + 1);
    return [...vus.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  }, [d]);

  async function mettreQuantite(p: Produit, q: number) {
    if (!Number.isFinite(q)) return;
    const { error } =
      q <= 0
        ? await sb.from("commande_liste").delete().eq("etablissement_id", etablissement.id).eq("produit_id", p.id)
        : await sb.from("commande_liste").upsert({ etablissement_id: etablissement.id, produit_id: p.id, quantite: q, added_by: compte.id }, { onConflict: "etablissement_id,produit_id" });
    if (error) setToast("Modification refusée : réservée aux responsables");
    recharger();
  }

  async function ajouterSuggestions() {
    const { error } = await sb
      .from("commande_liste")
      .upsert(suggestions.map(({ p, q }) => ({ etablissement_id: etablissement.id, produit_id: p.id, quantite: q, added_by: compte.id })), { onConflict: "etablissement_id,produit_id" });
    setToast(error ? "Ajout refusé" : `${suggestions.length} produit(s) ajouté(s) à la liste`);
    recharger();
  }

  const recherchables = ajout.trim() && d ? d.produits.filter((p) => p.nom.toLowerCase().includes(ajout.trim().toLowerCase()) && !d.liste.some((l) => l.produit_id === p.id)).slice(0, 8) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Stock & achats</p>
          <h1>Commandes</h1>
          <p>Ce qu&apos;il faut commander, chez qui, et pour combien.</p>
        </div>
        {gestion && onglet === "fournisseurs" && (
          <button className="btn btn-primary" onClick={() => setFournEdit("nouveau")}>
            + Fournisseur
          </button>
        )}
      </div>

      <div className="week-nav">
        <div className="seg seg-inline" role="tablist">
          {(
            [
              ["liste", "À commander", d?.liste.length ?? 0],
              ["envoyees", "Envoyées", null],
              ["fournisseurs", "Fournisseurs", d?.fournisseurs.length ?? 0],
            ] as const
          ).map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={onglet === k} className={onglet === k ? "on" : ""} onClick={() => setOnglet(k)}>
              {l} {n !== null && <span className="seg-count">{n}</span>}
            </button>
          ))}
        </div>
      </div>

      {!d ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      ) : onglet === "liste" ? (
        <div style={{ display: "grid", gap: 14 }}>
          {gestion && suggestions.length > 0 && (
            <div className="banner" style={{ margin: 0 }}>
              <span>
                <b>{suggestions.length} produit(s) sous le seuil</b> ne sont pas encore dans la liste :{" "}
                {suggestions
                  .slice(0, 5)
                  .map(({ p, q }) => `${p.nom} (${formatQte(q, p.unite)})`)
                  .join(", ")}
                {suggestions.length > 5 ? "…" : ""}
              </span>
              <button className="btn btn-primary" onClick={ajouterSuggestions}>
                Tout ajouter
              </button>
            </div>
          )}

          {gestion && (
            <div style={{ position: "relative", maxWidth: 420 }}>
              <label className="search" style={{ background: "var(--card)" }}>
                <span aria-hidden>＋</span>
                <input placeholder="Ajouter un produit à la liste…" value={ajout} onChange={(e) => setAjout(e.target.value)} />
              </label>
              {recherchables.length > 0 && (
                <div className="suggest">
                  {recherchables.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setAjout("");
                        mettreQuantite(p, quantiteSuggeree(p, stocks.get(p.id)?.quantite ?? null) ?? 1);
                      }}
                    >
                      {p.nom} <small className="hint">{p.fournisseur ?? "sans fournisseur"}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!groupes.length ? (
            <section className="card empty">
              <b>La liste de commande est vide</b>
              Ajoute des produits ici ou depuis Stocks (« + Commander »). Les produits sous le seuil te seront proposés automatiquement.
            </section>
          ) : (
            groupes.map((g) => <CarteFournisseur key={g.cle} g={g} gestion={gestion} onQuantite={mettreQuantite} onPreparer={() => setPreparer(g)} />)
          )}
        </div>
      ) : onglet === "envoyees" ? (
        <Envoyees commandes={d.commandes} receptions={d.receptions} />
      ) : (
        <section className="card" style={{ padding: "16px 6px 6px" }}>
          {doublons.length > 0 && (
            <div className="banner" style={{ margin: "0 10px 12px", background: "var(--yellow)", borderColor: "#eedda6" }}>
              <span>
                <b>Fournisseurs en double :</b> {doublons.join(", ")}. Supprime les doublons pour éviter de répartir les commandes sur deux fiches.
              </span>
            </div>
          )}
          {!d.fournisseurs.length ? (
            <div className="empty">Aucun fournisseur.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th>E-mail de commande</th>
                    <th style={{ textAlign: "right" }}>TVA</th>
                    <th style={{ textAlign: "right" }}>Minimum</th>
                    <th style={{ textAlign: "right" }}>Produits</th>
                  </tr>
                </thead>
                <tbody>
                  {d.fournisseurs.map((f) => (
                    <tr key={f.id} className={gestion ? "clickable" : ""} onClick={() => gestion && setFournEdit(f)}>
                      <td>
                        <b style={{ fontWeight: 600 }}>{f.nom}</b>
                        {doublons.includes(f.nom.trim().toLowerCase()) && <small className="justif" style={{ color: "var(--yellow-ink)" }}>doublon</small>}
                      </td>
                      <td>{f.email ?? <span className="hint">à renseigner</span>}</td>
                      <td style={{ textAlign: "right" }}>{f.tva_pct != null ? `${Number(f.tva_pct).toLocaleString("fr-FR")} %` : "—"}</td>
                      <td style={{ textAlign: "right" }}>{f.minimum_commande ? euros(Number(f.minimum_commande)) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{d.produits.filter((p) => memeNom(p.fournisseur, f.nom)).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {fournEdit && <ModalFournisseur etablissementId={etablissement.id} compteId={compte.id} fournisseur={fournEdit === "nouveau" ? undefined : fournEdit} onClose={() => setFournEdit(null)} onSaved={sauve} />}
      {preparer && <ModalEnvoi g={preparer} etablissementId={etablissement.id} etablissementNom={etablissement.nom} compteId={compte.id} signataire={nomComplet(compte)} onClose={() => setPreparer(null)} onSaved={sauve} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function totaux(g: Groupe) {
  const ht = g.lignes.reduce((s, l) => s + l.quantite * Number(l.p.prix_unitaire ?? 0), 0);
  const tva = ht * (Number(g.fournisseur?.tva_pct ?? 5.5) / 100);
  const minimum = Number(g.fournisseur?.minimum_commande ?? 0);
  return { ht, tva, ttc: ht + tva, minimum, sousMinimum: minimum > 0 && ht < minimum, sansPrix: g.lignes.some((l) => !l.p.prix_unitaire) };
}

function CarteFournisseur({ g, gestion, onQuantite, onPreparer }: { g: Groupe; gestion: boolean; onQuantite: (p: Produit, q: number) => void; onPreparer: () => void }) {
  const t = totaux(g);
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          {g.nom} <span className="hint">· {g.lignes.length} produit(s)</span>
        </h2>
        <span className="hint">{g.fournisseur?.email ?? (g.fournisseur ? "e-mail à renseigner" : "fiche fournisseur absente")}</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Produit</th>
              <th style={{ textAlign: "right" }}>En stock</th>
              <th style={{ textAlign: "right" }}>À commander</th>
              <th style={{ textAlign: "right" }}>Prix HT</th>
              <th style={{ textAlign: "right" }}>Total HT</th>
              {gestion && <th />}
            </tr>
          </thead>
          <tbody>
            {g.lignes.map(({ p, quantite, s }) => (
              <tr key={p.id}>
                <td>
                  <b style={{ fontWeight: 600 }}>{p.nom}</b>
                  <small className="justif">{[p.conditionnement, p.reference_fournisseur && `réf. ${p.reference_fournisseur}`].filter(Boolean).join(" · ")}</small>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }} className={s?.statut === "rupture" ? "th-ko" : ""}>
                  {formatQte(s?.quantite, p.unite)}
                </td>
                <td style={{ textAlign: "right" }}>
                  {gestion ? (
                    <span className="temp-input" style={{ justifyContent: "flex-end" }}>
                      <input
                        key={quantite}
                        defaultValue={String(quantite).replace(".", ",")}
                        inputMode="decimal"
                        style={{ width: 80, height: 34, fontSize: 14, textAlign: "right" }}
                        onBlur={(e) => {
                          const v = Number(e.target.value.replace(",", "."));
                          if (v !== quantite) onQuantite(p, v);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        aria-label={`Quantité ${p.nom}`}
                      />
                      <span>{p.unite}</span>
                    </span>
                  ) : (
                    formatQte(quantite, p.unite)
                  )}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{p.prix_unitaire ? euros(Number(p.prix_unitaire)) : <span className="hint">?</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{p.prix_unitaire ? euros(quantite * Number(p.prix_unitaire)) : "—"}</td>
                {gestion && (
                  <td style={{ textAlign: "right" }}>
                    <button className="icon-btn" onClick={() => onQuantite(p, 0)} aria-label="Retirer de la liste">
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="order-foot">
        <span>
          <b>{euros(t.ht)} HT</b> <span className="hint">· {euros(t.ttc)} TTC</span>
          {t.sousMinimum && <span className="pill t-peach" style={{ marginLeft: 8 }}>Minimum {euros(t.minimum)} non atteint</span>}
          {t.sansPrix && <span className="pill t-lav" style={{ marginLeft: 8 }}>Prix manquants</span>}
        </span>
        {gestion && (
          <button className="btn btn-primary" onClick={onPreparer}>
            Préparer la commande →
          </button>
        )}
      </div>
    </section>
  );
}

function ModalEnvoi({ g, etablissementId, etablissementNom, compteId, signataire, onClose, onSaved }: { g: Groupe; etablissementId: string; etablissementNom: string; compteId: string; signataire: string; onClose: () => void; onSaved: (m: string) => void }) {
  const t = totaux(g);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const texte = [
    `Bonjour,`,
    ``,
    `Merci de nous livrer la commande suivante pour ${etablissementNom} :`,
    ``,
    ...g.lignes.map((l) => `- ${l.p.nom}${l.p.reference_fournisseur ? ` (réf. ${l.p.reference_fournisseur})` : ""} : ${formatQte(l.quantite, l.p.unite)}${l.p.conditionnement ? ` [${l.p.conditionnement}]` : ""}`),
    ``,
    t.ht ? `Montant estimé : ${euros(t.ht)} HT.` : "",
    `Merci de nous confirmer la date de livraison.`,
    ``,
    `Cordialement,`,
    signataire,
    etablissementNom,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  const email = g.fournisseur?.email ?? "";
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Commande ${etablissementNom} du ${new Date().toLocaleDateString("fr-FR")}`)}&body=${encodeURIComponent(texte)}`;

  async function marquerEnvoyee() {
    setErreur(null);
    setEnvoi(true);
    const sb = getSupabaseClient()!;
    const lignes: LigneCommande[] = g.lignes.map((l) => ({ produit_id: l.p.id, nom: l.p.nom, unite: l.p.unite, quantite: l.quantite, prixUnitaireHT: Number(l.p.prix_unitaire ?? 0), reference: l.p.reference_fournisseur }));
    const { error } = await sb.from("commandes_envoyees").insert({ etablissement_id: etablissementId, fournisseur_id: g.fournisseur?.id ?? null, fournisseur_nom: g.nom, fournisseur_email: email || null, lignes, created_by: compteId });
    if (error) {
      setEnvoi(false);
      return setErreur("Enregistrement refusé : réservé aux responsables.");
    }
    await sb.from("commande_liste").delete().eq("etablissement_id", etablissementId).in("produit_id", g.lignes.map((l) => l.p.id));
    setEnvoi(false);
    onSaved(`Commande ${g.nom} enregistrée comme envoyée`);
  }

  return (
    <Modal
      titre={`Commande ${g.nom}`}
      sousTitre={`${g.lignes.length} produit(s) · ${euros(t.ht)} HT`}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={() => navigator.clipboard.writeText(texte).then(() => setCopie(true))} style={{ marginRight: "auto" }}>
            {copie ? "✓ Copié" : "Copier le texte"}
          </button>
          <button className="btn btn-primary" onClick={marquerEnvoyee} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Marquer comme envoyée"}
          </button>
        </>
      }
    >
      {t.sousMinimum && <div className="banner" style={{ margin: 0, background: "var(--yellow)", borderColor: "#eedda6" }}>Le minimum de commande ({euros(t.minimum)} HT) n&apos;est pas atteint : le fournisseur peut facturer des frais ou refuser.</div>}
      <pre className="invite-msg" style={{ maxHeight: 280, overflowY: "auto" }}>
        {texte}
      </pre>
      {email ? (
        <a className="btn" href={mailto}>
          ✉ Ouvrir dans ma messagerie ({email})
        </a>
      ) : (
        <p className="hint">Pas d&apos;e-mail pour ce fournisseur : copie le texte (SMS, WhatsApp, commande en ligne…) ou renseigne son e-mail dans l&apos;onglet Fournisseurs.</p>
      )}
      <p className="hint">Une fois la commande passée, clique sur « Marquer comme envoyée » : elle sort de la liste et t&apos;attendra dans Réception.</p>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}

function Envoyees({ commandes, receptions }: { commandes: Commande[]; receptions: { commande_id: string | null; received_at: string; lignes: { etat: string }[] }[] }) {
  if (!commandes.length) return <section className="card empty">Aucune commande envoyée ces 6 derniers mois.</section>;
  return (
    <section className="card" style={{ padding: "16px 6px 6px" }}>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Fournisseur</th>
              <th style={{ textAlign: "right" }}>Produits</th>
              <th style={{ textAlign: "right" }}>Montant HT</th>
              <th>Réception</th>
            </tr>
          </thead>
          <tbody>
            {commandes.map((c) => {
              const r = receptions.find((x) => x.commande_id === c.id);
              const anomalies = r?.lignes.filter((l) => l.etat !== "conforme").length ?? 0;
              return (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(c.envoyee_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td>
                    <b style={{ fontWeight: 600 }}>{c.fournisseur_nom}</b>
                    <small className="justif">{(c.lignes ?? []).map((l) => l.nom).join(", ")}</small>
                  </td>
                  <td style={{ textAlign: "right" }}>{c.lignes?.length ?? 0}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{euros((c.lignes ?? []).reduce((s, l) => s + Number(l.quantite) * Number(l.prixUnitaireHT ?? 0), 0))}</td>
                  <td>
                    {r ? (
                      <span className={`pill ${anomalies ? "t-peach" : "t-mint"}`}>
                        Reçue le {new Date(r.received_at).toLocaleDateString("fr-FR")}
                        {anomalies ? ` · ${anomalies} anomalie(s)` : ""}
                      </span>
                    ) : (
                      <Link href="/reception" className="pill t-yellow">
                        En attente → réceptionner
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
