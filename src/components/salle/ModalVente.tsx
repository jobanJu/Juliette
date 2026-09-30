"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { COLONNES_BON, etapeVente, euros, ingredientsPortion, PLATEFORMES, totalBon } from "@/lib/salle";
import type { ArticleCarte, Bon, LigneBon } from "@/lib/salle";
import type { Fiche } from "@/lib/fiches";
import type { Produit } from "@/lib/stock";
import CartePicker, { ajouterLigne } from "@/components/salle/CartePicker";
import Icone from "@/components/Icone";

type Props = {
  etablissementId: string;
  compteId: string;
  compteNom: string;
  type: "emporter" | "livraison";
  bon?: Bon;
  carte: ArticleCarte[];
  fiches: Fiche[];
  produits: Map<string, Produit>;
  onClose: () => void;
  onChange: (message?: string) => void;
};

export default function ModalVente(p: Props) {
  const sb = getSupabaseClient()!;
  const b = p.bon;
  const nouvelle = !b || b.statut === "en_cours";
  const livraison = p.type === "livraison";

  const [client, setClient] = useState(b?.client_nom ?? "");
  const [telephone, setTelephone] = useState(b?.client_telephone ?? "");
  const [adresse, setAdresse] = useState(b?.adresse ?? "");
  const [heure, setHeure] = useState(b?.heure_souhaitee?.slice(0, 5) ?? "");
  const [plateforme, setPlateforme] = useState(b?.plateforme ?? "Direct");
  const [lignes, setLignes] = useState<LigneBon[]>(b?.lignes ?? []);
  const [note, setNote] = useState(b?.note ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [annuler, setAnnuler] = useState(false);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [p]);

  const changer = (i: number, d: number) => setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, quantite: l.quantite + d } : l)).filter((l) => l.quantite > 0));
  const maj = () => ({ updated_at: new Date().toISOString() });

  async function envoyer() {
    setErreur(null);
    if (!client.trim()) return setErreur("Nom du client ?");
    if (livraison && !adresse.trim()) return setErreur("Adresse de livraison ?");
    if (!lignes.length) return setErreur("Ajoute au moins un article.");
    setEnvoi(true);
    const contenu = {
      type_commande: p.type,
      client_nom: client.trim(),
      client_telephone: telephone.trim() || null,
      adresse: livraison ? adresse.trim() : null,
      heure_souhaitee: heure || null,
      plateforme: livraison ? plateforme : null,
      couverts: 1,
      table_id: null,
      table_nom: livraison ? "Livraison" : "À emporter",
      note: note.trim() || null,
      lignes: lignes.map((l) => {
        const a = p.carte.find((x) => x.id === l.produitId);
        const ingredients = a ? ingredientsPortion(a, p.fiches, p.produits) : [];
        return ingredients.length ? { ...l, ingredients } : l;
      }),
      ...maj(),
    };
    let id = b?.id;
    if (id) {
      const { error } = await sb.from("commandes_salle").update(contenu).eq("id", id);
      if (error) return fin("Enregistrement refusé.");
    } else {
      const { data, error } = await sb
        .from("commandes_salle")
        .insert({ ...contenu, etablissement_id: p.etablissementId, statut: "en_cours", cree_par: p.compteId, cree_par_nom: p.compteNom })
        .select(COLONNES_BON)
        .single();
      if (error || !data) return fin("Enregistrement refusé.");
      id = data.id;
    }
    const { error } = await sb.from("commandes_salle").update({ statut: "envoyee", ...maj() }).eq("id", id);
    if (error) return fin("Envoi refusé.");
    setEnvoi(false);
    p.onChange(`${livraison ? "Livraison" : "Commande à emporter"} de ${client.trim()} envoyée en cuisine`);
  }

  function fin(m: string) {
    setEnvoi(false);
    setErreur(m);
  }

  async function etape(champs: Record<string, unknown>, message: string) {
    setEnvoi(true);
    const { error } = await sb.from("commandes_salle").update({ ...champs, ...maj() }).eq("id", b!.id);
    setEnvoi(false);
    if (error) return setErreur("Modification refusée.");
    p.onChange(message);
  }

  const total = totalBon({ lignes });
  const suivi = b ? etapeVente(b) : null;

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className={`modal ${nouvelle ? "pos" : ""}`} role="dialog" aria-modal="true" aria-label={livraison ? "Livraison" : "À emporter"}>
        <div className="modal-head">
          <div>
            <h2>
              <Icone nom={livraison ? "livraison" : "emporter"} /> {livraison ? "Livraison" : "À emporter"}
              {b?.client_nom ? ` · ${b.client_nom}` : ""}
            </h2>
            <p>{b ? `Commande de ${new Date(b.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · prise par ${b.cree_par_nom}` : "Nouvelle commande"}</p>
          </div>
          <button className="icon-btn" onClick={p.onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {nouvelle ? (
          <div className="pos-body">
            <CartePicker carte={p.carte} onAjouter={(a) => setLignes((ls) => ajouterLigne(ls, a))} />
            <section className="pos-ticket">
              <div className="ticket-bon">
                <div className="form-2">
                  <input className="ticket-note" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nom du client *" aria-label="Nom du client" />
                  <input className="ticket-note" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" aria-label="Téléphone" />
                </div>
                {livraison && <input className="ticket-note" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse de livraison *" aria-label="Adresse" />}
                <div className="form-2">
                  <label className="hint" style={{ display: "grid", gap: 3 }}>
                    {livraison ? "Livrer vers" : "Retrait à"}
                    <input className="ticket-note" style={{ marginTop: 0 }} type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
                  </label>
                  {livraison && (
                    <label className="hint" style={{ display: "grid", gap: 3 }}>
                      Plateforme
                      <select className="ticket-note" style={{ marginTop: 0 }} value={plateforme} onChange={(e) => setPlateforme(e.target.value)}>
                        {PLATEFORMES.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
              <div className="ticket-bon ticket-draft">
                {!lignes.length ? (
                  <p className="hint" style={{ margin: "6px 0" }}>Touche un article de la carte pour l&apos;ajouter.</p>
                ) : (
                  lignes.map((l, i) => (
                    <div key={i} className="ticket-line">
                      <span className="qty-ctrl">
                        <button onClick={() => changer(i, -1)} aria-label="Retirer un">
                          −
                        </button>
                        <b>{l.quantite}</b>
                        <button onClick={() => changer(i, 1)} aria-label="Ajouter un">
                          +
                        </button>
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>{l.nom}</span>
                      <span>{euros(l.quantite * l.prixCentimes)}</span>
                    </div>
                  ))
                )}
                <input className="ticket-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (allergies, digicode, sans couverts…)" maxLength={200} />
              </div>
              {erreur && (
                <div className="error" role="alert">
                  {erreur}
                </div>
              )}
              <div className="ticket-total">
                <span>Total</span>
                <b>{euros(total)}</b>
              </div>
              <div className="ticket-actions">
                <button className="btn btn-primary" onClick={envoyer} disabled={envoi || !lignes.length} style={{ height: 46 }}>
                  {envoi ? "…" : "Envoyer en cuisine"}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="modal-body">
            <div className="suivi">
              {(livraison ? ["cuisine", "prete", "route", "terminee"] : ["cuisine", "prete", "terminee"]).map((c) => {
                const ordre = ["cuisine", "prete", "route", "terminee"];
                const fait = ordre.indexOf(suivi!.cle) >= ordre.indexOf(c);
                const libelle = { cuisine: "En cuisine", prete: "Prête", route: "En livraison", terminee: livraison ? "Livrée" : "Retirée" }[c];
                return (
                  <span key={c} className={`suivi-etape${fait ? " fait" : ""}${suivi!.cle === c ? " actuelle" : ""}`}>
                    {libelle}
                  </span>
                );
              })}
            </div>
            <div className="rows">
              {b!.client_telephone && (
                <div className="row">
                  <span className="main-txt">
                    <small>Téléphone</small>
                    <b>{b!.client_telephone}</b>
                  </span>
                </div>
              )}
              {b!.adresse && (
                <div className="row">
                  <span className="main-txt">
                    <small>Adresse</small>
                    <b style={{ whiteSpace: "normal" }}>{b!.adresse}</b>
                  </span>
                </div>
              )}
              <div className="row">
                <span className="main-txt">
                  <small>{livraison ? "Livrer vers" : "Retrait à"}</small>
                  <b>{b!.heure_souhaitee?.slice(0, 5) ?? "dès que possible"}</b>
                </span>
                {b!.plateforme && <span className="pill t-lav">{b!.plateforme}</span>}
              </div>
            </div>
            <div className="ticket-bon">
              {b!.lignes.map((l, k) => (
                <div key={k} className="ticket-line">
                  <span>
                    {l.quantite} × {l.nom}
                  </span>
                  <span>{euros(l.quantite * l.prixCentimes)}</span>
                </div>
              ))}
              {b!.note && <small className="hint">« {b!.note} »</small>}
              <div className="ticket-total">
                <span>Total</span>
                <b>{euros(totalBon(b!))}</b>
              </div>
            </div>
            {erreur && (
              <div className="error" role="alert">
                {erreur}
              </div>
            )}
            <div className="ticket-actions">
              {suivi!.cle === "cuisine" && (
                <button className="btn btn-primary" style={{ height: 46 }} onClick={() => etape({ servi_at: new Date().toISOString() }, "Commande prête")} disabled={envoi}>
                  ✓ Prête
                </button>
              )}
              {suivi!.cle === "prete" && livraison && (
                <button className="btn btn-primary" style={{ height: 46 }} onClick={() => etape({ en_livraison_at: new Date().toISOString() }, `${b!.client_nom} : partie en livraison`)} disabled={envoi}>
                  <Icone nom="livraison" /> Partie en livraison
                </button>
              )}
              {(suivi!.cle === "route" || (suivi!.cle === "prete" && !livraison)) && (
                <button className="btn btn-primary" style={{ height: 46 }} onClick={() => etape({ statut: "terminee" }, livraison ? "Livraison terminée" : "Commande retirée")} disabled={envoi}>
                  {livraison ? "✓ Livrée et encaissée" : "✓ Retirée et encaissée"}
                </button>
              )}
              {suivi!.cle !== "terminee" &&
                (!annuler ? (
                  <button className="btn btn-danger-ghost" onClick={() => setAnnuler(true)}>
                    Annuler la commande
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={() => etape({ statut: "annulee" }, "Commande annulée : le stock est recrédité")} disabled={envoi}>
                    Confirmer l&apos;annulation
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
