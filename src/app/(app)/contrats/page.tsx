"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { nomComplet, useConnecte } from "@/lib/session";
import { chargerMembres, FONCTIONS } from "@/lib/personnel";
import type { Membre } from "@/lib/personnel";
import { iso } from "@/lib/planning";
import { alertes, DONNEES_VIDES, essaiPropose, genererContrat, MODELES, MOTIFS_CDD, salaireMensuel, STATUTS_FR } from "@/lib/contrats";
import type { Donnees, ModeleCle } from "@/lib/contrats";
import DocumentContrat from "@/components/contrats/DocumentContrat";
import SignaturePad from "@/components/contrats/SignaturePad";

type Contrat = {
  id: string;
  compte_id: string;
  modele: ModeleCle;
  donnees: Donnees;
  contenu: string | null;
  empreinte: string | null;
  statut: "brouillon" | "a_signer" | "signe" | "annule";
  signature_employeur: string | null;
  signe_employeur_at: string | null;
  signature_salarie: string | null;
  signe_salarie_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLONNES = "id, compte_id, modele, donnees, contenu, empreinte, statut, signature_employeur, signe_employeur_at, signature_salarie, signe_salarie_at, created_at, updated_at";
const STATUTS: Record<Contrat["statut"], { label: string; ton: string }> = {
  brouillon: { label: "Brouillon", ton: "t-lav" },
  a_signer: { label: "À signer", ton: "t-peach" },
  signe: { label: "Signé", ton: "t-mint" },
  annule: { label: "Annulé", ton: "t-red" },
};

type Etab = { nom: string; adresse: string | null; ville: string | null; siret: string | null };

export default function Contrats() {
  const { compte, etablissement } = useConnecte();
  const directeur = compte.role === "directeur";
  const sb = getSupabaseClient()!;
  const [contrats, setContrats] = useState<Contrat[] | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [taux, setTaux] = useState<Map<string, number>>(new Map());
  const [etab, setEtab] = useState<Etab | null>(null);
  const [vue, setVue] = useState<{ id: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    sb.from("contrats_travail")
      .select(COLONNES)
      .eq("etablissement_id", etablissement.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setContrats((data ?? []) as Contrat[]));
  }, [sb, etablissement.id, version]);

  useEffect(() => {
    chargerMembres(etablissement.id).then((m) => setMembres((m ?? []).filter((x) => x.statut !== "parti")));
    sb.from("etablissements")
      .select("nom, adresse, ville, siret")
      .eq("id", etablissement.id)
      .single()
      .then(({ data }) => setEtab(data as Etab));
    if (directeur)
      sb.from("comptes_remuneration")
        .select("compte_id, taux_brut")
        .eq("etablissement_id", etablissement.id)
        .then(({ data }) => setTaux(new Map((data ?? []).map((t) => [t.compte_id, Number(t.taux_brut)]))));
  }, [sb, etablissement.id, directeur]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const nomDe = (id: string) => {
    const m = membres.find((x) => x.id === id);
    return m ? nomComplet(m) : "—";
  };
  const fini = (m: string, garderOuvert?: string) => {
    setToast(m);
    setVue(garderOuvert ? { id: garderOuvert } : null);
    recharger();
  };

  if (vue && contrats) {
    const c = vue.id ? contrats.find((x) => x.id === vue.id) ?? null : null;
    if (c && c.statut !== "brouillon")
      return (
        <>
          <VueContrat c={c} directeur={directeur} moi={compte.id} employeur={etab?.nom ?? etablissement.nom} salarie={c.donnees.prenom ? `${c.donnees.prenom} ${c.donnees.nom}` : nomDe(c.compte_id)} onRetour={() => setVue(null)} onFini={fini} />
          {toast && <div className="toast" role="status">{toast}</div>}
        </>
      );
    if (directeur)
      return (
        <>
          <Editeur contrat={c} membres={membres} taux={taux} etab={etab} directeurNom={nomComplet(compte)} etablissementId={etablissement.id} auteurId={compte.id} onRetour={() => setVue(null)} onFini={fini} />
          {toast && <div className="toast" role="status">{toast}</div>}
        </>
      );
  }

  const visibles = (contrats ?? []).filter((c) => directeur || c.compte_id === compte.id);
  const aSigner = visibles.filter((c) => c.statut === "a_signer" && c.compte_id === compte.id && !c.signature_salarie);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Équipe</p>
          <h1>{directeur ? "Contrats de travail" : "Mes contrats"}</h1>
          <p>{directeur ? "Génère un contrat pré-rempli (France HCR ou Belgique Horeca), imprime-le ou fais-le signer dans Juliette." : "Les contrats que ton employeur t'a présentés. Lis-les, puis signe-les ici."}</p>
        </div>
        {directeur && (
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setVue({ id: null })}>
              + Nouveau contrat
            </button>
          </div>
        )}
      </div>

      {aSigner.length > 0 && (
        <div className="banner" style={{ background: "var(--peach)", borderColor: "#f3d3c1" }}>
          <span>
            <b>{aSigner.length} contrat(s) à signer.</b> Ouvre-le, lis-le entièrement, puis signe en bas de page.
          </span>
        </div>
      )}

      <section className="card" style={{ padding: "12px 6px 6px" }}>
        {!contrats ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        ) : !visibles.length ? (
          <div className="empty">{directeur ? "Aucun contrat pour l'instant. Crée le premier avec « Nouveau contrat »." : "Aucun contrat à afficher."}</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {directeur && <th>Salarié</th>}
                  <th>Contrat</th>
                  <th>Début</th>
                  <th>Statut</th>
                  <th>Signatures</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.id}>
                    {directeur && (
                      <td>
                        <b style={{ fontWeight: 600 }}>{nomDe(c.compte_id)}</b>
                      </td>
                    )}
                    <td>
                      {MODELES[c.modele]?.label ?? c.modele} <small className="hint">· {MODELES[c.modele]?.pays === "BE" ? "🇧🇪" : "🇫🇷"}</small>
                    </td>
                    <td>{c.donnees.date_debut ? new Date(c.donnees.date_debut + "T12:00").toLocaleDateString("fr-FR") : "—"}</td>
                    <td>
                      <span className={`pill ${STATUTS[c.statut].ton}`}>{STATUTS[c.statut].label}</span>
                    </td>
                    <td className="hint">
                      {c.statut === "brouillon" ? "—" : `Employeur ${c.signature_employeur ? "✓" : "…"} · Salarié ${c.signature_salarie ? "✓" : "…"}`}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn" style={{ height: 32 }} onClick={() => setVue({ id: c.id })}>
                        {c.statut === "brouillon" ? "Modifier" : c.statut === "a_signer" && !c.signature_salarie && c.compte_id === compte.id ? "Lire et signer" : "Ouvrir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {directeur && (
        <p className="hint" style={{ marginTop: 10 }}>
          ⚖ Les modèles sont des trames de départ, à faire relire par ton expert-comptable ou ton avocat avant signature. La signature dans Juliette est une signature électronique simple (tracé, horodatage, empreinte du texte).
        </p>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function Editeur({
  contrat,
  membres,
  taux,
  etab,
  directeurNom,
  etablissementId,
  auteurId,
  onRetour,
  onFini,
}: {
  contrat: Contrat | null;
  membres: Membre[];
  taux: Map<string, number>;
  etab: Etab | null;
  directeurNom: string;
  etablissementId: string;
  auteurId: string;
  onRetour: () => void;
  onFini: (m: string, garderOuvert?: string) => void;
}) {
  const sb = getSupabaseClient()!;
  const [compteId, setCompteId] = useState(contrat?.compte_id ?? "");
  const [modele, setModele] = useState<ModeleCle>(contrat?.modele ?? "fr_cdi");
  const [d, setD] = useState<Donnees>(() => ({ ...DONNEES_VIDES, ...(contrat?.donnees ?? {}) }));
  const [essaiManuel, setEssaiManuel] = useState(!!contrat?.donnees.essai);
  // Téléphone : formulaire et aperçu en alternance plutôt qu'empilés.
  const [vueMobile, setVueMobile] = useState<"remplir" | "apercu">("remplir");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const pays = MODELES[modele].pays;
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
      fonction: m.fonction ? FONCTIONS[m.fonction] ?? m.fonction : x.fonction,
      heures_hebdo: m.heures_contrat != null ? String(m.heures_contrat) : x.heures_hebdo,
      taux_horaire: taux.has(id) ? String(taux.get(id)) : x.taux_horaire,
      date_debut: m.date_embauche ?? x.date_debut,
      statut: m.fonction && ["directeur", "directeur_adjoint", "chef_cuisine"].includes(m.fonction) ? "cadre" : m.fonction && ["manager", "second"].includes(m.fonction) ? "maitrise" : x.statut,
      employeur: x.employeur || etab?.nom || "",
      employeur_adresse: x.employeur_adresse || etab?.adresse || "",
      employeur_numero: x.employeur_numero || etab?.siret || "",
      representant: x.representant || directeurNom,
      lieu_travail: x.lieu_travail || [etab?.nom, etab?.adresse].filter(Boolean).join(", "),
      fait_a: x.fait_a || etab?.ville || "",
      fait_le: x.fait_le || iso(new Date()),
    }));
  }

  function changerModele(m: ModeleCle) {
    setModele(m);
    const be = MODELES[m].pays === "BE";
    setD((x) => ({ ...x, statut: be ? (x.statut === "ouvrier" ? "ouvrier" : "employe") : x.statut === "ouvrier" ? "employe" : x.statut, heures_hebdo: x.heures_hebdo || (be ? "38" : "35"), nationalite: x.nationalite || (be ? "belge" : "française") }));
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

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">Contrats de travail</p>
          <h1>{contrat ? "Modifier le contrat" : "Nouveau contrat"}</h1>
          <p>Les informations connues sont pré-remplies. L&apos;aperçu se met à jour en direct.</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={onRetour}>
            ← Retour
          </button>
          <button className="btn" onClick={() => window.print()}>
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
          <section className="card">
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
                <label htmlFor="ct-modele">Modèle</label>
                <select id="ct-modele" value={modele} onChange={(e) => changerModele(e.target.value as ModeleCle)}>
                  <optgroup label="🇫🇷 France (HCR)">
                    {(Object.keys(MODELES) as ModeleCle[]).filter((k) => MODELES[k].pays === "FR").map((k) => (
                      <option key={k} value={k}>
                        {MODELES[k].label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🇧🇪 Belgique (CP 302)">
                    {(Object.keys(MODELES) as ModeleCle[]).filter((k) => MODELES[k].pays === "BE").map((k) => (
                      <option key={k} value={k}>
                        {MODELES[k].label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            <p className="hint" style={{ margin: 0 }}>{MODELES[modele].description}</p>
          </section>

          <section className="card contrat-section">
            <h3>Salarié</h3>
            <div className="form-2">
              <div className="field">
                <label htmlFor="ct-civ">Civilité</label>
                <select id="ct-civ" value={donnees.civilite} onChange={(e) => set("civilite", e.target.value as Donnees["civilite"])}>
                  <option>M.</option>
                  <option>Mme</option>
                </select>
              </div>
              {champ("nationalite", "Nationalité")}
            </div>
            <div className="form-2">
              {champ("prenom", "Prénom")}
              {champ("nom", "Nom")}
            </div>
            <div className="form-2">
              {champ("date_naissance", "Date de naissance", { type: "date" })}
              {champ("lieu_naissance", "Lieu de naissance")}
            </div>
            {champ("adresse", "Adresse")}
            {champ("numero_securite", pays === "FR" ? "N° de sécurité sociale" : "N° de registre national")}
          </section>

          <section className="card contrat-section">
            <h3>Emploi</h3>
            <div className="form-2">
              {champ("fonction", "Emploi occupé", { placeholder: "ex. Chef de partie" })}
              <div className="field">
                <label htmlFor="ct-statut">Statut</label>
                <select id="ct-statut" value={donnees.statut} onChange={(e) => set("statut", e.target.value)}>
                  {pays === "FR" ? (
                    Object.entries(STATUTS_FR).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="employe">Employé</option>
                      <option value="ouvrier">Ouvrier</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            {pays === "FR" && (
              <div className="form-2">
                {champ("niveau", "Niveau (grille HCR)", { placeholder: "I à V" })}
                {champ("echelon", "Échelon", { placeholder: "1 à 3" })}
              </div>
            )}
            {modele === "fr_cdd" && (
              <div className="form-2">
                <div className="field">
                  <label htmlFor="ct-motif">Motif du CDD</label>
                  <select id="ct-motif" value={donnees.motif} onChange={(e) => set("motif", e.target.value)}>
                    {Object.entries(MOTIFS_CDD).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {champ("motif_detail", donnees.motif === "remplacement" ? "Salarié remplacé (nom, qualification)" : "Précision (facultatif)")}
              </div>
            )}
            <div className="form-2">
              {champ("date_debut", modele.endsWith("extra") ? "Date de la mission" : "Date de début", { type: "date" })}
              {modele !== "fr_cdi" && modele !== "be_cdi" && champ("date_fin", modele.endsWith("extra") ? "Fin (si plusieurs jours)" : "Date de fin", { type: "date" })}
            </div>
            {modele === "fr_cdd" && donnees.motif === "remplacement" && !donnees.date_fin && champ("duree_minimale", "Durée minimale (sans date de fin)", { placeholder: "ex. 1 mois" })}
            {modele.endsWith("extra") && champ("horaires_mission", "Horaires de la mission", { placeholder: "ex. de 18h à 23h30" })}
            {champ("lieu_travail", "Lieu de travail")}
            {(modele === "fr_cdi" || modele === "fr_cdd") && (
              <div className="field">
                <label htmlFor="ct-essai">
                  Période d&apos;essai <span className="hint">· proposée : {essaiPropose(modele, d)}</span>
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
            )}
          </section>

          <section className="card contrat-section">
            <h3>Temps de travail et rémunération</h3>
            {!modele.endsWith("extra") && (
              <>
                {champ("heures_hebdo", "Heures par semaine", { inputMode: "decimal" })}
                {champ("repartition", "Répartition / horaires", { placeholder: "ex. du mardi au samedi, 10h-15h et 18h-23h" })}
              </>
            )}
            <div className="form-2">
              {champ("taux_horaire", "Taux horaire brut (€)", { inputMode: "decimal" })}
              <div className="field">
                <label>Salaire mensuel brut</label>
                <input value={mensuel && !modele.endsWith("extra") ? mensuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—"} disabled />
              </div>
            </div>
            {pays === "FR" && (
              <label className="coupure-toggle">
                <input type="checkbox" checked={donnees.avantage_nourriture} onChange={(e) => set("avantage_nourriture", e.target.checked)} />
                <span>
                  <b>Avantage en nature nourriture</b>
                  <small>Repas pris dans l&apos;établissement (convention HCR)</small>
                </span>
              </label>
            )}
            {champ("mutuelle", "Mutuelle / prévoyance (facultatif)", { placeholder: "ex. Alan, contrat n°…" })}
            <div className="field">
              <label htmlFor="ct-clauses">Clauses particulières (facultatif)</label>
              <textarea id="ct-clauses" rows={3} value={donnees.clauses} onChange={(e) => set("clauses", e.target.value)} placeholder="Tenue fournie, clause de mobilité…" />
            </div>
          </section>

          <section className="card contrat-section">
            <h3>Employeur et signature</h3>
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
          </section>

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
          <DocumentContrat texte={texte} employeur={donnees.employeur || "L'employeur"} salarie={`${donnees.prenom} ${donnees.nom}`.trim() || "Le salarié"} />
        </div>
      </div>
    </>
  );
}

function VueContrat({ c, directeur, moi, employeur, salarie, onRetour, onFini }: { c: Contrat; directeur: boolean; moi: string; employeur: string; salarie: string; onRetour: () => void; onFini: (m: string, garderOuvert?: string) => void }) {
  const sb = getSupabaseClient()!;
  const [signe, setSigne] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const peutSignerEmployeur = directeur && c.statut === "a_signer" && !c.signature_employeur;
  const peutSignerSalarie = c.compte_id === moi && c.statut === "a_signer" && !c.signature_salarie;

  async function signer(png: string) {
    setEnvoi(true);
    setErreur(null);
    const { error } = peutSignerSalarie ? await sb.rpc("signer_mon_contrat", { p_contrat: c.id, p_signature: png }) : await sb.from("contrats_travail").update({ signature_employeur: png, statut: "a_signer" }).eq("id", c.id);
    setEnvoi(false);
    if (error) return setErreur("Signature refusée. Recharge la page et réessaie.");
    setSigne(false);
    onFini("Signature enregistrée", c.id);
  }

  async function changer(statut: "brouillon" | "annule", message: string) {
    if (!confirm(statut === "brouillon" ? "Revenir en brouillon ? Les signatures déjà posées seront effacées." : "Annuler ce contrat signé ? Il restera consultable.")) return;
    const { error } = await sb.from("contrats_travail").update({ statut }).eq("id", c.id);
    if (error) return setErreur("Modification refusée.");
    onFini(message, statut === "brouillon" ? c.id : undefined);
  }

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">Contrat de travail</p>
          <h1>
            {MODELES[c.modele]?.label} · {salarie}
          </h1>
          <p>
            <span className={`pill ${STATUTS[c.statut].ton}`}>{STATUTS[c.statut].label}</span>
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={onRetour}>
            ← Retour
          </button>
          <button className="btn" onClick={() => window.print()}>
            ⎙ Imprimer / PDF
          </button>
          {directeur && c.statut === "a_signer" && (
            <button className="btn" onClick={() => changer("brouillon", "Contrat repassé en brouillon")}>
              Modifier (retour brouillon)
            </button>
          )}
          {directeur && c.statut === "signe" && (
            <button className="btn btn-danger-ghost" onClick={() => changer("annule", "Contrat annulé")}>
              Annuler le contrat
            </button>
          )}
        </div>
      </div>

      {(peutSignerEmployeur || peutSignerSalarie) && (
        <section className="card print-hide contrat-a-signer">
          {signe ? (
            <SignaturePad onValider={signer} onAnnuler={() => setSigne(false)} envoi={envoi} />
          ) : (
            <>
              <p style={{ margin: 0 }}>
                {peutSignerSalarie ? "Lis le contrat jusqu'au bout. En signant, tu déclares l'avoir lu et approuvé." : "Signe en tant qu'employeur. Le salarié pourra signer depuis son compte Juliette."}
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => setSigne(true)}>
                ✍ Signer le contrat
              </button>
            </>
          )}
          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
        </section>
      )}

      <DocumentContrat texte={c.contenu ?? ""} employeur={employeur} salarie={salarie} sig={c} />
    </>
  );
}
