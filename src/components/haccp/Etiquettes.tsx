"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { ajouterJours, depuisIso, iso } from "@/lib/planning";
import { CATEGORIES_DLC, joursRestants, numeroLot, PRODUITS_DLC_DEFAUT } from "@/lib/haccp";
import type { CategorieDlcId, Enregistrement, Etiquette, ProduitDlcConfig } from "@/lib/haccp";
import Icone from "@/components/Icone";

type Props = {
  etablissementId: string;
  etablissementNom: string;
  compteId: string;
  initiales: string;
  liste: Enregistrement<Etiquette>[];
  catalogue?: ProduitDlcConfig[];
  gestion?: boolean;
  onConfigurer?: () => void;
  onSaved: (message: string) => void;
};

export default function Etiquettes(p: Props) {
  const catalogueComplet = useMemo(
    () => (p.catalogue && p.catalogue.length > 0 ? p.catalogue : PRODUITS_DLC_DEFAUT),
    [p.catalogue],
  );

  // Colonne 1 : Catégorie sélectionnée
  const [catActive, setCatActive] = useState<CategorieDlcId>("decongele");

  // Colonne 2 : Produits filtrés & sélection
  const produitsDeCategorie = useMemo(
    () => catalogueComplet.filter((item) => item.categorieId === catActive),
    [catalogueComplet, catActive],
  );

  const [filtreRecherche, setFiltreRecherche] = useState("");
  const [produitChoisi, setProduitChoisi] = useState<ProduitDlcConfig | null>(() => produitsDeCategorie[0] ?? null);
  const [produitPerso, setProduitPerso] = useState("");
  const [modePerso, setModePerso] = useState(false);

  // Colonne 3 : Date limite (DLC) & détails
  const aujourdhui = iso(new Date());
  const [dateFabrique, setDateFabrique] = useState(aujourdhui);
  const [quantite, setQuantite] = useState("");
  const [conservation, setConservation] = useState(() => produitChoisi?.conservation ?? "0 / +3 °C");
  const [dateDlcChoisie, setDateDlcChoisie] = useState(() =>
    ajouterJours(aujourdhui, produitChoisi?.dlcJours ?? 1),
  );

  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aImprimer, setAImprimer] = useState<Enregistrement<Etiquette> | null>(null);
  const [voirTout, setVoirTout] = useState(false);

  // Quand la catégorie change, présélectionner le premier produit de la catégorie
  const changerCategorie = (catId: CategorieDlcId) => {
    setCatActive(catId);
    setModePerso(false);
    setProduitPerso("");
    setFiltreRecherche("");
    const prods = catalogueComplet.filter((i) => i.categorieId === catId);
    const premier = prods[0] ?? null;
    setProduitChoisi(premier);
    if (premier) {
      setConservation(premier.conservation);
      setDateDlcChoisie(ajouterJours(dateFabrique, premier.dlcJours));
    }
  };

  // Quand on choisit un produit dans la colonne 2
  const selectionnerProduit = (prod: ProduitDlcConfig) => {
    setProduitChoisi(prod);
    setModePerso(false);
    setProduitPerso("");
    setConservation(prod.conservation);
    setDateDlcChoisie(ajouterJours(dateFabrique, prod.dlcJours));
    setErreur(null);
  };

  // Date maximale autorisée selon la règle sanitaire : dateFabrique + dlcJours
  const dlcDureeJours = modePerso ? 3 : (produitChoisi?.dlcJours ?? 1);
  const dlcMaxAutorisee = ajouterJours(dateFabrique, dlcDureeJours);

  // Gestion du changement de date : la date peut UNIQUEMENT être modifiée en inférieur (règle maquette HACCP)
  const changerDateDlc = (nouvelleDate: string) => {
    setErreur(null);
    if (nouvelleDate > dlcMaxAutorisee) {
      setErreur(
        `Règle HACCP : La date limite ne peut pas dépasser le plafond réglementaire (${depuisIso(dlcMaxAutorisee).toLocaleDateString("fr-FR")}). Elle peut seulement être raccourcie.`,
      );
      setDateDlcChoisie(dlcMaxAutorisee);
      return;
    }
    if (nouvelleDate < dateFabrique) {
      setErreur("La DLC ne peut pas être antérieure à la date de fabrication/ouverture.");
      setDateDlcChoisie(dateFabrique);
      return;
    }
    setDateDlcChoisie(nouvelleDate);
  };

  // Impression thermique / étiquette
  useEffect(() => {
    if (!aImprimer) return;
    document.body.classList.add("imprime-etiquette");
    const fin = () => {
      document.body.classList.remove("imprime-etiquette");
      setAImprimer(null);
    };
    window.addEventListener("afterprint", fin, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", fin);
      document.body.classList.remove("imprime-etiquette");
    };
  }, [aImprimer]);

  const nomProduitFinal = modePerso ? produitPerso.trim() : (produitChoisi?.nom ?? "");

  async function enregistrerEtOuImprimer(imprimer: boolean) {
    setErreur(null);
    if (!nomProduitFinal) {
      return setErreur("Sélectionne ou saisis un produit dans la colonne 2.");
    }
    if (dateDlcChoisie > dlcMaxAutorisee) {
      return setErreur("La date limite dépasse le seuil réglementaire.");
    }

    setEnvoi(true);
    const catLabel = CATEGORIES_DLC.find((c) => c.id === catActive)?.label ?? "Préparation";
    const jRestants = joursRestants(dateDlcChoisie, dateFabrique);

    const data: Etiquette = {
      produit: nomProduitFinal,
      categorie: catLabel,
      lot: numeroLot(p.initiales),
      fabrique_le: new Date().toISOString(),
      dlc: dateDlcChoisie,
      jours: Math.max(0, jRestants),
      ...(quantite.trim() ? { quantite: quantite.trim() } : {}),
      conservation,
    };

    const sb = getSupabaseClient()!;
    const { data: cree, error } = await sb
      .from("haccp_enregistrements")
      .insert({
        etablissement_id: p.etablissementId,
        compte_id: p.compteId,
        type: "tracabilite",
        data,
      })
      .select("id, type, data, compte_id, auteur, created_at, updated_at")
      .single();

    setEnvoi(false);
    if (error || !cree) {
      return setErreur("Erreur lors de l’enregistrement de l’étiquette.");
    }

    setQuantite("");
    if (modePerso) setProduitPerso("");
    p.onSaved(`Étiquette créée : ${data.produit} (DLC ${depuisIso(data.dlc).toLocaleDateString("fr-FR")})`);
    if (imprimer) setAImprimer(cree as Enregistrement<Etiquette>);
  }

  // Filtrage des produits pour la colonne 2
  const produitsAffichables = produitsDeCategorie.filter(
    (item) => !filtreRecherche.trim() || item.nom.toLowerCase().includes(filtreRecherche.toLowerCase()),
  );

  const visibles = p.liste
    .filter((e) => voirTout || e.data.dlc >= ajouterJours(aujourdhui, -1))
    .sort((a, b) => a.data.dlc.localeCompare(b.data.dlc));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* En-tête avec raccourci de configuration des produits */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 750 }}>Édition rapide d’étiquette DLC</h2>
          <span className="hint" style={{ fontSize: 12 }}>
            Préparations maison, produits décongelés, ouverts ou décontaminés.
          </span>
        </div>
        {p.gestion && p.onConfigurer && (
          <button className="btn btn-sm" onClick={p.onConfigurer} title="Ajouter des produits ou changer les durées de DLC">
            <Icone nom="reglages" /> Paramètres des produits & DLC
          </button>
        )}
      </div>

      {/* Grille 3 Colonnes (Maquette HACCP Page 3) */}
      <div className="haccp-dlc-triptyque">
        {/* COLONNE 1 : Sélectionner une catégorie */}
        <div className="haccp-dlc-col">
          <div className="haccp-dlc-col-header">
            <span className="haccp-dlc-col-step">1</span>
            <h3>Sélectionner une catégorie</h3>
          </div>
          <div className="haccp-dlc-cats-list">
            {CATEGORIES_DLC.map((cat) => {
              const active = catActive === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`haccp-dlc-cat-card ${active ? "on" : ""}`}
                  onClick={() => changerCategorie(cat.id)}
                >
                  <span className="haccp-dlc-cat-icon"><Icone nom={cat.icone} taille={22} /></span>
                  <div className="haccp-dlc-cat-text">
                    <b>{cat.label}</b>
                    <small>Standard : J+{cat.dlcDefautJours} · {cat.conservation}</small>
                  </div>
                  {active && <span className="haccp-dlc-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* COLONNE 2 : Sélectionner un produit */}
        <div className="haccp-dlc-col">
          <div className="haccp-dlc-col-header">
            <span className="haccp-dlc-col-step">2</span>
            <h3>Sélectionner un produit</h3>
          </div>

          <div style={{ padding: "0 10px 10px" }}>
            <input
              type="search"
              className="haccp-dlc-search"
              placeholder="Filtrer les produits…"
              value={filtreRecherche}
              onChange={(e) => setFiltreRecherche(e.target.value)}
            />
          </div>

          <div className="haccp-dlc-prods-list">
            {produitsAffichables.map((item) => {
              const isSelected = !modePerso && produitChoisi?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`haccp-dlc-prod-card ${isSelected ? "on" : ""}`}
                  onClick={() => selectionnerProduit(item)}
                >
                  <span className="haccp-dlc-prod-name">{item.nom}</span>
                  <span className="haccp-dlc-prod-tag">J+{item.dlcJours}</span>
                </button>
              );
            })}

            {/* Option pour saisir un produit hors catalogue */}
            <button
              type="button"
              className={`haccp-dlc-prod-card ${modePerso ? "on" : ""}`}
              onClick={() => {
                setModePerso(true);
                setProduitChoisi(null);
                setDateDlcChoisie(ajouterJours(dateFabrique, 3));
              }}
              style={{ borderStyle: "dashed" }}
            >
              <span className="haccp-dlc-prod-name">+ Produit personnalisé…</span>
              <span className="haccp-dlc-prod-tag">Autre</span>
            </button>
          </div>

          {modePerso && (
            <div style={{ padding: "10px 12px", background: "var(--lavender)", borderTop: "1px solid var(--line)" }}>
              <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                Nom du produit personnalisé :
              </label>
              <input
                autoFocus
                value={produitPerso}
                onChange={(e) => setProduitPerso(e.target.value)}
                placeholder="Ex. : sauce pesto maison"
                style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid var(--line)", padding: "0 8px", background: "#fff" }}
              />
            </div>
          )}
        </div>

        {/* COLONNE 3 : Modifier la date & validation */}
        <div className="haccp-dlc-col">
          <div className="haccp-dlc-col-header">
            <span className="haccp-dlc-col-step">3</span>
            <h3>Modifier la date</h3>
          </div>

          <div className="haccp-dlc-date-box">
            <div className="haccp-dlc-product-summary">
              <span className="hint" style={{ fontSize: 11, textTransform: "uppercase" }}>Produit sélectionné :</span>
              <b style={{ fontSize: 15, color: "var(--purple-ink)", display: "block" }}>
                {nomProduitFinal || "— Aucun produit sélectionné —"}
              </b>
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700 }}>Date d’ouverture / fabrication</label>
              <input
                type="date"
                value={dateFabrique}
                max={aujourdhui}
                onChange={(e) => {
                  setDateFabrique(e.target.value);
                  setDateDlcChoisie(ajouterJours(e.target.value, dlcDureeJours));
                }}
                className="select-sm"
                style={{ width: "100%", height: 38, borderRadius: 8 }}
              />
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label style={{ fontSize: 11, fontWeight: 700 }}>
                  Date Limite de Consommation (DLC)
                </label>
                <span className="hint" style={{ fontSize: 10, color: "var(--purple-ink)" }}>
                  Plafond : {depuisIso(dlcMaxAutorisee).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </div>
              <input
                type="date"
                value={dateDlcChoisie}
                min={dateFabrique}
                max={dlcMaxAutorisee}
                onChange={(e) => changerDateDlc(e.target.value)}
                className="select-sm haccp-dlc-date-input"
                style={{ width: "100%", height: 42, borderRadius: 8, fontWeight: 750, fontSize: 14 }}
              />
              <span className="hint" style={{ fontSize: 11, marginTop: 3 }}>
                <Icone nom="cadenas" taille={14} /> <b>Sécurité HACCP :</b> la date peut uniquement être modifiée <b>à la baisse</b> (vers une date plus courte).
              </span>
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700 }}>Condition de conservation</label>
              <input
                value={conservation}
                onChange={(e) => setConservation(e.target.value)}
                placeholder="Ex. : 0 / +3 °C"
                style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid var(--line)", padding: "0 8px", fontSize: 12.5 }}
              />
            </div>

            <div className="field" style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700 }}>Quantité / Portions (facultatif)</label>
              <input
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                placeholder="Ex. : 2 L, 8 portions..."
                style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid var(--line)", padding: "0 8px", fontSize: 12.5 }}
              />
            </div>

            {erreur && (
              <div className="error" role="alert" style={{ marginTop: 10, fontSize: 12 }}>
                {erreur}
              </div>
            )}

            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 44, fontSize: 14, fontWeight: 800 }}
                onClick={() => enregistrerEtOuImprimer(true)}
                disabled={envoi || !nomProduitFinal}
              >
                {envoi ? "Enregistrement…" : "⎙ IMPRIMER L’ÉTIQUETTE"}
              </button>
              <button
                type="button"
                className="btn"
                style={{ height: 34, fontSize: 12 }}
                onClick={() => enregistrerEtOuImprimer(false)}
                disabled={envoi || !nomProduitFinal}
              >
                Enregistrer sans imprimer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau d'historique des produits étiquetés */}
      <section className="card" style={{ padding: "16px 12px 10px", marginTop: 8 }}>
        <div className="card-head" style={{ padding: "0 4px 8px" }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Produits étiquetés en cours</h2>
            <span className="hint" style={{ fontSize: 12 }}>
              Surveillance des dates limites de consommation (DLC)
            </span>
          </div>
          <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={voirTout} onChange={(e) => setVoirTout(e.target.checked)} /> Afficher les DLC passées
          </label>
        </div>

        {!visibles.length ? (
          <div className="empty" style={{ padding: 20 }}>Aucun produit étiqueté actif pour le moment.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Lot</th>
                  <th>Fabriqué</th>
                  <th>DLC</th>
                  <th>Par</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => {
                  const r = joursRestants(e.data.dlc, aujourdhui);
                  return (
                    <tr key={e.id}>
                      <td>
                        <b style={{ fontWeight: 650 }}>{e.data.produit}</b>
                        {e.data.quantite && <small className="justif">{e.data.quantite}</small>}
                      </td>
                      <td>
                        <span className="hint" style={{ fontSize: 11 }}>
                          {e.data.categorie || "Préparation"}
                        </span>
                      </td>
                      <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>{e.data.lot}</td>
                      <td>
                        {new Date(e.data.fabrique_le).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <span className={`pill ${r < 0 ? "t-red" : r === 0 ? "t-peach" : r === 1 ? "t-yellow" : "t-mint"}`}>
                          {r < 0
                            ? "Dépassée — à jeter"
                            : r === 0
                              ? "Aujourd’hui"
                              : r === 1
                                ? "Demain"
                                : depuisIso(e.data.dlc).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      </td>
                      <td className="hint">{e.auteur}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setAImprimer(e)}
                          title="Réimprimer l'étiquette"
                        >
                          ⎙ Réimprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Gabarit d'impression thermique pour étiquetteuse autocollante */}
      {aImprimer && (
        <div className="etiquette-print" aria-hidden>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #000", paddingBottom: "1mm" }}>
            <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "8pt" }}>{p.etablissementNom}</span>
            <span style={{ fontSize: "7pt" }}>HACCP</span>
          </div>
          <b className="et-produit" style={{ fontSize: "11pt", margin: "1mm 0" }}>{aImprimer.data.produit}</b>
          {aImprimer.data.quantite && <span style={{ fontSize: "8pt" }}>Quantité : {aImprimer.data.quantite}</span>}
          <div style={{ display: "grid", gap: "0.5mm", margin: "1mm 0" }}>
            <span style={{ fontSize: "7.5pt" }}>
              Ouvert / Fabriqué le {new Date(aImprimer.data.fabrique_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            <b className="et-dlc" style={{ fontSize: "11pt", color: "#000" }}>
              DLC : {depuisIso(aImprimer.data.dlc).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}
            </b>
            <span style={{ fontSize: "7.5pt" }}>
              Conserver à : {aImprimer.data.conservation || "0 / +3 °C"}
            </span>
            <span style={{ fontSize: "7pt", fontFamily: "monospace" }}>
              Lot : {aImprimer.data.lot} · Par : {aImprimer.auteur}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
