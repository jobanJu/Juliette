"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { CATALOGUE, CATEGORIES, urlPropre, vueOutil } from "@/lib/outils";
import type { Categorie, OutilEtablissement, Pays } from "@/lib/outils";

const COLONNES = "id, cle, nom, categorie, url, identifiant, contact, note, ordre";

export default function OutilsExternes() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;
  const [outils, setOutils] = useState<OutilEtablissement[] | null>(null);
  const [version, setVersion] = useState(0);
  const [catalogue, setCatalogue] = useState(false);
  const [edite, setEdite] = useState<OutilEtablissement | "nouveau" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    sb.from("outils_externes")
      .select(COLONNES)
      .eq("etablissement_id", etablissement.id)
      .order("ordre")
      .then(({ data }) => setOutils((data ?? []) as OutilEtablissement[]));
  }, [sb, etablissement.id, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const parCategorie = useMemo(() => {
    const m = new Map<Categorie, OutilEtablissement[]>();
    for (const o of outils ?? []) {
      const c = vueOutil(o).categorie;
      m.set(c, [...(m.get(c) ?? []), o]);
    }
    return (Object.keys(CATEGORIES) as Categorie[]).filter((c) => m.has(c)).map((c) => ({ c, liste: m.get(c)! }));
  }, [outils]);

  const fini = (m: string) => {
    setCatalogue(false);
    setEdite(null);
    setToast(m);
    recharger();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Établissement</p>
          <h1>Outils externes</h1>
          <p>Les services qui gravitent autour du restaurant, au même endroit : URSSAF, banque, mutuelle, paie, comptabilité, caisse, livraison…</p>
        </div>
        {gestion && (
          <div className="toolbar">
            <button className="btn" onClick={() => setEdite("nouveau")}>
              + Outil personnalisé
            </button>
            <button className="btn btn-primary" onClick={() => setCatalogue(true)}>
              ⧉ Choisir dans le catalogue
            </button>
          </div>
        )}
      </div>

      {!outils ? (
        <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />
      ) : !outils.length ? (
        <section className="card empty">
          <b>Aucun outil pour l&apos;instant</b>
          {gestion ? "Choisis dans le catalogue les services que tu utilises : ils seront à un clic, avec tes numéros client." : "Un responsable n'a pas encore ajouté d'outil."}
          {gestion && (
            <p style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={() => setCatalogue(true)}>
                Ouvrir le catalogue
              </button>
            </p>
          )}
        </section>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {parCategorie.map(({ c, liste }) => (
            <section key={c}>
              <div className="nav-label" style={{ padding: 0, marginBottom: 8 }}>
                {CATEGORIES[c].icone} {CATEGORIES[c].label}
              </div>
              <div className="outils-grid">
                {liste.map((o) => {
                  const v = vueOutil(o);
                  const url = urlPropre(v.url);
                  return (
                    <article key={o.id} className="outil-card">
                      <div className="outil-tete">
                        <span className="outil-logo" aria-hidden>
                          {v.nom.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="main-txt">
                          <b>{v.nom}</b>
                          {v.description && <small>{v.description}</small>}
                        </span>
                      </div>
                      {(o.identifiant || o.contact || o.note) && (
                        <dl className="outil-infos">
                          {o.identifiant && (
                            <>
                              <dt>N° client</dt>
                              <dd>{o.identifiant}</dd>
                            </>
                          )}
                          {o.contact && (
                            <>
                              <dt>Contact</dt>
                              <dd>{o.contact}</dd>
                            </>
                          )}
                          {o.note && (
                            <>
                              <dt>Note</dt>
                              <dd>{o.note}</dd>
                            </>
                          )}
                        </dl>
                      )}
                      <div className="outil-actions">
                        {url && (
                          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
                            Ouvrir ↗
                          </a>
                        )}
                        {gestion && (
                          <button className="btn" onClick={() => setEdite(o)}>
                            Modifier
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {catalogue && outils && <ModalCatalogue etablissementId={etablissement.id} deja={outils} onClose={() => setCatalogue(false)} onSaved={fini} />}
      {edite && <ModalOutil etablissementId={etablissement.id} outil={edite === "nouveau" ? null : edite} ordre={outils?.length ?? 0} onClose={() => setEdite(null)} onSaved={fini} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function ModalCatalogue({ etablissementId, deja, onClose, onSaved }: { etablissementId: string; deja: OutilEtablissement[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [pays, setPays] = useState<Pays | "tous">("tous");
  const [recherche, setRecherche] = useState("");
  const presents = useMemo(() => new Set(deja.map((o) => o.cle)), [deja]);
  const [choix, setChoix] = useState(() => new Set(presents));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const q = recherche.trim().toLowerCase();
  const visibles = CATALOGUE.filter((o) => (pays === "tous" || o.pays.includes(pays)) && (!q || `${o.nom} ${o.description}`.toLowerCase().includes(q)));

  async function enregistrer() {
    const sb = getSupabaseClient()!;
    const ajouts = [...choix].filter((c) => !presents.has(c));
    const retraits = deja.filter((o) => CATALOGUE.some((c) => c.cle === o.cle) && !choix.has(o.cle)).map((o) => o.id);
    setEnvoi(true);
    const e1 = ajouts.length ? (await sb.from("outils_externes").insert(ajouts.map((cle, i) => ({ etablissement_id: etablissementId, cle, ordre: deja.length + i })))).error : null;
    const e2 = !e1 && retraits.length ? (await sb.from("outils_externes").delete().in("id", retraits)).error : null;
    setEnvoi(false);
    if (e1 || e2) return setErreur("Enregistrement refusé : réservé aux responsables ayant l'accès « Outils externes ».");
    onSaved(`${ajouts.length} ajouté(s)${retraits.length ? `, ${retraits.length} retiré(s)` : ""}`);
  }

  return (
    <Modal
      titre="Catalogue des outils"
      sousTitre="Coche les services que tu utilises"
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="seg seg-inline" role="tablist">
          {(["tous", "FR", "BE"] as const).map((p) => (
            <button key={p} role="tab" aria-selected={pays === p} className={pays === p ? "on" : ""} onClick={() => setPays(p)}>
              {p === "tous" ? "Tous" : p === "FR" ? "🇫🇷 France" : "🇧🇪 Belgique"}
            </button>
          ))}
        </div>
        <label className="search" style={{ flex: 1, minWidth: 160 }}>
          <span aria-hidden>⌕</span>
          <input placeholder="Rechercher" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
      </div>
      <div className="catalogue-liste">
        {(Object.keys(CATEGORIES) as Categorie[]).map((c) => {
          const items = visibles.filter((o) => o.categorie === c);
          if (!items.length) return null;
          return (
            <div key={c}>
              <div className="nav-label" style={{ padding: 0, margin: "10px 0 4px" }}>
                {CATEGORIES[c].icone} {CATEGORIES[c].label}
              </div>
              {items.map((o) => (
                <label key={o.cle} className={`catalogue-item${choix.has(o.cle) ? " on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={choix.has(o.cle)}
                    onChange={() =>
                      setChoix((s) => {
                        const n = new Set(s);
                        if (n.has(o.cle)) n.delete(o.cle);
                        else n.add(o.cle);
                        return n;
                      })
                    }
                  />
                  <span className="main-txt">
                    <b>{o.nom}</b>
                    <small>
                      {o.description} · {o.pays.join(" / ")}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          );
        })}
        {!visibles.length && <div className="empty">Rien ne correspond. Ajoute-le en « outil personnalisé ».</div>}
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}

function ModalOutil({ etablissementId, outil, ordre, onClose, onSaved }: { etablissementId: string; outil: OutilEtablissement | null; ordre: number; onClose: () => void; onSaved: (m: string) => void }) {
  const v = outil ? vueOutil(outil) : null;
  const perso = !outil || outil.cle.startsWith("perso-");
  const [f, setF] = useState({
    nom: outil?.nom ?? "",
    categorie: (outil ? v!.categorie : "autre") as Categorie,
    url: outil?.url ?? "",
    identifiant: outil?.identifiant ?? "",
    contact: outil?.contact ?? "",
    note: outil?.note ?? "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const set = (k: keyof typeof f, val: string) => setF((x) => ({ ...x, [k]: val }));

  async function enregistrer() {
    setErreur(null);
    if (perso && !f.nom.trim()) return setErreur("Donne un nom à cet outil.");
    const ligne = {
      nom: perso ? f.nom.trim() : f.nom.trim() || null,
      categorie: perso ? f.categorie : null,
      url: f.url.trim() || null,
      identifiant: f.identifiant.trim() || null,
      contact: f.contact.trim() || null,
      note: f.note.trim() || null,
    };
    const sb = getSupabaseClient()!;
    setEnvoi(true);
    const { error } = outil
      ? await sb.from("outils_externes").update(ligne).eq("id", outil.id)
      : await sb.from("outils_externes").insert({ ...ligne, etablissement_id: etablissementId, cle: `perso-${Date.now().toString(36)}`, ordre });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables ayant l'accès « Outils externes ».");
    onSaved(outil ? "Outil mis à jour" : "Outil ajouté");
  }

  async function retirer() {
    if (!outil) return;
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("outils_externes").delete().eq("id", outil.id);
    setEnvoi(false);
    if (error) return setErreur("Suppression refusée.");
    onSaved("Outil retiré");
  }

  return (
    <Modal
      titre={outil ? v!.nom : "Outil personnalisé"}
      onClose={onClose}
      pied={
        <>
          {outil && (
            <button className="btn btn-danger-ghost" onClick={retirer} disabled={envoi} style={{ marginRight: "auto" }}>
              Retirer
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      {perso && (
        <div className="form-2">
          <div className="field">
            <label htmlFor="o-nom">Nom</label>
            <input id="o-nom" value={f.nom} onChange={(e) => set("nom", e.target.value)} placeholder="ex. Expert-comptable" />
          </div>
          <div className="field">
            <label htmlFor="o-cat">Catégorie</label>
            <select id="o-cat" value={f.categorie} onChange={(e) => set("categorie", e.target.value)}>
              {(Object.keys(CATEGORIES) as Categorie[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORIES[c].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="o-url">Adresse du site</label>
        <input id="o-url" type="url" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder={v?.url ?? "https://…"} />
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="o-id">N° client / adhérent</label>
          <input id="o-id" value={f.identifiant} onChange={(e) => set("identifiant", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="o-contact">Interlocuteur</label>
          <input id="o-contact" value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Nom, téléphone, e-mail" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="o-note">Note</label>
        <input id="o-note" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Échéances, contrat…" />
      </div>
      <p className="hint">🔒 Ne note jamais de mot de passe ici : utilise un gestionnaire de mots de passe.</p>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
