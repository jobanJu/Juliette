"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { nomComplet, useConnecte } from "@/lib/session";
import { chargerMembres, FONCTIONS } from "@/lib/personnel";
import type { Membre } from "@/lib/personnel";
import { alertesDoc, GROUPES_DOCS, MATERIELS, MODELES_DOCS, ORDRE_DOCS } from "@/lib/documentsRh";
import type { Champ, Contexte, Donnees, LigneMateriel, TypeDoc } from "@/lib/documentsRh";
import DocumentContrat, { imprimerContrat } from "@/components/contrats/DocumentContrat";
import SignaturePad from "@/components/contrats/SignaturePad";
import Icone from "@/components/Icone";

type Doc = {
  id: string;
  compte_id: string | null;
  type: TypeDoc;
  titre: string;
  donnees: Donnees & { _civilite?: string };
  contenu: string | null;
  empreinte: string | null;
  statut: "brouillon" | "a_signer" | "signe" | "publie" | "annule";
  signature_employeur: string | null;
  signe_employeur_at: string | null;
  signature_salarie: string | null;
  signe_salarie_at: string | null;
  created_at: string;
};
type Etab = { nom: string; adresse: string | null; ville: string | null; siret: string | null };

const COLONNES = "id, compte_id, type, titre, donnees, contenu, empreinte, statut, signature_employeur, signe_employeur_at, signature_salarie, signe_salarie_at, created_at";
const STATUTS: Record<Doc["statut"], { label: string; ton: string }> = {
  brouillon: { label: "Brouillon", ton: "t-lav" },
  a_signer: { label: "À signer", ton: "t-peach" },
  signe: { label: "Signé", ton: "t-mint" },
  publie: { label: "Publié", ton: "t-blue" },
  annule: { label: "Annulé", ton: "t-red" },
};

const propre = (x: string) => x.trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "-");
/** Nom du fichier : NOM_Prénom_TYPE_DATE (ou TYPE_Établissement_DATE pour un document collectif). */
function nomFichier(type: TypeDoc, qui: { prenom: string; nom: string } | null, date: string, etab: string) {
  const t = MODELES_DOCS[type].label.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (qui ? [propre(qui.nom).toUpperCase(), propre(qui.prenom), t, date] : [t, propre(etab), date]).filter(Boolean).join("_");
}

