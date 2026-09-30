"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import Icone from "@/components/Icone";
import { getSupabaseClient } from "@/lib/supabase";
import { FAMILLES, ORDRE_FAMILLES } from "@/lib/categories";
import type { Famille } from "@/lib/categories";
import { CHAMPS, ORDRE_CHAMPS, detecterColonnes, lireCsv, modeleCsv, preparerLignes } from "@/lib/importProduits";
import type { Champ, Correspondance, LigneImport } from "@/lib/importProduits";
import type { Fournisseur, Produit } from "@/lib/stock";
import { memeNom } from "@/lib/stock";

type Props = {
  etablissementId: string;
  compteId: string;
  produits: Produit[];
  fournisseurs: Fournisseur[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

type Etape = "fichier" | "apercu" | "import";

const APERCU_MAX = 300;

export default function ModalImport(p: Props) {
  const [etape, setEtape] = useState<Etape>("fichier");
  const [nomFichier, setNomFichier] = useState("");
  const [brut, setBrut] = useState<unknown[][]>([]);
  const [entete, setEntete] = useState(0);
  const [corresp, setCorresp] = useState<Correspondance>({});
  const [surExistant, setSurExistant] = useState<"maj" | "ignorer">("maj");
  const [corrections, setCorrections] = useState<Record<number, Famille | null>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [avancement, setAvancement] = useState<{ fait: number; total: number } | null>(null);

  const lignes = useMemo(() => {
    const l = preparerLignes(brut, entete, corresp, p.produits);
    return l.map((x) => (x.ligne in corrections ? { ...x, famille: corrections[x.ligne], sous_categorie: corrections[x.ligne] === x.famille ? x.sous_categorie : null, devine: false } : x));
  }, [brut, entete, corresp, p.produits, corrections]);

  const valides = lignes.filter((l) => !l.erreur);
  const nouveaux = valides.filter((l) => !l.existant);
  const aMettreAJour = surExistant === "maj" ? valides.filter((l) => l.existant) : [];
  const ignores = lignes.length - nouveaux.length - aMettreAJour.length;
  const sansFamille = valides.filter((l) => !l.famille).length;
  const colonnes = (brut[Math.max(entete, 0)] ?? []).map((c, i) => (entete >= 0 ? String(c ?? "").trim() : "") || `Colonne ${i + 1}`);

  async function choisir(f: File) {
    setErreur(null);
    setLecture(true);
    try {
      let donnees: unknown[][];
      const nom = f.name.toLowerCase();
      if (nom.endsWith(".csv") || nom.endsWith(".txt")) {
        donnees = lireCsv(await f.text());
      } else if (nom.endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        donnees = (await readSheet(f)) as unknown[][];
      } else {
        setLecture(false);
        return setErreur("Format non pris en charge. Dans Excel, fais « Enregistrer sous » au format .xlsx ou .csv.");
      }
      const d = detecterColonnes(donnees);
      setBrut(donnees);
      setEntete(d.entete);
      setCorresp(d.correspondance);
      setCorrections({});
      setNomFichier(f.name);
      setEtape("apercu");
    } catch {
      setErreur("Impossible de lire ce fichier. Vérifie qu'il s'ouvre bien dans Excel, puis réessaie.");
    }
    setLecture(false);
  }

  function telechargerModele() {
    const url = URL.createObjectURL(new Blob([modeleCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-produits-juliette.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function changerColonne(champ: Champ, valeur: string) {
    setCorresp((c) => {
      const n = { ...c };
      if (valeur === "") delete n[champ];
      else n[champ] = Number(valeur);
      return n;
    });
  }

  async function importer() {
    const sb = getSupabaseClient()!;
    setErreur(null);
    setEtape("import");
    const total = nouveaux.length + aMettreAJour.length;
    setAvancement({ fait: 0, total });
    const ligneBase = (l: LigneImport) => ({
      nom: l.nom,
      unite: l.unite,
      famille: l.famille,
      sous_categorie: l.sous_categorie,
      fournisseur: l.fournisseur,
      reference_fournisseur: l.reference_fournisseur,
      conditionnement: l.conditionnement,
      prix_unitaire: l.prix_unitaire,
      seuil: l.seuil,
      niveau_cible: l.niveau_cible,
    });

    // Fournisseurs cités dans le fichier mais pas encore connus.
    const nomsFourn = [...new Set(valides.map((l) => l.fournisseur).filter(Boolean) as string[])];
    const manquants = nomsFourn.filter((n) => !p.fournisseurs.some((f) => memeNom(f.nom, n)));
    if (manquants.length) await sb.from("fournisseurs").insert(manquants.map((nom) => ({ etablissement_id: p.etablissementId, nom, created_by: p.compteId })));

    let fait = 0;
    let echecs = 0;
    for (let i = 0; i < nouveaux.length; i += 250) {
      const lot = nouveaux.slice(i, i + 250);
      const { error } = await sb.from("produits").insert(lot.map((l) => ({ ...ligneBase(l), etablissement_id: p.etablissementId, origine: "achat" })));
      if (error) echecs += lot.length;
      fait += lot.length;
      setAvancement({ fait, total });
    }
    for (let i = 0; i < aMettreAJour.length; i += 20) {
      const lot = aMettreAJour.slice(i, i + 20);
      const r = await Promise.all(
        lot.map((l) => {
          // On ne remplace pas une valeur existante par une case vide du fichier.
          const maj = Object.fromEntries(Object.entries(ligneBase(l)).filter(([k, v]) => v !== null && !(k === "unite" && corresp.unite === undefined)));
          return sb.from("produits").update(maj).eq("id", l.existant!);
        }),
      );
      echecs += r.filter((x) => x.error).length;
      fait += lot.length;
      setAvancement({ fait, total });
    }
    if (echecs === total && total > 0) {
      setEtape("apercu");
      setAvancement(null);
      return setErreur("Import refusé : seuls les directeurs et responsables peuvent modifier le catalogue.");
    }
    const morceaux = [nouveaux.length && `${nouveaux.length} produit(s) ajouté(s)`, aMettreAJour.length && `${aMettreAJour.length} mis à jour`, manquants.length && `${manquants.length} fournisseur(s) créé(s)`, echecs && `${echecs} en échec`].filter(Boolean);
    p.onSaved(`Import terminé : ${morceaux.join(", ")}`);
  }

  const pied =
    etape === "fichier" ? (
      <button className="btn" onClick={p.onClose}>
        Annuler
      </button>
    ) : etape === "apercu" ? (
      <>
        <button className="btn" style={{ marginRight: "auto" }} onClick={() => setEtape("fichier")}>
          Changer de fichier
        </button>
        <button className="btn" onClick={p.onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={importer} disabled={corresp.nom === undefined || nouveaux.length + aMettreAJour.length === 0}>
          Importer {nouveaux.length + aMettreAJour.length} produit(s)
        </button>
      </>
    ) : null;

  return (
    <Modal titre="Importer des produits" sousTitre={etape === "fichier" ? "Depuis un fichier Excel ou CSV" : nomFichier} onClose={etape === "import" ? () => {} : p.onClose} pied={pied}>
      <div className="import-produits">
        {etape === "fichier" && (
          <>
            <label className={`import-depot${lecture ? " occupe" : ""}`}>
              <input type="file" accept=".xlsx,.csv,.txt" onChange={(e) => e.target.files?.[0] && choisir(e.target.files[0])} disabled={lecture} />
              <Icone nom="envoyer" taille={28} />
              <b>{lecture ? "Lecture du fichier…" : "Choisir un fichier Excel (.xlsx) ou CSV"}</b>
              <small>Une ligne par produit. Les colonnes sont reconnues automatiquement : nom, unité, fournisseur, prix, catégorie…</small>
            </label>
            <div className="import-aide">
              <div>
                <b>Tu pars de zéro ?</b>
                <p className="hint">Télécharge le modèle, remplis-le dans Excel, puis importe-le ici.</p>
              </div>
              <button className="btn" onClick={telechargerModele}>
                <Icone nom="document" /> Télécharger le modèle
              </button>
            </div>
            <p className="hint">
              Tu peux aussi importer directement l&apos;export de ton grossiste (Metro, Transgourmet, Promocash, Pomona…). Si la catégorie n&apos;est pas dans le fichier, Juliette la devine d&apos;après le nom du produit : tu pourras la corriger avant l&apos;import.
            </p>
          </>
        )}

        {etape === "apercu" && (
          <>
            <div className="import-bilan">
              <span className="pill t-mint">{nouveaux.length} nouveau(x)</span>
              <span className="pill t-lav">{valides.filter((l) => l.existant).length} déjà au catalogue</span>
              {ignores > 0 && <span className="pill t-peach">{ignores} ignoré(s)</span>}
              {sansFamille > 0 && <span className="pill t-yellow">{sansFamille} sans catégorie</span>}
            </div>

            <details className="import-colonnes" open={corresp.nom === undefined}>
              <summary>Colonnes reconnues ({Object.keys(corresp).length})</summary>
              <div className="import-grille-colonnes">
                {ORDRE_CHAMPS.map((champ) => (
                  <div key={champ} className="field">
                    <label htmlFor={`col-${champ}`}>{CHAMPS[champ].label}</label>
                    <select id={`col-${champ}`} className="select-sm" value={corresp[champ] ?? ""} onChange={(e) => changerColonne(champ, e.target.value)}>
                      <option value="">— Aucune —</option>
                      {colonnes.map((c, i) => (
                        <option key={i} value={i}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </details>

            {valides.some((l) => l.existant) && (
              <div className="field">
                <label>Produits déjà au catalogue</label>
                <div className="seg seg-inline">
                  <button className={surExistant === "maj" ? "on" : ""} onClick={() => setSurExistant("maj")}>
                    Mettre à jour (prix, fournisseur, catégorie…)
                  </button>
                  <button className={surExistant === "ignorer" ? "on" : ""} onClick={() => setSurExistant("ignorer")}>
                    Ne pas y toucher
                  </button>
                </div>
              </div>
            )}

            <div className="table-wrap import-table">
              <table className="data">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Catégorie</th>
                    <th>Unité</th>
                    <th>Fournisseur</th>
                    <th style={{ textAlign: "right" }}>Prix HT</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.slice(0, APERCU_MAX).map((l) => (
                    <tr key={l.ligne} className={l.erreur ? "import-ko" : ""}>
                      <td>
                        <b style={{ fontWeight: 600 }}>{l.nom || "—"}</b>
                        <small className="justif">ligne {l.ligne}{l.reference_fournisseur ? ` · réf. ${l.reference_fournisseur}` : ""}</small>
                      </td>
                      <td>
                        <select
                          className="select-sm"
                          value={l.famille ?? ""}
                          onChange={(e) => setCorrections((c) => ({ ...c, [l.ligne]: (e.target.value || null) as Famille | null }))}
                          aria-label={`Famille de ${l.nom}`}
                          disabled={!!l.erreur}
                        >
                          <option value="">À classer</option>
                          {ORDRE_FAMILLES.map((f) => (
                            <option key={f} value={f}>
                              {FAMILLES[f].label}
                            </option>
                          ))}
                        </select>
                        {l.sous_categorie && (
                          <small className="justif">
                            {l.sous_categorie}
                            {l.devine ? " · deviné" : ""}
                          </small>
                        )}
                      </td>
                      <td>{l.unite}</td>
                      <td>{l.fournisseur ?? "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{l.prix_unitaire != null ? `${l.prix_unitaire.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—"}</td>
                      <td>
                        {l.erreur ? (
                          <span className="pill t-red">{l.erreur}</span>
                        ) : l.existant ? (
                          <span className={`pill ${surExistant === "maj" ? "t-lav" : "t-peach"}`}>{surExistant === "maj" ? "Mise à jour" : "Ignoré"}</span>
                        ) : (
                          <span className="pill t-mint">Nouveau</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lignes.length > APERCU_MAX && <p className="hint">Aperçu des {APERCU_MAX} premières lignes sur {lignes.length}. Toutes seront importées.</p>}
            {corresp.nom === undefined && <div className="error">Indique quelle colonne contient le nom des produits.</div>}
          </>
        )}

        {etape === "import" && avancement && (
          <div className="import-progression" role="status">
            <b>
              Import en cours… {avancement.fait} / {avancement.total}
            </b>
            <div className="barre-progression">
              <i style={{ width: `${avancement.total ? (avancement.fait / avancement.total) * 100 : 100}%` }} />
            </div>
          </div>
        )}

        {erreur && (
          <div className="error" role="alert">
            {erreur}
          </div>
        )}
      </div>
    </Modal>
  );
}
