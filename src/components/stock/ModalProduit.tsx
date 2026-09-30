"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { UNITES } from "@/lib/stock";
import { devinerCategorie, FAMILLES, ORDRE_FAMILLES } from "@/lib/categories";
import type { Famille } from "@/lib/categories";
import type { Fournisseur, Produit, Zone } from "@/lib/stock";

type Props = {
  etablissementId: string;
  produit?: Produit;
  zonesDuProduit: string[];
  zones: Zone[];
  fournisseurs: Fournisseur[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export default function ModalProduit(p: Props) {
  const x = p.produit;
  const [nom, setNom] = useState(x?.nom ?? "");
  const [unite, setUnite] = useState(x?.unite ?? "kg");
  const [fournisseur, setFournisseur] = useState(x?.fournisseur ?? "");
  const [conditionnement, setConditionnement] = useState(x?.conditionnement ?? "");
  const [prix, setPrix] = useState(x?.prix_unitaire != null ? String(x.prix_unitaire) : "");
  const [reference, setReference] = useState(x?.reference_fournisseur ?? "");
  const [seuil, setSeuil] = useState(x?.seuil != null ? String(x.seuil) : "");
  const [cible, setCible] = useState(x?.niveau_cible != null ? String(x.niveau_cible) : "");
  const [famille, setFamille] = useState<Famille | "">(x?.famille ?? "");
  const [sousCategorie, setSousCategorie] = useState(x?.sous_categorie ?? "");
  // Tant que la catégorie n'a pas été choisie à la main, elle suit le nom saisi.
  const [categorieManuelle, setCategorieManuelle] = useState(Boolean(x?.famille));

  function changerNom(v: string) {
    setNom(v);
    if (categorieManuelle) return;
    const g = devinerCategorie(v);
    setFamille(g.famille ?? "");
    setSousCategorie(g.sous_categorie ?? "");
  }
  const [zones, setZones] = useState<Set<string>>(() => new Set(p.zonesDuProduit));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const sb = getSupabaseClient()!;

  async function enregistrer() {
    setErreur(null);
    if (!nom.trim()) return setErreur("Le nom est obligatoire.");
    const vals = { prix: num(prix), seuil: num(seuil), cible: num(cible) };
    if (Object.values(vals).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return setErreur("Prix, seuil et cible : des nombres positifs.");
    if (vals.seuil !== null && vals.cible !== null && vals.cible < vals.seuil) return setErreur("Le niveau cible doit être au-dessus du seuil d'alerte.");
    setEnvoi(true);
    const ligne = {
      etablissement_id: p.etablissementId,
      nom: nom.trim(),
      unite: unite.trim() || "pièce",
      fournisseur: fournisseur.trim() || null,
      conditionnement: conditionnement.trim() || null,
      prix_unitaire: vals.prix,
      reference_fournisseur: reference.trim() || null,
      seuil: vals.seuil,
      niveau_cible: vals.cible,
      famille: famille || null,
      sous_categorie: famille ? sousCategorie.trim() || null : null,
      ...(x ? {} : { origine: "achat" }),
    };
    const r = x ? await sb.from("produits").update(ligne).eq("id", x.id).select("id").single() : await sb.from("produits").insert(ligne).select("id").single();
    if (r.error || !r.data) {
      setEnvoi(false);
      return setErreur("Enregistrement refusé : réservé aux responsables.");
    }
    const id = r.data.id as string;
    const avant = new Set(p.zonesDuProduit);
    const ajouts = [...zones].filter((z) => !avant.has(z));
    const retraits = [...avant].filter((z) => !zones.has(z));
    if (ajouts.length) await sb.from("produit_zones").insert(ajouts.map((zone_id) => ({ produit_id: id, zone_id })));
    if (retraits.length) await sb.from("produit_zones").delete().eq("produit_id", id).in("zone_id", retraits);
    setEnvoi(false);
    p.onSaved(x ? "Produit mis à jour" : `« ${ligne.nom} » ajouté au catalogue`);
  }

  async function supprimer() {
    setEnvoi(true);
    const { error } = await sb.from("produits").delete().eq("id", x!.id);
    setEnvoi(false);
    if (error) return setErreur("Suppression refusée.");
    p.onSaved("Produit supprimé");
  }

  return (
    <Modal
      titre={x ? x.nom : "Nouveau produit"}
      sousTitre="Fiche produit du catalogue"
      onClose={p.onClose}
      pied={
        <>
          {x && (
            <span style={{ marginRight: "auto" }}>
              {!suppr ? (
                <button className="btn btn-danger-ghost" onClick={() => setSuppr(true)} disabled={envoi}>
                  Supprimer
                </button>
              ) : (
                <button className="btn btn-danger" onClick={supprimer} disabled={envoi} title="Supprime aussi ses relevés d'inventaire et ses pertes">
                  Confirmer (efface son historique)
                </button>
              )}
            </span>
          )}
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="form-2">
        <div className="field">
          <label htmlFor="p-nom">Nom *</label>
          <input id="p-nom" value={nom} onChange={(e) => changerNom(e.target.value)} autoFocus={!x} />
        </div>
        <div className="field">
          <label htmlFor="p-unite">Unité de stock</label>
          <input id="p-unite" value={unite} onChange={(e) => setUnite(e.target.value)} list="unites" />
          <datalist id="unites">
            {UNITES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="p-famille">Famille</label>
          <select
            id="p-famille"
            value={famille}
            onChange={(e) => {
              setCategorieManuelle(true);
              setFamille(e.target.value as Famille | "");
              setSousCategorie("");
            }}
          >
            <option value="">À classer</option>
            {ORDRE_FAMILLES.map((f) => (
              <option key={f} value={f}>
                {FAMILLES[f].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="p-sous">Sous-catégorie</label>
          <input
            id="p-sous"
            value={sousCategorie}
            onChange={(e) => {
              setCategorieManuelle(true);
              setSousCategorie(e.target.value);
            }}
            list="sous-categories"
            disabled={!famille}
            placeholder={famille ? "Ex. : Fromages" : "Choisis d'abord la famille"}
          />
          <datalist id="sous-categories">
            {(famille ? FAMILLES[famille].sous : []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="p-fourn">Fournisseur</label>
          <input id="p-fourn" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} list="fournisseurs-liste" />
          <datalist id="fournisseurs-liste">
            {[...new Set(p.fournisseurs.map((f) => f.nom))].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="p-ref">Référence fournisseur</label>
          <input id="p-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="p-cond">Conditionnement</label>
          <input id="p-cond" value={conditionnement} onChange={(e) => setConditionnement(e.target.value)} placeholder="Ex. : carton 5 kg" />
        </div>
        <div className="field">
          <label htmlFor="p-prix">Prix HT par {unite || "unité"} (€)</label>
          <input id="p-prix" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} />
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="p-seuil">Seuil d&apos;alerte ({unite})</label>
          <input id="p-seuil" inputMode="decimal" value={seuil} onChange={(e) => setSeuil(e.target.value)} placeholder="Alerte en dessous" />
        </div>
        <div className="field">
          <label htmlFor="p-cible">Niveau cible ({unite})</label>
          <input id="p-cible" inputMode="decimal" value={cible} onChange={(e) => setCible(e.target.value)} placeholder="Après commande" />
        </div>
      </div>
      <div className="field">
        <label>Rangé dans</label>
        {p.zones.length ? (
          <div className="chips">
            {p.zones.map((z) => (
              <button
                key={z.id}
                className={`chip${zones.has(z.id) ? " on" : ""}`}
                onClick={() => {
                  const s = new Set(zones);
                  if (s.has(z.id)) s.delete(z.id);
                  else s.add(z.id);
                  setZones(s);
                }}
              >
                {z.titre}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">Crée d&apos;abord des zones de stockage (frigo, réserve…) depuis l&apos;onglet Inventaire.</p>
        )}
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