export default function DocumentsRh() {
  const { compte, etablissement } = useConnecte();
  const directeur = compte.role === "directeur";
  const sb = getSupabaseClient()!;
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [etab, setEtab] = useState<Etab | null>(null);
  const [vue, setVue] = useState<{ id: string | null; type?: TypeDoc } | null>(null);
  const [choix, setChoix] = useState(false);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    sb.from("documents_rh")
      .select(COLONNES)
      .eq("etablissement_id", etablissement.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocs((data ?? []) as Doc[]));
  }, [sb, etablissement.id, version]);

  useEffect(() => {
    chargerMembres(etablissement.id).then((m) => setMembres(m ?? []));
    sb.from("etablissements")
      .select("nom, adresse, ville, siret")
      .eq("id", etablissement.id)
      .single()
      .then(({ data }) => setEtab(data as Etab));
  }, [sb, etablissement.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const fini = (m: string, garder?: string) => {
    setToast(m);
    setVue(garder ? { id: garder } : null);
    recharger();
  };
  const nomDe = (id: string | null) => {
    const m = membres.find((x) => x.id === id);
    return m ? nomComplet(m) : id ? "—" : "Tout l'établissement";
  };
  const directeurNom = nomComplet(membres.find((m) => m.role === "directeur") ?? compte);

  if (vue && docs && etab) {
    const d = vue.id ? docs.find((x) => x.id === vue.id) ?? null : null;
    // Document tout juste enregistré : on attend le rechargement de la liste.
    if (vue.id && !d) return <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />;
    if (d && d.statut !== "brouillon")
      return (
        <>
          <VueDoc d={d} directeur={directeur} moi={compte.id} membres={membres} etab={etab} directeurNom={directeurNom} onRetour={() => setVue(null)} onFini={fini} />
          {toast && <div className="toast" role="status">{toast}</div>}
        </>
      );
    if (directeur)
      return (
        <>
          <EditeurDoc key={d?.id ?? vue.type} doc={d} type={d?.type ?? vue.type!} membres={membres} etab={etab} directeurNom={directeurNom} etablissementId={etablissement.id} auteurId={compte.id} onRetour={() => setVue(null)} onFini={fini} />
          {toast && <div className="toast" role="status">{toast}</div>}
        </>
      );
  }

  const visibles = (docs ?? []).filter((x) => directeur || x.compte_id === compte.id || x.compte_id === null);
  const aSigner = visibles.filter((x) => x.statut === "a_signer" && x.compte_id === compte.id && !x.signature_salarie && MODELES_DOCS[x.type].signatureSalarie);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Ressources humaines</p>
          <h1>Documents RH</h1>
          <p>{directeur ? "Fiches de poste, remises de matériel, règlement intérieur, courriers : rédigés en quelques clics, imprimés ou signés dans Juliette." : "Les documents qui te concernent, et le règlement intérieur."}</p>
        </div>
        {directeur && (
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setChoix(true)}>
              + Nouveau document
            </button>
          </div>
        )}
      </div>

      {choix && (
        <section className="card doc-choix">
          <div className="card-head">
            <h2>Quel document ?</h2>
            <button className="icon-btn" onClick={() => setChoix(false)} aria-label="Fermer">
              ✕
            </button>
          </div>
          {GROUPES_DOCS.map((g) => (
            <div key={g} className="doc-groupe">
              <h3 className="doc-groupe-titre">{g}</h3>
              <div className="doc-grille">
                {ORDRE_DOCS.filter((t) => MODELES_DOCS[t].groupe === g).map((t) => (
                  <button
                    key={t}
                    className="doc-carte"
                    onClick={() => {
                      setChoix(false);
                      setVue({ id: null, type: t });
                    }}
                  >
                    <span aria-hidden><Icone nom={MODELES_DOCS[t].icone} taille={24} /></span>
                    <b>{MODELES_DOCS[t].label}</b>
                    <small>{MODELES_DOCS[t].description}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {aSigner.length > 0 && (
        <div className="banner" style={{ background: "var(--peach)", borderColor: "#f3d3c1" }}>
          <span>
            <b>{aSigner.length} document(s) à signer.</b> Ouvre-le, lis-le, puis signe en bas de page.
          </span>
        </div>
      )}

      <section className="card" style={{ padding: "12px 6px 6px" }}>
        {!docs ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        ) : !visibles.length ? (
          <div className="empty">{directeur ? "Aucun document. Crée le premier avec « Nouveau document »." : "Aucun document à afficher."}</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Concerne</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <b className="ct-nom">{x.titre}</b>
                      <small className="justif">
                        <Icone nom={MODELES_DOCS[x.type].icone} /> {MODELES_DOCS[x.type].label}
                      </small>
                    </td>
                    <td>{x.type === "promesse" ? String(x.donnees.candidat_nom ?? "Candidat") : nomDe(x.compte_id)}</td>
                    <td>{new Date(x.created_at).toLocaleDateString("fr-FR")}</td>
                    <td>
                      <span className={`pill ${STATUTS[x.statut].ton}`}>{STATUTS[x.statut].label}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn" style={{ height: 32 }} onClick={() => setVue({ id: x.id })}>
                        {x.statut === "brouillon" ? "Modifier" : x.statut === "a_signer" && x.compte_id === compte.id && !x.signature_salarie ? "Lire et signer" : "Ouvrir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function contexte(etab: Etab, directeurNom: string, m: Membre | null, civilite: string, materielContrat: string[], fonctionContrat = ""): Contexte {
  return {
    etablissement: { nom: etab.nom, adresse: etab.adresse ?? "", siret: etab.siret ?? "", ville: etab.ville ?? "" },
    directeur: directeurNom,
    salarie: m ? { civilite: civilite === "Mme" ? "Mme" : "M.", prenom: m.prenom ?? "", nom: m.nom ?? "", fonction: fonctionContrat || (m.fonction ? FONCTIONS[m.fonction] ?? m.fonction : ""), date_embauche: m.date_embauche ?? "", nature: m.nature_contrat ?? "" } : null,
    materielContrat,
  };
}

function ChampDoc({ c, d, set }: { c: Champ; d: Donnees; set: (k: string, v: Donnees[string]) => void }) {
  if (c.si && !c.si(d)) return null;
  const id = `doc-${c.cle}`;
  const v = d[c.cle];
  if (c.type === "oui_non")
    return (
      <label className="coupure-toggle">
        <input type="checkbox" checked={v === true} onChange={(e) => set(c.cle, e.target.checked)} />
        <span>
          <b>{c.label}</b>
          {c.aide && <small>{c.aide}</small>}
        </span>
      </label>
    );
  if (c.type === "choix")
    return (
      <div className="field">
        <label>{c.label}</label>
        <div className="ct-choix">
          {c.options!.map(([k, l]) => (
            <button key={k} type="button" className={v === k ? "on" : ""} onClick={() => set(c.cle, k)}>
              {l}
            </button>
          ))}
        </div>
        {c.aide && <small className="hint">{c.aide}</small>}
      </div>
    );
  if (c.type === "liste")
    return (
      <div className="field">
        <label htmlFor={id}>{c.label}</label>
        <textarea id={id} rows={Math.max(3, (Array.isArray(v) ? v.length : 0) + 1)} value={Array.isArray(v) ? (v as string[]).join("\n") : ""} onChange={(e) => set(c.cle, e.target.value.split("\n"))} placeholder={c.placeholder} />
      </div>
    );
  if (c.type === "materiel") {
    const lignes = (Array.isArray(v) ? v : []) as LigneMateriel[];
    const maj = (i: number, x: Partial<LigneMateriel>) => set(c.cle, lignes.map((l, j) => (j === i ? { ...l, ...x } : l)));
    return (
      <div className="field">
        <label>{c.label}</label>
        <div className="ct-choix">
          {MATERIELS.filter((m) => !lignes.some((l) => l.article === m)).map((m) => (
            <button key={m} type="button" onClick={() => set(c.cle, [...lignes, { article: m, quantite: "1", taille: "", etat: "Neuf" }])}>
              + {m}
            </button>
          ))}
          <button type="button" onClick={() => set(c.cle, [...lignes, { article: "", quantite: "1", taille: "", etat: "Neuf" }])}>
            + Autre
          </button>
        </div>
        {lignes.map((l, i) => (
          <div key={i} className="doc-materiel">
            <input value={l.article} onChange={(e) => maj(i, { article: e.target.value })} placeholder="Article" aria-label="Article" />
            <input value={l.quantite} onChange={(e) => maj(i, { quantite: e.target.value })} placeholder="Qté" inputMode="numeric" aria-label="Quantité" />
            <input value={l.taille} onChange={(e) => maj(i, { taille: e.target.value })} placeholder="Taille" aria-label="Taille" />
            <select value={l.etat} onChange={(e) => maj(i, { etat: e.target.value })} aria-label="État">
              <option>Neuf</option>
              <option>Bon état</option>
              <option>Usagé</option>
            </select>
            <button type="button" className="icon-btn" onClick={() => set(c.cle, lignes.filter((_, j) => j !== i))} aria-label="Retirer">
              ✕
            </button>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={id}>{c.label}</label>
      {c.type === "zone" ? (
        <textarea id={id} rows={4} value={typeof v === "string" ? v : ""} onChange={(e) => set(c.cle, e.target.value)} placeholder={c.placeholder} />
      ) : (
        <input id={id} type={c.type === "date" ? "date" : c.type === "heure" ? "time" : "text"} inputMode={c.type === "nombre" ? "decimal" : undefined} value={typeof v === "string" ? v : ""} onChange={(e) => set(c.cle, e.target.value)} placeholder={c.placeholder} />
      )}
      {c.aide && <small className="hint">{c.aide}</small>}
    </div>
  );
}

function EditeurDoc({ doc, type, membres, etab, directeurNom, etablissementId, auteurId, onRetour, onFini }: { doc: Doc | null; type: TypeDoc; membres: Membre[]; etab: Etab; directeurNom: string; etablissementId: string; auteurId: string; onRetour: () => void; onFini: (m: string, garder?: string) => void }) {
  const sb = getSupabaseClient()!;
  const modele = MODELES_DOCS[type];
  const [compteId, setCompteId] = useState(doc?.compte_id ?? "");
  const [civilite, setCivilite] = useState<string>(doc?.donnees._civilite ?? "M.");
  const [materielContrat, setMaterielContrat] = useState<string[]>([]);
  const [fonctionContrat, setFonctionContrat] = useState(String(doc?.donnees._fonction ?? ""));
  const membre = membres.find((m) => m.id === compteId) ?? null;
  const ctx = useMemo(() => contexte(etab, directeurNom, membre, civilite, materielContrat, fonctionContrat), [etab, directeurNom, membre, civilite, materielContrat, fonctionContrat]);
  const [d, setD] = useState<Donnees>(() => doc?.donnees ?? modele.defauts(contexte(etab, directeurNom, null, "M.", [])));
  const [vueMobile, setVueMobile] = useState<"remplir" | "apercu">("remplir");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const set = (k: string, v: Donnees[string]) => setD((x) => ({ ...x, [k]: v }));
  const texte = useMemo(() => modele.generer(d, ctx), [modele, d, ctx]);
  const alertes = alertesDoc(type, d, ctx);
  const titre = nomFichier(type, type === "promesse" ? { prenom: String(d.candidat_nom ?? "").split(" ")[0] ?? "", nom: String(d.candidat_nom ?? "").split(" ").slice(1).join(" ") } : membre ? { prenom: membre.prenom ?? "", nom: membre.nom ?? "" } : null, String(d.fait_le ?? ""), etab.nom);

  async function choisirSalarie(id: string) {
    setCompteId(id);
    const m = membres.find((x) => x.id === id) ?? null;
    // Dernier contrat du salarié : civilité et matériel prévu.
    const { data } = id ? await sb.from("contrats_travail").select("donnees").eq("compte_id", id).eq("type_document", "contrat").order("created_at", { ascending: false }).limit(1) : { data: null };
    const dc = (data?.[0]?.donnees ?? {}) as { civilite?: string; materiel?: string[]; fonction?: string };
    const civ = dc.civilite === "Mme" ? "Mme" : "M.";
    const mat = Array.isArray(dc.materiel) ? dc.materiel : [];
    setCivilite(civ);
    setMaterielContrat(mat);
    setFonctionContrat(dc.fonction ?? "");
    if (!doc) setD(modele.defauts(contexte(etab, directeurNom, m, civ, mat, dc.fonction ?? "")));
  }

  async function sauver(finaliser: boolean) {
    setErreur(null);
    if (modele.nominatif === "requis" && !compteId) return setErreur("Choisis le salarié concerné.");
    setEnvoi(true);
    const donnees = { ...d, _civilite: civilite, _fonction: fonctionContrat, sans_signature_salarie: !modele.signatureSalarie };
    const ligne = { compte_id: compteId || null, type, titre, donnees, contenu: texte };
    let id = doc?.id;
    if (id) {
      const { error } = await sb.from("documents_rh").update(ligne).eq("id", id);
      if (error) {
        setEnvoi(false);
        return setErreur("Enregistrement refusé : réservé au directeur.");
      }
    } else {
      const { data, error } = await sb.from("documents_rh").insert({ ...ligne, etablissement_id: etablissementId, created_by: auteurId }).select("id").single();
      if (error || !data) {
        setEnvoi(false);
        return setErreur("Enregistrement refusé : réservé au directeur.");
      }
      id = data.id;
    }
    if (finaliser) {
      const statut = modele.nominatif === "non" ? "publie" : "a_signer";
      const { error } = await sb.from("documents_rh").update({ statut, contenu: texte }).eq("id", id!);
      setEnvoi(false);
      if (error) return setErreur("Impossible de finaliser le document.");
      return onFini(statut === "publie" ? "Règlement publié : toute l'équipe peut le consulter" : "Document figé : il reste à le signer", id);
    }
    setEnvoi(false);
    onFini("Brouillon enregistré");
  }

  async function supprimer() {
    if (!doc || !confirm("Supprimer ce brouillon ?")) return;
    const { error } = await sb.from("documents_rh").delete().eq("id", doc.id);
    if (error) return setErreur("Suppression refusée.");
    onFini("Brouillon supprimé");
  }

  const nomSalarie = type === "promesse" ? String(d.candidat_nom ?? "") : membre ? nomComplet(membre) : "";

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">Documents RH</p>
          <h1>
            <Icone nom={modele.icone} /> {modele.label}
          </h1>
          <p>
            {modele.description} <span className="ct-nom">{titre}</span>
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={onRetour}>
            ← Retour
          </button>
          <button className="btn" onClick={() => imprimerContrat(titre)}>
            ⎙ Imprimer / PDF
          </button>
        </div>
      </div>

      <div className="seg seg-inline contrat-bascule print-hide" role="tablist" aria-label="Affichage">
        <button role="tab" aria-selected={vueMobile === "remplir"} className={vueMobile === "remplir" ? "on" : ""} onClick={() => setVueMobile("remplir")}>
          <Icone nom="modifier" /> Remplir
        </button>
        <button role="tab" aria-selected={vueMobile === "apercu"} className={vueMobile === "apercu" ? "on" : ""} onClick={() => setVueMobile("apercu")}>
          <Icone nom="voir" /> Aperçu
        </button>
      </div>

      <div className={`contrat-editeur vue-${vueMobile}`}>
        <div className="contrat-form print-hide">
          {(modele.nominatif === "requis" || modele.nominatif === "optionnel") && (
            <section className="card ct-etape">
              <div className="form-2">
                <div className="field">
                  <label htmlFor="doc-salarie">{modele.nominatif === "optionnel" ? "Salarié (facultatif : sinon fiche générique)" : "Salarié"}</label>
                  <select id="doc-salarie" value={compteId} onChange={(e) => choisirSalarie(e.target.value)} disabled={!!doc && doc.statut !== "brouillon"}>
                    <option value="">{modele.nominatif === "optionnel" ? "— Fiche générique —" : "— Choisir —"}</option>
                    {membres
                      .filter((m) => m.statut !== "parti" || type === "certificat")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {nomComplet(m)}
                          {m.statut === "parti" ? " (parti)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
                {compteId && (
                  <div className="field">
                    <label>Civilité</label>
                    <div className="ct-choix">
                      {(["M.", "Mme"] as const).map((c) => (
                        <button key={c} type="button" className={civilite === c ? "on" : ""} onClick={() => setCivilite(c)}>
                          {c === "Mme" ? "Madame" : "Monsieur"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {type === "fiche_poste" && (
                <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={() => setD(modele.defauts(ctx))}>
                  ↺ Pré-remplir selon le poste
                </button>
              )}
            </section>
          )}

          <section className="card ct-etape">
            {modele.champs.map((c) => (
              <ChampDoc key={c.cle} c={c} d={d} set={set} />
            ))}
          </section>

          {alertes.length > 0 && (
            <div className="banner" style={{ background: "var(--yellow)", borderColor: "#eedda6", margin: 0 }}>
              <span>⚠ {alertes.join(" ")}</span>
            </div>
          )}
          {erreur && (
            <div className="error" role="alert">
              {erreur}
            </div>
          )}
          <div className="contrat-actions">
            {doc && (
              <button className="btn btn-danger-ghost" onClick={supprimer} disabled={envoi}>
                Supprimer
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => sauver(false)} disabled={envoi}>
              Enregistrer le brouillon
            </button>
            <button className="btn btn-primary" onClick={() => sauver(true)} disabled={envoi}>
              {modele.nominatif === "non" ? "Publier" : modele.signatureSalarie ? "Figer et faire signer" : "Figer et signer"}
            </button>
          </div>
        </div>

        <div className="contrat-apercu">
          <DocumentContrat
            texte={texte}
            employeur={etab.nom}
            salarie={nomSalarie || "—"}
            paraphe={["fiche_poste", "remise_materiel", "avertissement", "convocation"].includes(modele.cle)}
            feminin={civilite === "Mme"}
            roleSalarie={modele.signatureSalarie && (compteId || modele.nominatif === "requis") ? "" : null}
            mentionSalarie={modele.mentionSalarie}
          />
        </div>
      </div>
    </>
  );
}

function VueDoc({ d, directeur, moi, membres, etab, directeurNom, onRetour, onFini }: { d: Doc; directeur: boolean; moi: string; membres: Membre[]; etab: Etab; directeurNom: string; onRetour: () => void; onFini: (m: string, garder?: string) => void }) {
  const sb = getSupabaseClient()!;
  const modele = MODELES_DOCS[d.type];
  const [signe, setSigne] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const membre = membres.find((m) => m.id === d.compte_id);
  const nomSalarie = d.type === "promesse" ? String(d.donnees.candidat_nom ?? "") : membre ? nomComplet(membre) : "—";
  const avecSalarie = modele.signatureSalarie && !!d.compte_id;
  const peutSignerEmployeur = directeur && d.statut === "a_signer" && !d.signature_employeur;
  const peutSignerSalarie = avecSalarie && d.compte_id === moi && d.statut === "a_signer" && !d.signature_salarie;

  async function signer(png: string) {
    setEnvoi(true);
    setErreur(null);
    const { error } = peutSignerSalarie ? await sb.rpc("signer_mon_document", { p_document: d.id, p_signature: png }) : await sb.from("documents_rh").update({ signature_employeur: png, statut: "a_signer" }).eq("id", d.id);
    setEnvoi(false);
    if (error) return setErreur("Signature refusée. Recharge la page et réessaie.");
    setSigne(false);
    onFini("Signature enregistrée", d.id);
  }

  async function changer(statut: "brouillon" | "annule") {
    if (!confirm(statut === "brouillon" ? "Revenir en brouillon ? Les signatures déjà posées seront effacées." : "Annuler ce document ? Il restera consultable.")) return;
    const { error } = await sb.from("documents_rh").update({ statut }).eq("id", d.id);
    if (error) return setErreur("Modification refusée.");
    onFini(statut === "brouillon" ? "Document repassé en brouillon" : "Document annulé", statut === "brouillon" ? d.id : undefined);
  }

  return (
    <>
      <div className="page-head print-hide">
        <div>
          <p className="eyebrow">Documents RH</p>
          <h1>
            <Icone nom={modele.icone} /> {modele.label}
          </h1>
          <p>
            <span className={`pill ${STATUTS[d.statut].ton}`}>{STATUTS[d.statut].label}</span> <span className="ct-nom">{d.titre}</span>
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={onRetour}>
            ← Retour
          </button>
          <button className="btn" onClick={() => imprimerContrat(d.titre)}>
            ⎙ Imprimer / PDF
          </button>
          {directeur && d.statut === "a_signer" && (
            <button className="btn" onClick={() => changer("brouillon")}>
              Modifier (retour brouillon)
            </button>
          )}
          {directeur && (d.statut === "signe" || d.statut === "publie") && (
            <button className="btn btn-danger-ghost" onClick={() => changer("annule")}>
              Annuler
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
              <p style={{ margin: 0 }}>{peutSignerSalarie ? `Lis le document jusqu'au bout. En signant, tu indiques : « ${modele.mentionSalarie ?? "Lu et approuvé"} ».` : "Signe en tant qu'employeur."}</p>
              <button className="btn btn-primary btn-lg" onClick={() => setSigne(true)}>
                <Icone nom="signer" /> Signer
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

      <DocumentContrat
        texte={d.contenu ?? ""}
        employeur={etab.nom}
        salarie={nomSalarie}
        sig={d}
        paraphe={d.type === "fiche_poste" || d.type === "remise_materiel" || d.type === "avertissement" || d.type === "convocation"}
        feminin={d.donnees._civilite === "Mme"}
        signataires={{ employeur: directeurNom, salarie: nomSalarie }}
        roleSalarie={avecSalarie ? "" : null}
        mentionSalarie={modele.mentionSalarie}
      />
    </>
  );
}
