"use client";

import { useMemo, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { nomComplet } from "@/lib/session";
import { FONCTIONS } from "@/lib/personnel";
import type { Membre } from "@/lib/personnel";
import { iso } from "@/lib/planning";
import { nouvelId } from "@/lib/haccp";
import { LIBELLES_CONVENTIONS, TITRES_RESTAURANT } from "@/lib/droitTravail";
import {
  alertes,
  CHAMPS_DEFAUTS,
  conventionDe,
  partEmployeurTitre,
  renouvellementEssai,
  DONNEES_VIDES,
  EMPLOIS,
  essaiPropose,
  genererContrat,
  MATERIELS,
  MODELES,
  MOTIFS_CDD,
  nomContrat,
  normaliser,
  PERIODICITES,
  PRIMES_TYPES,
  salaireMensuel,
  STATUTS_FR,
} from "@/lib/contrats";
import type { Defauts, Donnees, ModeleCle, Periodicite, PosteType, Reglages } from "@/lib/contrats";
import DocumentContrat, { imprimerContrat } from "@/components/contrats/DocumentContrat";

export type ContratBrouillon = { id: string; compte_id: string; modele: ModeleCle; donnees: Donnees };
type Etab = { nom: string; adresse: string | null; ville: string | null; siret: string | null };

/** Choix exclusif en boutons. */
function Choix<T extends string>({ valeur, options, onChange }: { valeur: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="ct-choix" role="radiogroup">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={valeur === v} className={valeur === v ? "on" : ""} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Etape({ n, titre, aide, children }: { n: number; titre: string; aide?: string; children: ReactNode }) {
  return (
    <section className="card ct-etape">
      <div className="ct-etape-tete">
        <span>{n}</span>
        <div>
          <h3>{titre}</h3>
          {aide && <small>{aide}</small>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Editeur({
  contrat,
  membres,
  taux,
  etab,
  reglages,
  directeurNom,
  etablissementId,
  auteurId,
  onRetour,
  onFini,
  onReglages,
}: {
  contrat: ContratBrouillon | null;
  membres: Membre[];
  taux: Map<string, number>;
  etab: Etab | null;
  reglages: Reglages;
  directeurNom: string;
  etablissementId: string;
  auteurId: string;
  onRetour: () => void;
  onFini: (m: string, garderOuvert?: string) => void;
  onReglages: (r: Reglages, message: string) => void;
}) {
  const sb = getSupabaseClient()!;
  const [compteId, setCompteId] = useState(contrat?.compte_id ?? "");
  const [modele, setModele] = useState<ModeleCle>(contrat?.modele ?? "fr_cdi");
  const [d, setD] = useState<Donnees>(() =>
    contrat
      ? normaliser(contrat.donnees)
      : normaliser({
          ...DONNEES_VIDES,
          ...reglages.defauts,
          employeur: etab?.nom ?? "",
          employeur_adresse: etab?.adresse ?? "",
          employeur_numero: etab?.siret ?? "",
          representant: reglages.defauts.representant || directeurNom,
          lieu_travail: reglages.defauts.lieu_travail || [etab?.nom, etab?.adresse].filter(Boolean).join(", "),
          fait_a: etab?.ville ?? "",
          fait_le: iso(new Date()),
        }),
  );
  const [essaiManuel, setEssaiManuel] = useState(!!contrat?.donnees.essai);
  const [vueMobile, setVueMobile] = useState<"remplir" | "apercu">("remplir");
  const [autreMateriel, setAutreMateriel] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const pays = MODELES[modele].pays;
  const extra = modele.endsWith("extra");
  const set = <K extends keyof Donnees>(k: K, v: Donnees[K]) => setD((x) => ({ ...x, [k]: v }));

  const donnees = useMemo(() => ({ ...d, essai: essaiManuel ? d.essai : essaiPropose(modele, d) }), [d, essaiManuel, modele]);
  const texte = useMemo(() => genererContrat(modele, donnees), [modele, donnees]);
  const avertissements = alertes(modele, donnees);
  const mensuel = salaireMensuel(donnees);

  function choisirSalarie(id: string) {
    setCompteId(id);
    const m = membres.find((x) => x.id === id);
    if (!m) return;
    setD((x) => ({
      ...x,
      prenom: m.prenom ?? "",
      nom: m.nom ?? "",
      date_naissance: m.date_naissance ?? x.date_naissance,
      fonction: x.fonction || (m.fonction ? FONCTIONS[m.fonction] ?? m.fonction : ""),
      heures_hebdo: m.heures_contrat != null ? String(m.heures_contrat) : x.heures_hebdo,
      taux_horaire: taux.has(id) ? String(taux.get(id)) : x.taux_horaire,
      date_debut: m.date_embauche ?? x.date_debut,
    }));
  }

  function appliquerPoste(p: PosteType) {
    setD((x) => ({ ...x, fonction: p.intitule, statut: p.statut, niveau: p.niveau, echelon: p.echelon, taux_horaire: p.taux_horaire || x.taux_horaire, heures_hebdo: p.heures_hebdo || x.heures_hebdo, repartition: p.repartition || x.repartition }));
    setEssaiManuel(false);
  }

  function changerModele(m: ModeleCle) {
    setModele(m);
    const be = MODELES[m].pays === "BE";
    setD((x) => ({ ...x, statut: be ? (x.statut === "ouvrier" ? "ouvrier" : "employe") : x.statut === "ouvrier" ? "employe" : x.statut, nationalite: x.nationalite || (be ? "belge" : "française") }));
  }

  async function enregistrerReglages(r: Reglages, message: string) {
    const { error } = await sb.from("contrats_reglages").upsert({ etablissement_id: etablissementId, data: r }, { onConflict: "etablissement_id" });
    if (error) return setErreur("Enregistrement des préréglages refusé : réservé au directeur.");
    onReglages(r, message);
  }

  function enregistrerPoste() {
    if (!d.fonction.trim()) return setErreur("Indique d'abord l'intitulé du poste.");
    const poste: PosteType = { id: nouvelId(), intitule: d.fonction.trim(), statut: d.statut, niveau: d.niveau, echelon: d.echelon, taux_horaire: d.taux_horaire, heures_hebdo: d.heures_hebdo, repartition: d.repartition };
    const postes = [...reglages.postes.filter((p) => p.intitule.toLowerCase() !== poste.intitule.toLowerCase()), poste];
    enregistrerReglages({ ...reglages, postes }, `Poste type « ${poste.intitule} » enregistré`);
  }

  function retirerPoste(id: string) {
    enregistrerReglages({ ...reglages, postes: reglages.postes.filter((p) => p.id !== id) }, "Poste type retiré");
  }

  function enregistrerDefauts() {
    const defauts = Object.fromEntries(CHAMPS_DEFAUTS.map((k) => [k, d[k]])) as Defauts;
    enregistrerReglages({ ...reglages, defauts }, "Choix enregistrés : chaque nouveau contrat démarrera avec");
  }

  async function sauver(presenter: boolean) {
    setErreur(null);
    if (!compteId) return setErreur("Choisis le salarié concerné.");
    setEnvoi(true);
    const ligne = { compte_id: compteId, modele, donnees, contenu: texte };
    let id = contrat?.id;
    if (id) {
      const { error } = await sb.from("contrats_travail").update(ligne).eq("id", id);
      if (error) {
        setEnvoi(false);
        return setErreur("Enregistrement refusé : réservé au directeur.");
      }
    } else {
      const { data, error } = await sb.from("contrats_travail").insert({ ...ligne, etablissement_id: etablissementId, created_by: auteurId }).select("id").single();
      if (error || !data) {
        setEnvoi(false);
        return setErreur("Enregistrement refusé : réservé au directeur.");
      }
      id = data.id;
    }
    if (presenter) {
      const { error } = await sb.from("contrats_travail").update({ statut: "a_signer", contenu: texte }).eq("id", id!);
      setEnvoi(false);
      if (error) return setErreur("Impossible de présenter le contrat.");
      return onFini("Contrat figé et présenté au salarié : il peut le signer depuis son compte", id);
    }
    setEnvoi(false);
    onFini("Brouillon enregistré");
  }

  async function supprimer() {
    if (!contrat || !confirm("Supprimer ce brouillon ?")) return;
    const { error } = await sb.from("contrats_travail").delete().eq("id", contrat.id);
    if (error) return setErreur("Suppression refusée.");
    onFini("Brouillon supprimé");
  }

  const champ = (k: keyof Donnees, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={`ct-${k}`}>{label}</label>
      <input id={`ct-${k}`} value={String(donnees[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </div>
  );
  const majPrime = (i: number, c: Partial<Donnees["primes"][number]>) => set("primes", d.primes.map((p, j) => (j === i ? { ...p, ...c } : p)));
  const basculerMateriel = (m: string) => set("materiel", d.materiel.includes(m) ? d.materiel.filter((x) => x !== m) : [...d.materiel, m]);
  const familles = [...new Set(EMPLOIS.map((e) => e.famille))];

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">Contrats de travail</p>
          <h1>{contrat ? "Modifier le contrat" : "Nouveau contrat"}</h1>
          <p>
            Coche tes choix : le contrat se rédige tout seul à côté. <span className="ct-nom">{nomContrat(modele, donnees)}</span>
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={onRetour}>
            ← Retour
          </button>
          <button className="btn" onClick={() => imprimerContrat(nomContrat(modele, donnees))}>
            ⎙ Imprimer / PDF
          </button>
        </div>
      </div>

      <div className="seg seg-inline contrat-bascule print-hide" role="tablist" aria-label="Affichage">
        <button role="tab" aria-selected={vueMobile === "remplir"} className={vueMobile === "remplir" ? "on" : ""} onClick={() => setVueMobile("remplir")}>
          ✎ Remplir
        </button>
        <button role="tab" aria-selected={vueMobile === "apercu"} className={vueMobile === "apercu" ? "on" : ""} onClick={() => setVueMobile("apercu")}>
          👁 Aperçu du contrat
        </button>
      </div>

      <div className={`contrat-editeur vue-${vueMobile}`}>
        <div className="contrat-form print-hide">
          <Etape n={1} titre="Contrat">
            <div className="form-2">
              <div className="field">
                <label htmlFor="ct-salarie">Salarié</label>
                <select id="ct-salarie" value={compteId} onChange={(e) => choisirSalarie(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {membres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {nomComplet(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ct-modele">Type de contrat</label>
                <select id="ct-modele" value={modele} onChange={(e) => changerModele(e.target.value as ModeleCle)}>
                  {(["FR", "BE"] as const).map((p) => (
                    <optgroup key={p} label={p === "FR" ? "🇫🇷 France (HCR)" : "🇧🇪 Belgique (CP 302)"}>
                      {(Object.keys(MODELES) as ModeleCle[])
                        .filter((k) => MODELES[k].pays === p)
                        .map((k) => (
                          <option key={k} value={k}>
                            {MODELES[k].label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <small className="hint">{MODELES[modele].description}</small>
            {pays === "FR" && (
              <>
                <div className="field">
                  <label htmlFor="ct-convention">Convention collective</label>
                  <select id="ct-convention" value={d.convention} onChange={(e) => set("convention", e.target.value)}>
                    {Object.entries(LIBELLES_CONVENTIONS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {d.convention === "autre" && (
                  <div className="form-2">
                    {champ("convention_libre", "Intitulé de la convention", { placeholder: "ex. Boulangerie-pâtisserie artisanale" })}
                    {champ("idcc_libre", "N° IDCC", { placeholder: "ex. 843" })}
                  </div>
                )}
                <small className="hint">
                  Elle fixe la période d&apos;essai, son renouvellement, les préavis et la valeur des repas. Tu la trouves sur un bulletin de paie.
                </small>
              </>
            )}
          </Etape>

          <Etape n={2} titre="Poste" aide="Choisis un poste type de ton établissement, ou un emploi de la liste.">
            {reglages.postes.length > 0 && (
              <div className="ct-postes">
                {reglages.postes.map((p) => (
                  <span key={p.id} className={`ct-poste${d.fonction === p.intitule ? " on" : ""}`}>
                    <button type="button" onClick={() => appliquerPoste(p)}>
                      <b>{p.intitule}</b>
                      <small>
                        {p.taux_horaire ? `${p.taux_horaire} €/h` : "salaire libre"} · {p.heures_hebdo || "?"} h
                      </small>
                    </button>
                    <button type="button" className="ct-poste-x" onClick={() => retirerPoste(p.id)} aria-label={`Retirer le poste type ${p.intitule}`}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="field">
              <label htmlFor="ct-emploi">Emploi</label>
              <select
                id="ct-emploi"
                value={EMPLOIS.some((e) => e.intitule === d.fonction) ? d.fonction : ""}
                onChange={(e) => {
                  const em = EMPLOIS.find((x) => x.intitule === e.target.value);
                  if (em) setD((x) => ({ ...x, fonction: em.intitule, statut: pays === "FR" ? em.statut : x.statut, niveau: em.niveau, echelon: em.echelon }));
                }}
              >
                <option value="">— Autre (saisir ci-dessous) —</option>
                {familles.map((f) => (
                  <optgroup key={f} label={f}>
                    {EMPLOIS.filter((e) => e.famille === f).map((e) => (
                      <option key={e.intitule}>{e.intitule}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {champ("fonction", "Intitulé figurant au contrat")}
            {pays === "FR" ? (
              <>
                <div className="field">
                  <label>Statut</label>
                  <Choix valeur={d.statut} options={Object.entries(STATUTS_FR).map(([k, v]) => [k, v.label])} onChange={(v) => set("statut", v)} />
                </div>
                <div className="form-2">
                  {champ("niveau", "Niveau (grille HCR)", { placeholder: "I à V" })}
                  {champ("echelon", "Échelon", { placeholder: "1 à 3" })}
                </div>
                <small className="hint">La classification proposée est indicative : vérifie-la avec la grille HCR.</small>
              </>
            ) : (
              <div className="field">
                <label>Catégorie</label>
                <Choix valeur={d.statut} options={[["employe", "Employé"], ["ouvrier", "Ouvrier"]]} onChange={(v) => set("statut", v)} />
              </div>
            )}
            <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={enregistrerPoste}>
              ⭐ Enregistrer comme poste type
            </button>
          </Etape>

          <Etape n={3} titre={extra ? "Mission" : "Dates et période d'essai"}>
            {modele === "fr_cdd" && (
              <>
                <div className="field">
                  <label>Motif du CDD</label>
                  <Choix valeur={d.motif} options={Object.entries(MOTIFS_CDD) as [string, string][]} onChange={(v) => set("motif", v)} />
                </div>
                {champ("motif_detail", d.motif === "remplacement" ? "Salarié remplacé (nom, qualification)" : "Précision (facultatif)")}
              </>
            )}
            <div className="form-2">
              {champ("date_debut", extra ? "Date de la mission" : "Date d'entrée", { type: "date" })}
              {!modele.endsWith("cdi") && champ("date_fin", extra ? "Fin (si plusieurs jours)" : "Date de fin", { type: "date" })}
            </div>
            {modele === "fr_cdd" && d.motif === "remplacement" && !d.date_fin && champ("duree_minimale", "Durée minimale (sans date de fin)", { placeholder: "ex. 1 mois" })}
            {extra && champ("horaires_mission", "Horaires de la mission", { placeholder: "ex. de 18 h à 23 h 30" })}
            {champ("lieu_travail", "Lieu de travail")}
            {(modele === "fr_cdi" || modele === "fr_cdd") && (
              <>
                <div className="field">
                  <label htmlFor="ct-essai">
                    Période d&apos;essai <span className="hint">· maximum légal : {essaiPropose(modele, d)}</span>
                  </label>
                  <input
                    id="ct-essai"
                    value={donnees.essai}
                    onChange={(e) => {
                      setEssaiManuel(true);
                      set("essai", e.target.value);
                    }}
                  />
                </div>
                {modele === "fr_cdi" && (
                  <div className="field">
                    <label>Renouvellement de l&apos;essai</label>
                    {renouvellementEssai(d).interdit ? (
                      <small className="hint">🚫 Non renouvelable : {renouvellementEssai(d).raison}.</small>
                    ) : (
                      <>
                        <Choix
                          valeur={d.essai_renouvelable ? "oui" : "non"}
                          options={[["oui", `Renouvelable une fois${renouvellementEssai(d).mois ? ` (+${renouvellementEssai(d).mois} mois max)` : ""}`], ["non", "Non renouvelable"]]}
                          onChange={(v) => set("essai_renouvelable", v === "oui")}
                        />
                        {renouvellementEssai(d).mois === null && <small className="hint">Vérifie que ta convention autorise le renouvellement.</small>}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </Etape>

          <Etape n={4} titre="Temps de travail et salaire">
            {!extra && (
              <>
                <div className="field">
                  <label>Heures par semaine</label>
                  <div className="ct-choix">
                    {(pays === "FR" ? ["35", "39", "30", "24", "20"] : ["38", "30", "24", "19"]).map((h) => (
                      <button key={h} type="button" className={d.heures_hebdo === h ? "on" : ""} onClick={() => set("heures_hebdo", h)}>
                        {h} h
                      </button>
                    ))}
                    <input className="ct-choix-input" inputMode="decimal" value={d.heures_hebdo} onChange={(e) => set("heures_hebdo", e.target.value)} aria-label="Autre nombre d'heures" />
                  </div>
                </div>
                {champ("repartition", "Répartition / horaires", { placeholder: "ex. du mardi au samedi, 10 h-15 h et 18 h-23 h" })}
              </>
            )}
            <div className="form-2">
              {champ("taux_horaire", "Taux horaire brut (€)", { inputMode: "decimal" })}
              <div className="field">
                <label>Salaire mensuel brut</label>
                <input value={mensuel && !extra ? mensuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—"} disabled />
              </div>
            </div>
            <div className="field">
              <label>Primes</label>
              <div className="ct-choix">
                {PRIMES_TYPES.filter((p) => !d.primes.some((x) => x.libelle === p.libelle)).map((p) => (
                  <button key={p.libelle} type="button" onClick={() => set("primes", [...d.primes, { ...p }])}>
                    + {p.libelle}
                  </button>
                ))}
                <button type="button" onClick={() => set("primes", [...d.primes, { libelle: "", montant: "", periodicite: "mois", condition: "" }])}>
                  + Autre prime
                </button>
              </div>
            </div>
            {d.primes.map((p, i) => (
              <div key={i} className="ct-prime">
                <input value={p.libelle} onChange={(e) => majPrime(i, { libelle: e.target.value })} placeholder="Nom de la prime" aria-label="Nom de la prime" />
                <input value={p.montant} onChange={(e) => majPrime(i, { montant: e.target.value })} placeholder="Montant €" inputMode="decimal" aria-label="Montant" disabled={p.periodicite === "variable"} />
                <select value={p.periodicite} onChange={(e) => majPrime(i, { periodicite: e.target.value as Periodicite })} aria-label="Périodicité">
                  {(Object.keys(PERIODICITES) as Periodicite[]).map((k) => (
                    <option key={k} value={k}>
                      {PERIODICITES[k]}
                    </option>
                  ))}
                </select>
                <input className="ct-prime-cond" value={p.condition} onChange={(e) => majPrime(i, { condition: e.target.value })} placeholder="Condition (facultatif)" aria-label="Condition" />
                <button type="button" className="icon-btn" onClick={() => set("primes", d.primes.filter((_, j) => j !== i))} aria-label="Retirer la prime">
                  ✕
                </button>
              </div>
            ))}
          </Etape>

          <Etape n={5} titre="Avantages et équipement">
            <div className="field">
              <label>Repas</label>
              <Choix valeur={d.repas} options={[["nature", "Avantage en nature (repas sur place)"], ["indemnite", "Indemnité compensatrice"], ["titres", "Titres-restaurant"], ["aucun", "Aucun"]]} onChange={(v) => set("repas", v)} />
            </div>
            {(d.repas === "nature" || d.repas === "indemnite") && (
              <div className="field">
                <label htmlFor="ct-repas_montant">
                  Valeur d&apos;un repas (€) <span className="hint">· référence : {conventionDe(d).repas.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € ({conventionDe(d).repasSource})</span>
                </label>
                <input id="ct-repas_montant" inputMode="decimal" value={d.repas_montant} onChange={(e) => set("repas_montant", e.target.value)} placeholder={conventionDe(d).repas.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} />
              </div>
            )}
            {d.repas === "titres" && (
              <div className="ct-titres">
                <div className="form-2">
                  {champ("tr_valeur", "Valeur d'un titre (€)", { inputMode: "decimal", placeholder: "ex. 10" })}
                  <div className="field">
                    <label>Part employeur</label>
                    <Choix valeur={d.tr_part} options={[["50", "50 %"], ["55", "55 %"], ["60", "60 %"]]} onChange={(v) => set("tr_part", v)} />
                  </div>
                </div>
                <small className="hint">
                  Part employeur : <b>{partEmployeurTitre(d)?.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) ?? "—"}</b> par titre · exonérée entre {TITRES_RESTAURANT.partMin} et {TITRES_RESTAURANT.partMax} %, dans la limite de {TITRES_RESTAURANT.plafondExonere.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} (2026).
                </small>
              </div>
            )}
            <div className="field">
              <label>Tenue de travail</label>
              <Choix valeur={d.tenue_fournie ? "oui" : "non"} options={[["oui", "Fournie par l'entreprise"], ["non", "Non fournie"]]} onChange={(v) => set("tenue_fournie", v === "oui")} />
            </div>
            {d.tenue_fournie && (
              <div className="field">
                <label>Lavage et entretien de la tenue</label>
                <Choix valeur={d.entretien} options={[["entreprise", "Assuré par l'entreprise"], ["prime", "Prime d'entretien"]]} onChange={(v) => set("entretien", v)} />
              </div>
            )}
            {d.tenue_fournie && d.entretien === "prime" && champ("prime_entretien", "Prime d'entretien (€ brut par mois)", { inputMode: "decimal" })}
            <div className="field">
              <label>Matériel fourni par l&apos;entreprise</label>
              <div className="ct-choix">
                {[...MATERIELS, ...d.materiel.filter((m) => !MATERIELS.includes(m))].map((m) => (
                  <button key={m} type="button" aria-pressed={d.materiel.includes(m)} className={d.materiel.includes(m) ? "on" : ""} onClick={() => basculerMateriel(m)}>
                    {d.materiel.includes(m) ? "✓ " : ""}
                    {m}
                  </button>
                ))}
                <input
                  className="ct-choix-input large"
                  value={autreMateriel}
                  onChange={(e) => setAutreMateriel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && autreMateriel.trim()) {
                      e.preventDefault();
                      set("materiel", [...d.materiel, autreMateriel.trim()]);
                      setAutreMateriel("");
                    }
                  }}
                  placeholder="Autre (Entrée)"
                  aria-label="Autre matériel"
                />
              </div>
            </div>
            <div className="field">
              <label>Frais de transport</label>
              <Choix valeur={d.transport ? "oui" : "non"} options={[["oui", pays === "FR" ? "Prise en charge 50 % de l'abonnement" : "Intervention selon la CCT"], ["non", "Non mentionné"]]} onChange={(v) => set("transport", v === "oui")} />
            </div>
          </Etape>

          <Etape n={6} titre="Protection sociale" aide={pays === "FR" ? "Nom et adresse des organismes : obligatoires en CDD, à communiquer au salarié dans tous les cas." : undefined}>
            {champ("caisse_retraite", "Caisse de retraite complémentaire (nom et adresse)", { placeholder: "ex. Malakoff Humanis, 21 rue Laffitte, 75009 Paris" })}
            {champ("organisme_prevoyance", "Organisme de prévoyance (nom et adresse)", { placeholder: "ex. Klesia Prévoyance, …" })}
            {champ("mutuelle", "Complémentaire santé", { placeholder: "ex. Alan, contrat n°…" })}
          </Etape>

          <Etape n={7} titre="Identité du salarié" aide="Ces informations restent visibles du seul directeur et du salarié.">
            <div className="field">
              <label>Civilité</label>
              <Choix valeur={d.civilite} options={[["M.", "Monsieur"], ["Mme", "Madame"]]} onChange={(v) => set("civilite", v)} />
            </div>
            <div className="form-2">
              {champ("prenom", "Prénom")}
              {champ("nom", "Nom")}
            </div>
            <div className="form-2">
              {champ("date_naissance", "Date de naissance", { type: "date" })}
              {champ("lieu_naissance", "Lieu de naissance")}
            </div>
            {champ("nationalite", "Nationalité")}
            {champ("adresse", "Adresse")}
            {champ("numero_securite", pays === "FR" ? "N° de sécurité sociale" : "N° de registre national")}
          </Etape>

          <Etape n={8} titre="Employeur et signature">
            {champ("employeur", "Raison sociale")}
            <div className="form-2">
              {champ("employeur_numero", pays === "FR" ? "SIRET" : "N° d'entreprise")}
              {champ("employeur_adresse", "Adresse du siège")}
            </div>
            <div className="form-2">
              {champ("representant", "Représenté par")}
              {champ("representant_qualite", "En qualité de")}
            </div>
            <div className="form-2">
              {champ("fait_a", "Fait à")}
              {champ("fait_le", "Le", { type: "date" })}
            </div>
            <div className="field">
              <label>Émargement</label>
              <Choix valeur={d.paraphe ? "oui" : "non"} options={[["oui", "Initiales en bas de chaque page"], ["non", "Signature finale uniquement"]]} onChange={(v) => set("paraphe", v === "oui")} />
            </div>
            <div className="field">
              <label htmlFor="ct-clauses">Clauses particulières (facultatif)</label>
              <textarea id="ct-clauses" rows={3} value={d.clauses} onChange={(e) => set("clauses", e.target.value)} placeholder="Clause de mobilité, formation prévue…" />
            </div>
          </Etape>

          {avertissements.length > 0 && (
            <div className="banner" style={{ background: "var(--yellow)", borderColor: "#eedda6", margin: 0 }}>
              <span>⚠ {avertissements.join(" ")}</span>
            </div>
          )}
          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
          <button type="button" className="btn ct-defauts" onClick={enregistrerDefauts} title="Repas, tenue, matériel, primes, transport, mutuelle, paraphes, représentant, lieu de travail">
            ⭐ Enregistrer ces choix par défaut pour mes prochains contrats
          </button>
          <div className="contrat-actions">
            {contrat && (
              <button className="btn btn-danger-ghost" onClick={supprimer} disabled={envoi}>
                Supprimer
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => sauver(false)} disabled={envoi}>
              Enregistrer le brouillon
            </button>
            <button className="btn btn-primary" onClick={() => sauver(true)} disabled={envoi || !compteId}>
              Figer et faire signer
            </button>
          </div>
        </div>

        <div className="contrat-apercu">
          <DocumentContrat texte={texte} employeur={donnees.employeur || "L'employeur"} salarie={`${donnees.prenom} ${donnees.nom}`.trim() || "Le salarié"} paraphe={donnees.paraphe} feminin={donnees.civilite === "Mme"} />
        </div>
      </div>
    </>
  );
}
