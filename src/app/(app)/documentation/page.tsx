"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { iso } from "@/lib/planning";
import Modal from "@/components/Modal";
import Icone from "@/components/Icone";
import type { NomIcone } from "@/components/Icone";

type Doc = {
  id: string;
  titre: string;
  categorie: string;
  contenu: string | null;
  fichier_path: string | null;
  fichier_nom: string | null;
  fichier_type: string | null;
  fichier_taille: number | null;
  visibilite: "tous" | "responsables";
  epingle: boolean;
  echeance: string | null;
  updated_at: string;
};

const COLONNES = "id, titre, categorie, contenu, fichier_path, fichier_nom, fichier_type, fichier_taille, visibilite, epingle, echeance, updated_at";
const CATEGORIES: Record<string, NomIcone> = {
  Procédures: "liste",
  Hygiène: "hygiene",
  Sécurité: "bouclier",
  Contrats: "contrat",
  Fournisseurs: "camion",
  Factures: "facture",
  Formation: "formation",
  Administratif: "dossier",
  Autre: "document",
};
const TAILLE_MAX = 20 * 1024 * 1024;

const taille = (o: number | null) => (o == null ? "" : o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`);
const joursAvant = (d: string, auj: string) => Math.round((new Date(d + "T00:00").getTime() - new Date(auj + "T00:00").getTime()) / 864e5);

export default function Documentation() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("toutes");
  const [ouvert, setOuvert] = useState<Doc | null>(null);
  const [edition, setEdition] = useState<Doc | "nouveau" | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [aujourdhui] = useState(() => iso(new Date()));
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vivant = true;
    sb.from("documents")
      .select(COLONNES)
      .eq("etablissement_id", etablissement.id)
      .order("epingle", { ascending: false })
      .order("titre")
      .then(({ data }) => vivant && setDocs((data ?? []) as Doc[]));
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (docs ?? []).filter((d) => (categorie === "toutes" || d.categorie === categorie) && (!q || `${d.titre} ${d.contenu ?? ""} ${d.fichier_nom ?? ""}`.toLowerCase().includes(q)));
  }, [docs, recherche, categorie]);

  const echeances = useMemo(() => (docs ?? []).filter((d) => d.echeance && joursAvant(d.echeance, aujourdhui) <= 30).sort((a, b) => a.echeance!.localeCompare(b.echeance!)), [docs, aujourdhui]);

  async function telecharger(d: Doc) {
    if (!d.fichier_path) return;
    const { data, error } = await sb.storage.from("documents").createSignedUrl(d.fichier_path, 120, { download: d.fichier_nom ?? true });
    if (error || !data) return setToast("Fichier inaccessible");
    window.location.href = data.signedUrl;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Établissement</p>
          <h1>Documentation</h1>
          <p>Procédures, contrats, attestations : tout au même endroit, avec les échéances à surveiller.</p>
        </div>
        {gestion && (
          <button className="btn btn-primary" onClick={() => setEdition("nouveau")}>
            + Document
          </button>
        )}
      </div>

      {gestion && echeances.length > 0 && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h2>Échéances à surveiller</h2>
          </div>
          <div className="rows">
            {echeances.map((d) => {
              const j = joursAvant(d.echeance!, aujourdhui);
              return (
                <div key={d.id} className="row">
                  <span className="chip-ic t-yellow"><Icone nom={CATEGORIES[d.categorie] ?? "document"} /></span>
                  <button className="main-txt resa-main" onClick={() => setOuvert(d)}>
                    <b>{d.titre}</b>
                    <small>échéance le {new Date(d.echeance! + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</small>
                  </button>
                  <span className={`pill ${j < 0 ? "t-red" : j <= 7 ? "t-peach" : "t-yellow"}`}>{j < 0 ? `dépassée de ${-j} j` : j === 0 ? "aujourd'hui" : `dans ${j} j`}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="filters">
        <label className="search" style={{ flex: "1 1 240px", background: "var(--card)" }}>
          <Icone nom="recherche" taille={15} />
          <input placeholder="Titre, contenu, nom de fichier…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
        <div className="chips">
          {["toutes", ...Object.keys(CATEGORIES).filter((c) => (docs ?? []).some((d) => d.categorie === c))].map((c) => (
            <button key={c} className={`chip${categorie === c ? " on" : ""}`} onClick={() => setCategorie(c)}>
              {c === "toutes" ? "Tout" : <><Icone nom={CATEGORIES[c]} /> {c}</>}
            </button>
          ))}
        </div>
      </div>

      {!docs ? (
        <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
      ) : !liste.length ? (
        <section className="card empty">
          <b>{docs.length ? "Aucun document ne correspond" : "Aucun document"}</b>
          {!docs.length && gestion && "Ajoute tes procédures (ouverture, fermeture, allergènes…), contrats et attestations."}
        </section>
      ) : (
        <div className="doc-grid">
          {liste.map((d) => (
            <button key={d.id} className="card doc-card" onClick={() => setOuvert(d)}>
              <span className="doc-ic"><Icone nom={CATEGORIES[d.categorie] ?? "document"} taille={20} /></span>
              <span className="doc-body">
                <b>
                  {d.epingle && <><Icone nom="epingle" taille={14} /> </>}
                  {d.titre}
                </b>
                <small className="hint">
                  {d.categorie}
                  {d.fichier_nom ? ` · ${d.fichier_nom.split(".").pop()?.toUpperCase()} ${taille(d.fichier_taille)}` : d.contenu ? " · procédure écrite" : ""}
                </small>
                <span className="person-tags">
                  {d.visibilite === "responsables" && <span className="pill t-lav"><Icone nom="cadenas" taille={12} /> Responsables</span>}
                  {d.echeance && <span className={`pill ${joursAvant(d.echeance, aujourdhui) < 0 ? "t-red" : "t-yellow"}`}>échéance {new Date(d.echeance + "T00:00").toLocaleDateString("fr-FR")}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {ouvert && (
        <Modal
          titre={ouvert.titre}
          sousTitre={`${ouvert.categorie} · mis à jour le ${new Date(ouvert.updated_at).toLocaleDateString("fr-FR")}`}
          onClose={() => setOuvert(null)}
          pied={
            <>
              {gestion && (
                <button
                  className="btn"
                  style={{ marginRight: "auto" }}
                  onClick={() => {
                    setEdition(ouvert);
                    setOuvert(null);
                  }}
                >
                  <Icone nom="modifier" /> Modifier
                </button>
              )}
              {ouvert.fichier_path && (
                <button className="btn btn-primary" onClick={() => telecharger(ouvert)}>
                  ⤓ Télécharger {ouvert.fichier_nom}
                </button>
              )}
            </>
          }
        >
          {ouvert.contenu ? <div className="doc-texte">{ouvert.contenu}</div> : !ouvert.fichier_path && <p className="hint">Document vide.</p>}
          {ouvert.fichier_path && (
            <p className="hint">
              <Icone nom="piece_jointe" /> {ouvert.fichier_nom} · {taille(ouvert.fichier_taille)}
            </p>
          )}
        </Modal>
      )}

      {edition && (
        <ModalDocument
          etablissementId={etablissement.id}
          compteId={compte.id}
          doc={edition === "nouveau" ? undefined : edition}
          onClose={() => setEdition(null)}
          onSaved={(m) => {
            setEdition(null);
            setToast(m);
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

function ModalDocument({ etablissementId, compteId, doc, onClose, onSaved }: { etablissementId: string; compteId: string; doc?: Doc; onClose: () => void; onSaved: (m: string) => void }) {
  const [titre, setTitre] = useState(doc?.titre ?? "");
  const [categorie, setCategorie] = useState(doc?.categorie ?? "Procédures");
  const [contenu, setContenu] = useState(doc?.contenu ?? "");
  const [visibilite, setVisibilite] = useState<Doc["visibilite"]>(doc?.visibilite ?? "tous");
  const [epingle, setEpingle] = useState(doc?.epingle ?? false);
  const [echeance, setEcheance] = useState(doc?.echeance ?? "");
  const [fichier, setFichier] = useState<File | null>(null);
  const [retirerFichier, setRetirerFichier] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const sb = getSupabaseClient()!;

  async function enregistrer() {
    setErreur(null);
    if (!titre.trim()) return setErreur("Donne un titre.");
    if (fichier && fichier.size > TAILLE_MAX) return setErreur("Fichier trop lourd (20 Mo maximum).");
    if (!contenu.trim() && !fichier && (!doc?.fichier_path || retirerFichier)) return setErreur("Écris la procédure ou joins un fichier.");
    setEnvoi(true);
    let fichierChamps: Partial<Doc> = {};
    if (fichier) {
      const propre = fichier.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
      const chemin = `${etablissementId}/${crypto.randomUUID()}-${propre}`;
      const { error } = await sb.storage.from("documents").upload(chemin, fichier, { contentType: fichier.type || undefined });
      if (error) {
        setEnvoi(false);
        return setErreur("Envoi du fichier refusé.");
      }
      fichierChamps = { fichier_path: chemin, fichier_nom: fichier.name, fichier_type: fichier.type || null, fichier_taille: fichier.size };
    } else if (retirerFichier) {
      fichierChamps = { fichier_path: null, fichier_nom: null, fichier_type: null, fichier_taille: null };
    }
    const ligne = { etablissement_id: etablissementId, titre: titre.trim(), categorie, contenu: contenu.trim() || null, visibilite, epingle, echeance: echeance || null, ...fichierChamps };
    const { error } = doc ? await sb.from("documents").update(ligne).eq("id", doc.id) : await sb.from("documents").insert({ ...ligne, created_by: compteId });
    // L'ancien fichier remplacé ou retiré ne sert plus : on le supprime du stockage.
    if (!error && doc?.fichier_path && (fichier || retirerFichier)) await sb.storage.from("documents").remove([doc.fichier_path]);
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé : réservé aux responsables.");
    onSaved(doc ? "Document mis à jour" : "Document ajouté");
  }

  async function supprimer() {
    const { error } = await sb.from("documents").delete().eq("id", doc!.id);
    if (!error && doc!.fichier_path) await sb.storage.from("documents").remove([doc!.fichier_path]);
    if (error) return setErreur("Suppression refusée.");
    onSaved("Document supprimé");
  }

  return (
    <Modal
      titre={doc ? "Modifier le document" : "Nouveau document"}
      onClose={onClose}
      pied={
        <>
          {doc && (
            <span style={{ marginRight: "auto" }}>
              {!suppr ? (
                <button className="btn btn-danger-ghost" onClick={() => setSuppr(true)}>
                  Supprimer
                </button>
              ) : (
                <button className="btn btn-danger" onClick={supprimer}>
                  Confirmer
                </button>
              )}
            </span>
          )}
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Envoi…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="d-titre">Titre</label>
        <input id="d-titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : Procédure de fermeture, Contrat d'entretien hotte" autoFocus={!doc} />
      </div>
      <div className="field">
        <label>Catégorie</label>
        <div className="chips">
          {Object.entries(CATEGORIES).map(([c, i]) => (
            <button key={c} className={`chip${categorie === c ? " on" : ""}`} onClick={() => setCategorie(c)}>
              {i} {c}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="d-contenu">Procédure / notes</label>
        <textarea id="d-contenu" value={contenu} onChange={(e) => setContenu(e.target.value)} rows={7} placeholder={"1. Couper le gaz\n2. Vider les bacs…"} style={{ padding: 10, borderRadius: 11, border: "1px solid var(--line)", resize: "vertical", font: "inherit" }} />
      </div>
      <div className="field">
        <label>Fichier (PDF, photo… 20 Mo max.)</label>
        {fichier ? (
          <span className="chosen">
            <b>{fichier.name}</b>
            <small className="hint">{taille(fichier.size)}</small>
            <button className="icon-btn" onClick={() => setFichier(null)} aria-label="Retirer">
              ✕
            </button>
          </span>
        ) : doc?.fichier_path && !retirerFichier ? (
          <span className="chosen">
            <b>{doc.fichier_nom}</b>
            <button className="link-btn" onClick={() => ref.current?.click()}>
              Remplacer
            </button>
            <button className="icon-btn" onClick={() => setRetirerFichier(true)} aria-label="Retirer le fichier">
              ✕
            </button>
          </span>
        ) : (
          <button className="btn" onClick={() => ref.current?.click()}>
            <Icone nom="piece_jointe" /> Choisir un fichier
          </button>
        )}
        <input ref={ref} type="file" hidden onChange={(e) => e.target.files?.[0] && setFichier(e.target.files[0])} />
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="d-ech">Échéance (facultatif)</label>
          <input id="d-ech" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </div>
        <div className="field">
          <label>Visible par</label>
          <div className="seg seg-2">
            <button className={visibilite === "tous" ? "on" : ""} onClick={() => setVisibilite("tous")}>
              Toute l&apos;équipe
            </button>
            <button className={visibilite === "responsables" ? "on" : ""} onClick={() => setVisibilite("responsables")}>
              <Icone nom="cadenas" taille={14} /> Responsables
            </button>
          </div>
        </div>
      </div>
      <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={epingle} onChange={(e) => setEpingle(e.target.checked)} /> Épingler en haut de la liste
      </label>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
