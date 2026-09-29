"use client";

import { useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { iso } from "@/lib/planning";
import { MODELES, normaliser, PRIMES_TYPES, STATUTS_FR } from "@/lib/contrats";
import type { Donnees, ModeleCle, Periodicite } from "@/lib/contrats";
import { alertesAvenant, AVENANT_VIDE, genererAvenant, MODIFS, nomAvenant, PERIODICITES } from "@/lib/avenants";
import type { Avenant, DonneesAvenant, TypeModif } from "@/lib/avenants";
import DocumentContrat, { imprimerContrat } from "@/components/contrats/DocumentContrat";

export type Parent = { id: string; compte_id: string; modele: ModeleCle; donnees: Donnees; created_at: string };
export type AvenantEnregistre = { id: string; numero: number; donnees: DonneesAvenant };

export default function EditeurAvenant({
  parent,
  avenant,
  numero,
  etablissementId,
  auteurId,
  onRetour,
  onFini,
}: {
  parent: Parent;
  avenant: AvenantEnregistre | null;
  numero: number;
  etablissementId: string;
  auteurId: string;
  onRetour: () => void;
  onFini: (m: string, garderOuvert?: string) => void;
}) {
  const sb = getSupabaseClient()!;
  const c = useMemo(() => normaliser(parent.donnees), [parent.donnees]);
  const num = avenant?.numero ?? numero;
  const dateContrat = c.fait_le || c.date_debut || parent.created_at.slice(0, 10);
  const [a, setA] = useState<Avenant>(() => avenant?.donnees.avenant ?? { ...AVENANT_VIDE, fait_a: c.fait_a, fait_le: iso(new Date()), nouveau_statut: c.statut, nouveau_poste: c.fonction, nouveau_niveau: c.niveau, nouvel_echelon: c.echelon });
  const [vueMobile, setVueMobile] = useState<"remplir" | "apercu">("remplir");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const set = <K extends keyof Avenant>(k: K, v: Avenant[K]) => setA((x) => ({ ...x, [k]: v }));
  const texte = useMemo(() => genererAvenant(parent.modele, c, a, num, dateContrat), [parent.modele, c, a, num, dateContrat]);
  const avert = alertesAvenant(parent.modele, c, a);
  const nom = nomAvenant(c, num, a.date_effet);
  const cdd = parent.modele.endsWith("cdd");
  const basculer = (m: TypeModif) => set("modifs", a.modifs.includes(m) ? a.modifs.filter((x) => x !== m) : [...a.modifs, m]);
  const champ = (k: keyof Avenant, label: string, type = "text", placeholder = "") => (
    <div className="field">
      <label htmlFor={`av-${k}`}>{label}</label>
      <input id={`av-${k}`} type={type} inputMode={type === "decimal" ? "decimal" : undefined} value={String(a[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} placeholder={placeholder} />
    </div>
  );

  async function sauver(presenter: boolean) {
    setErreur(null);
    if (!a.modifs.length) return setErreur("Choisis au moins un élément à modifier.");
    setEnvoi(true);
    const donnees: DonneesAvenant = { avenant: a, contrat: c, modele_parent: parent.modele, date_contrat: dateContrat };
    const ligne = { compte_id: parent.compte_id, modele: "avenant", donnees, contenu: texte };
    let id = avenant?.id;
    if (id) {
      const { error } = await sb.from("contrats_travail").update(ligne).eq("id", id);
      if (error) {
        setEnvoi(false);
        return setErreur("Enregistrement refusé : réservé au directeur.");
      }
    } else {
      const { data, error } = await sb.from("contrats_travail").insert({ ...ligne, etablissement_id: etablissementId, created_by: auteurId, type_document: "avenant", contrat_parent: parent.id, numero: num }).select("id").single();
      if (error || !data) {
        setEnvoi(false);
        return setErreur("Enregistrement refusé : réservé au directeur.");
      }
      id = data.id;
    }
    if (presenter) {
      const { error } = await sb.from("contrats_travail").update({ statut: "a_signer", contenu: texte }).eq("id", id!);
      setEnvoi(false);
      if (error) return setErreur("Impossible de présenter l'avenant.");
      return onFini("Avenant figé et présenté au salarié pour signature", id);
    }
    setEnvoi(false);
    onFini("Avenant enregistré en brouillon");
  }

  async function supprimer() {
    if (!avenant || !confirm("Supprimer ce brouillon d'avenant ?")) return;
    const { error } = await sb.from("contrats_travail").delete().eq("id", avenant.id);
    if (error) return setErreur("Suppression refusée.");
    onFini("Brouillon supprimé");
  }

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">Contrats de travail</p>
          <h1>Avenant n° {num}</h1>
          <p>
            Au contrat {MODELES[parent.modele].court} de {c.prenom} {c.nom} · <span className="ct-nom">{nom}</span>
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={onRetour}>
            ← Retour
          </button>
          <button className="btn" onClick={() => imprimerContrat(nom)}>
            ⎙ Imprimer / PDF
          </button>
        </div>
      </div>

      <div className="seg seg-inline contrat-bascule print-hide" role="tablist" aria-label="Affichage">
        <button role="tab" aria-selected={vueMobile === "remplir"} className={vueMobile === "remplir" ? "on" : ""} onClick={() => setVueMobile("remplir")}>
          ✎ Remplir
        </button>
        <button role="tab" aria-selected={vueMobile === "apercu"} className={vueMobile === "apercu" ? "on" : ""} onClick={() => setVueMobile("apercu")}>
          👁 Aperçu
        </button>
      </div>

      <div className={`contrat-editeur vue-${vueMobile}`}>
        <div className="contrat-form print-hide">
          <section className="card ct-etape">
            <div className="ct-etape-tete">
              <span>1</span>
              <div>
                <h3>Que modifie-t-on ?</h3>
                <small>Coche un ou plusieurs éléments.</small>
              </div>
            </div>
            <div className="ct-choix">
              {(Object.keys(MODIFS) as TypeModif[])
                .filter((m) => (!MODIFS[m].cdd || cdd) && (!MODIFS[m].cdi || parent.modele.endsWith("cdi")))
                .map((m) => (
                  <button key={m} type="button" aria-pressed={a.modifs.includes(m)} className={a.modifs.includes(m) ? "on" : ""} onClick={() => basculer(m)} title={MODIFS[m].aide}>
                    {a.modifs.includes(m) ? "✓ " : ""}
                    {MODIFS[m].label}
                  </button>
                ))}
            </div>
            <div className="form-2">
              {champ("date_effet", "Date d'effet", "date")}
              {champ("motif", "Préambule / raison (facultatif)", "text", "ex. Promotion suite à l'entretien annuel")}
            </div>
          </section>

          {a.modifs.length > 0 && (
            <section className="card ct-etape">
              <div className="ct-etape-tete">
                <span>2</span>
                <div>
                  <h3>Les nouvelles conditions</h3>
                  <small>Valeurs actuelles du contrat indiquées en gris.</small>
                </div>
              </div>
              {a.modifs.includes("remuneration") && champ("nouveau_taux", `Nouveau taux horaire brut (€) · actuel : ${c.taux_horaire || "—"} €`, "decimal")}
              {a.modifs.includes("duree") && (
                <div className="field">
                  <label>Nouvelles heures par semaine · actuel : {c.heures_hebdo || "—"} h</label>
                  <div className="ct-choix">
                    {["35", "39", "30", "24", "20"].map((h) => (
                      <button key={h} type="button" className={a.nouvelles_heures === h ? "on" : ""} onClick={() => set("nouvelles_heures", h)}>
                        {h} h
                      </button>
                    ))}
                    <input className="ct-choix-input" inputMode="decimal" value={a.nouvelles_heures} onChange={(e) => set("nouvelles_heures", e.target.value)} aria-label="Autre" />
                  </div>
                </div>
              )}
              {(a.modifs.includes("horaires") || (a.modifs.includes("duree") && Number(a.nouvelles_heures.replace(",", ".")) < 35)) && champ("nouvelle_repartition", `Répartition des heures · actuelle : ${c.repartition || "—"}`)}
              {a.modifs.includes("poste") && (
                <>
                  {champ("nouveau_poste", `Nouvel emploi · actuel : ${c.fonction || "—"}`)}
                  {MODELES[parent.modele].pays === "FR" && (
                    <div className="form-2">
                      <div className="field">
                        <label htmlFor="av-statut">Statut</label>
                        <select id="av-statut" value={a.nouveau_statut} onChange={(e) => set("nouveau_statut", e.target.value)}>
                          {Object.entries(STATUTS_FR).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-2">
                        {champ("nouveau_niveau", "Niveau")}
                        {champ("nouvel_echelon", "Échelon")}
                      </div>
                    </div>
                  )}
                </>
              )}
              {a.modifs.includes("lieu") && champ("nouveau_lieu", `Nouveau lieu · actuel : ${c.lieu_travail || "—"}`)}
              {a.modifs.includes("renouvellement_cdd") && champ("nouvelle_date_fin", `Nouvelle date de fin · terme actuel : ${c.date_fin || "—"}`, "date")}
              {a.modifs.includes("renouvellement_essai") && champ("duree_renouvellement_essai", `Durée du renouvellement · essai initial : ${c.essai || "—"}`, "text", "ex. 2 mois")}
              {a.modifs.includes("primes") && (
                <>
                  <div className="ct-choix">
                    {PRIMES_TYPES.filter((p) => !a.primes.some((x) => x.libelle === p.libelle)).map((p) => (
                      <button key={p.libelle} type="button" onClick={() => set("primes", [...a.primes, { ...p }])}>
                        + {p.libelle}
                      </button>
                    ))}
                  </div>
                  {a.primes.map((p, i) => (
                    <div key={i} className="ct-prime">
                      <input value={p.libelle} onChange={(e) => set("primes", a.primes.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)))} aria-label="Nom de la prime" />
                      <input value={p.montant} onChange={(e) => set("primes", a.primes.map((x, j) => (j === i ? { ...x, montant: e.target.value } : x)))} placeholder="Montant €" inputMode="decimal" aria-label="Montant" />
                      <select value={p.periodicite} onChange={(e) => set("primes", a.primes.map((x, j) => (j === i ? { ...x, periodicite: e.target.value as Periodicite } : x)))} aria-label="Périodicité">
                        {(Object.keys(PERIODICITES) as Periodicite[]).map((k) => (
                          <option key={k} value={k}>
                            {PERIODICITES[k]}
                          </option>
                        ))}
                      </select>
                      <input className="ct-prime-cond" value={p.condition} onChange={(e) => set("primes", a.primes.map((x, j) => (j === i ? { ...x, condition: e.target.value } : x)))} placeholder="Condition" aria-label="Condition" />
                      <button type="button" className="icon-btn" onClick={() => set("primes", a.primes.filter((_, j) => j !== i))} aria-label="Retirer">
                        ✕
                      </button>
                    </div>
                  ))}
                </>
              )}
              {a.modifs.includes("autre") && (
                <div className="field">
                  <label htmlFor="av-autre">Clause</label>
                  <textarea id="av-autre" rows={4} value={a.autre_texte} onChange={(e) => set("autre_texte", e.target.value)} />
                </div>
              )}
            </section>
          )}

          <section className="card ct-etape">
            <div className="ct-etape-tete">
              <span>3</span>
              <div>
                <h3>Signature</h3>
              </div>
            </div>
            <div className="form-2">
              {champ("fait_a", "Fait à")}
              {champ("fait_le", "Le", "date")}
            </div>
          </section>

          {avert.length > 0 && (
            <div className="banner" style={{ background: "var(--yellow)", borderColor: "#eedda6", margin: 0 }}>
              <span>⚠ {avert.join(" ")}</span>
            </div>
          )}
          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
          <div className="contrat-actions">
            {avenant && (
              <button className="btn btn-danger-ghost" onClick={supprimer} disabled={envoi}>
                Supprimer
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => sauver(false)} disabled={envoi}>
              Enregistrer le brouillon
            </button>
            <button className="btn btn-primary" onClick={() => sauver(true)} disabled={envoi}>
              Figer et faire signer
            </button>
          </div>
        </div>

        <div className="contrat-apercu">
          <DocumentContrat texte={texte} employeur={c.employeur || "L'employeur"} salarie={`${c.prenom} ${c.nom}`.trim()} paraphe={c.paraphe} feminin={c.civilite === "Mme"} />
        </div>
      </div>
    </>
  );
}
