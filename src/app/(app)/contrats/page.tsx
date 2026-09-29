"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { nomComplet, useConnecte } from "@/lib/session";
import { chargerMembres } from "@/lib/personnel";
import type { Membre } from "@/lib/personnel";
import { MODELES, nomContrat } from "@/lib/contrats";
import type { Donnees, ModeleCle, Reglages } from "@/lib/contrats";
import DocumentContrat, { imprimerContrat } from "@/components/contrats/DocumentContrat";
import Editeur from "@/components/contrats/Editeur";
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
  const [reglages, setReglages] = useState<Reglages>({ postes: [], defauts: {} });
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
      sb.from("contrats_reglages")
        .select("data")
        .eq("etablissement_id", etablissement.id)
        .maybeSingle()
        .then(({ data }) => {
          const r = (data?.data ?? {}) as Partial<Reglages>;
          setReglages({ postes: r.postes ?? [], defauts: r.defauts ?? {} });
        });
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
          <Editeur
            key={c?.id ?? "nouveau"}
            contrat={c}
            membres={membres}
            taux={taux}
            etab={etab}
            reglages={reglages}
            directeurNom={nomComplet(compte)}
            etablissementId={etablissement.id}
            auteurId={compte.id}
            onRetour={() => setVue(null)}
            onFini={fini}
            onReglages={(r, m) => {
              setReglages(r);
              setToast(m);
            }}
          />
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
                      <b className="ct-nom">{nomContrat(c.modele, c.donnees)}</b>
                      <small className="justif">
                        {MODELES[c.modele]?.label ?? c.modele} · {MODELES[c.modele]?.pays === "BE" ? "🇧🇪" : "🇫🇷"}
                      </small>
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
          <button className="btn" onClick={() => imprimerContrat(nomContrat(c.modele, c.donnees))}>
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

      <DocumentContrat texte={c.contenu ?? ""} employeur={employeur} salarie={salarie} sig={c} paraphe={c.donnees.paraphe !== false} feminin={c.donnees.civilite === "Mme"} />
    </>
  );
}
