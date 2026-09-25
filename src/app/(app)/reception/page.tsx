"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { nomComplet, useConnecte } from "@/lib/session";
import { useStock } from "@/lib/useStock";
import { ETATS_RECEPTION, formatQte } from "@/lib/stock";
import type { Commande, EtatReception, LigneReception, Reception } from "@/lib/stock";
import Modal from "@/components/Modal";

export default function Receptions() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const { d, recharger } = useStock(etablissement.id);
  const [commande, setCommande] = useState<Commande | null>(null);
  const [reclamation, setReclamation] = useState<Reception | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [maintenant] = useState(() => Date.now());

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const enAttente = useMemo(() => (d ? d.commandes.filter((c) => !d.receptions.some((r) => r.commande_id === c.id)) : []), [d]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Stock & achats</p>
          <h1>Réception</h1>
          <p>Contrôle chaque livraison : ce qui est reçu entre en stock, les anomalies partent en réclamation.</p>
        </div>
      </div>

      {!d ? (
        <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <section className="card">
            <div className="card-head">
              <h2>
                Livraisons attendues <span className="hint">· {enAttente.length}</span>
              </h2>
            </div>
            {!enAttente.length ? (
              <div className="empty">
                <b>Aucune livraison en attente</b>
                Les commandes marquées « envoyées » dans Commandes apparaissent ici.
              </div>
            ) : (
              <div className="rows">
                {enAttente.map((c) => {
                  const jours = Math.floor((maintenant - new Date(c.envoyee_at).getTime()) / 864e5);
                  return (
                    <div key={c.id} className="row">
                      <span className="chip-ic t-blue">⛟</span>
                      <span className="main-txt">
                        <b>{c.fournisseur_nom}</b>
                        <small>
                          Commandée le {new Date(c.envoyee_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {c.lignes?.length ?? 0} produit(s) · {(c.lignes ?? []).map((l) => l.nom).join(", ")}
                        </small>
                      </span>
                      {jours >= 3 && <span className="pill t-peach">il y a {jours} j</span>}
                      {gestion && (
                        <button className="btn btn-primary" onClick={() => setCommande(c)}>
                          Réceptionner
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card" style={{ padding: "16px 6px 6px" }}>
            <div className="card-head" style={{ padding: "0 12px" }}>
              <h2>Réceptions</h2>
            </div>
            {!d.receptions.length ? (
              <div className="empty">Aucune réception enregistrée.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Reçue le</th>
                      <th>Fournisseur</th>
                      <th>Contrôle</th>
                      <th>Par</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.receptions.map((r) => {
                      const anomalies = (r.lignes ?? []).filter((l) => l.etat !== "conforme");
                      return (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{new Date(r.received_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                          <td>
                            <b style={{ fontWeight: 600 }}>{r.fournisseur_nom}</b>
                            {r.temperature_camion != null && <small className="justif">Camion : {Number(r.temperature_camion).toLocaleString("fr-FR")} °C</small>}
                          </td>
                          <td>
                            {!anomalies.length ? (
                              <span className="pill t-mint">Conforme</span>
                            ) : (
                              <span style={{ display: "grid", gap: 3 }}>
                                {anomalies.map((l, i) => (
                                  <small key={i}>
                                    <span className={`pill ${ETATS_RECEPTION[l.etat]?.ton ?? "t-lav"}`}>{ETATS_RECEPTION[l.etat]?.label ?? l.etat}</span> {l.nom}
                                    {l.etat !== "manquant" && l.etat !== "refuse" ? ` : ${formatQte(l.quantiteRecue, l.unite)} / ${formatQte(l.quantiteCommandee, l.unite)}` : ""}
                                    {l.note ? ` · ${l.note}` : ""}
                                  </small>
                                ))}
                              </span>
                            )}
                          </td>
                          <td className="hint">{r.received_by}</td>
                          <td style={{ textAlign: "right" }}>
                            {anomalies.length > 0 &&
                              (r.signalement_envoye ? (
                                <span className="hint">réclamation envoyée</span>
                              ) : (
                                gestion && (
                                  <button className="btn" style={{ height: 32 }} onClick={() => setReclamation(r)}>
                                    Réclamer
                                  </button>
                                )
                              ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {commande && (
        <ModalReception
          c={commande}
          etablissementId={etablissement.id}
          compteId={compte.id}
          nom={nomComplet(compte)}
          onClose={() => setCommande(null)}
          onSaved={(m, r) => {
            setCommande(null);
            setToast(m);
            recharger();
            if (r) setReclamation(r);
          }}
        />
      )}
      {reclamation && (
        <ModalReclamation
          r={reclamation}
          etablissementNom={etablissement.nom}
          signataire={nomComplet(compte)}
          onClose={() => setReclamation(null)}
          onSaved={(m) => {
            setReclamation(null);
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

function ModalReception({ c, etablissementId, compteId, nom, onClose, onSaved }: { c: Commande; etablissementId: string; compteId: string; nom: string; onClose: () => void; onSaved: (m: string, r?: Reception) => void }) {
  const [lignes, setLignes] = useState<LigneReception[]>(() =>
    (c.lignes ?? []).map((l) => ({ produit_id: l.produit_id, nom: l.nom, unite: l.unite, quantiteCommandee: Number(l.quantite), quantiteRecue: Number(l.quantite), etat: "conforme" as EtatReception, temperatureProduit: null })),
  );
  const [camion, setCamion] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const maj = (i: number, champ: Partial<LigneReception>) =>
    setLignes((ls) =>
      ls.map((l, k) => {
        if (k !== i) return l;
        const n = { ...l, ...champ };
        // L'état suit la quantité saisie, sauf choix explicite d'abîmé ou refusé.
        if ("quantiteRecue" in champ && n.etat !== "abime" && n.etat !== "refuse") n.etat = n.quantiteRecue === 0 ? "manquant" : n.quantiteRecue !== n.quantiteCommandee ? "incomplet" : "conforme";
        if (champ.etat === "manquant" || champ.etat === "refuse") n.quantiteRecue = 0;
        return n;
      }),
    );

  async function valider() {
    setErreur(null);
    if (lignes.some((l) => !Number.isFinite(l.quantiteRecue) || l.quantiteRecue < 0)) return setErreur("Quantités reçues : des nombres positifs.");
    if (lignes.some((l) => l.etat !== "conforme" && l.etat !== "incomplet" && !l.note?.trim() && l.etat !== "manquant")) return setErreur("Décris le problème pour chaque produit abîmé ou refusé.");
    const t = camion.trim() === "" ? null : Number(camion.replace(",", "."));
    if (t !== null && !Number.isFinite(t)) return setErreur("Température du camion : un nombre.");
    setEnvoi(true);
    const { data, error } = await getSupabaseClient()!
      .from("receptions")
      .insert({ etablissement_id: etablissementId, commande_id: c.id, fournisseur_nom: c.fournisseur_nom, fournisseur_email: c.fournisseur_email, received_by: nom, temperature_camion: t, lignes, created_by: compteId })
      .select("id, commande_id, fournisseur_nom, fournisseur_email, received_at, received_by, temperature_camion, lignes, signalement_envoye")
      .single();
    setEnvoi(false);
    if (error || !data) return setErreur("Enregistrement refusé : réservé aux responsables.");
    const anomalies = lignes.filter((l) => l.etat !== "conforme").length;
    onSaved(anomalies ? `Réception enregistrée avec ${anomalies} anomalie(s)` : "Réception conforme enregistrée : le stock est à jour", anomalies ? (data as Reception) : undefined);
  }

  const anomalies = lignes.filter((l) => l.etat !== "conforme").length;
  return (
    <Modal
      titre={`Réception ${c.fournisseur_nom}`}
      sousTitre={`Commande du ${new Date(c.envoyee_at).toLocaleDateString("fr-FR")}`}
      onClose={onClose}
      pied={
        <>
          <span className="hint" style={{ marginRight: "auto" }}>
            {anomalies ? `${anomalies} anomalie(s)` : "Tout est conforme"}
          </span>
          <button className="btn" onClick={onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={valider} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Valider la réception"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="r-camion">Température du camion (facultatif)</label>
        <span className="temp-input" style={{ maxWidth: 160 }}>
          <input id="r-camion" inputMode="decimal" value={camion} onChange={(e) => setCamion(e.target.value)} placeholder="3" />
          <span>°C</span>
        </span>
      </div>
      <div className="recep-list">
        {lignes.map((l, i) => (
          <div key={i} className={`recep-row${l.etat !== "conforme" ? " ko" : ""}`}>
            <div className="recep-top">
              <b>{l.nom}</b>
              <small className="hint">commandé : {formatQte(l.quantiteCommandee, l.unite)}</small>
            </div>
            <div className="recep-controls">
              <span className="temp-input" style={{ width: 140 }}>
                <input inputMode="decimal" value={String(l.quantiteRecue).replace(".", ",")} onChange={(e) => maj(i, { quantiteRecue: Number(e.target.value.replace(",", ".")) })} aria-label={`Reçu ${l.nom}`} />
                <span>{l.unite}</span>
              </span>
              <select className="select-sm" value={l.etat} onChange={(e) => maj(i, { etat: e.target.value as EtatReception })} aria-label="État">
                {Object.entries(ETATS_RECEPTION).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <span className="temp-input" style={{ width: 110 }}>
                <input inputMode="decimal" value={l.temperatureProduit ?? ""} onChange={(e) => maj(i, { temperatureProduit: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })} placeholder="T°" aria-label="Température produit" />
                <span>°C</span>
              </span>
            </div>
            {l.etat !== "conforme" && <input className="temp-action-input" value={l.note ?? ""} onChange={(e) => maj(i, { note: e.target.value })} placeholder="Ce qui ne va pas (ex. : 2 cartons écrasés)" />}
          </div>
        ))}
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}

function ModalReclamation({ r, etablissementNom, signataire, onClose, onSaved }: { r: Reception; etablissementNom: string; signataire: string; onClose: () => void; onSaved: (m: string) => void }) {
  const [envoi, setEnvoi] = useState(false);
  const anomalies = (r.lignes ?? []).filter((l) => l.etat !== "conforme");
  const texte = [
    "Bonjour,",
    "",
    `Lors de la livraison du ${new Date(r.received_at).toLocaleDateString("fr-FR")} à ${etablissementNom}, nous avons constaté les anomalies suivantes :`,
    "",
    ...anomalies.map(
      (l) =>
        `- ${l.nom} : ${ETATS_RECEPTION[l.etat]?.label.toLowerCase() ?? l.etat}${l.etat === "incomplet" ? ` (reçu ${formatQte(l.quantiteRecue, l.unite)} sur ${formatQte(l.quantiteCommandee, l.unite)})` : ""}${l.note ? `, ${l.note}` : ""}`,
    ),
    "",
    "Merci de nous faire parvenir un avoir ou de compléter la livraison.",
    "",
    "Cordialement,",
    signataire,
    etablissementNom,
  ].join("\n");
  const mailto = `mailto:${encodeURIComponent(r.fournisseur_email ?? "")}?subject=${encodeURIComponent(`Réclamation livraison du ${new Date(r.received_at).toLocaleDateString("fr-FR")} – ${etablissementNom}`)}&body=${encodeURIComponent(texte)}`;

  async function marquer() {
    setEnvoi(true);
    const { error } = await getSupabaseClient()!.from("receptions").update({ signalement_envoye: true }).eq("id", r.id);
    setEnvoi(false);
    onSaved(error ? "Modification refusée" : "Réclamation marquée comme envoyée");
  }

  return (
    <Modal
      titre={`Réclamation ${r.fournisseur_nom}`}
      sousTitre={`${anomalies.length} anomalie(s)`}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={() => navigator.clipboard.writeText(texte)} style={{ marginRight: "auto" }}>
            Copier le texte
          </button>
          <button className="btn btn-primary" onClick={marquer} disabled={envoi}>
            Marquer comme envoyée
          </button>
        </>
      }
    >
      <pre className="invite-msg" style={{ maxHeight: 280, overflowY: "auto" }}>
        {texte}
      </pre>
      {r.fournisseur_email ? (
        <a className="btn" href={mailto}>
          ✉ Ouvrir dans ma messagerie ({r.fournisseur_email})
        </a>
      ) : (
        <p className="hint">Pas d&apos;e-mail pour ce fournisseur : copie le texte et envoie-le par le moyen habituel.</p>
      )}
    </Modal>
  );
}
