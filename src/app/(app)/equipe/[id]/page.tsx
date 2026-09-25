"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, ROLE_LABEL, useConnecte } from "@/lib/session";
import type { Role } from "@/lib/session";
import { ajouterJours, dureeCreneau, formatDuree, iso, lundi, MOTIFS_ABSENCE, ORDRE_POSTES, POSTES } from "@/lib/planning";
import type { Creneau } from "@/lib/planning";
import { anciennete, COLONNES_MEMBRE, dateFr, emailValide, FONCTIONS, NATURES, STATUTS, TYPES_CONTRAT } from "@/lib/personnel";
import type { Membre } from "@/lib/personnel";

type Brouillon = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  date_naissance: string;
  fonction: string;
  poste: string;
  nature_contrat: string;
  type_contrat: string;
  heures_contrat: string;
  date_embauche: string;
  role: Role;
};

type Conge = { id: string; date_debut: string; date_fin: string; motif: string | null; statut: string };

function versBrouillon(m: Membre): Brouillon {
  return {
    prenom: m.prenom ?? "",
    nom: m.nom ?? "",
    email: m.email ?? "",
    telephone: m.telephone ?? "",
    date_naissance: m.date_naissance ?? "",
    fonction: m.fonction ?? "",
    poste: m.poste ?? "",
    nature_contrat: m.nature_contrat ?? "",
    type_contrat: m.type_contrat ?? "",
    heures_contrat: m.heures_contrat != null ? String(Number(m.heures_contrat)) : "",
    date_embauche: m.date_embauche ?? "",
    role: m.role,
  };
}

export default function FicheCollaborateur() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { compte, etablissement } = useConnecte();
  const sb = getSupabaseClient()!;
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const directeur = compte.role === "directeur";
  const estMoi = id === compte.id;
  const voitTout = gestion || estMoi;

  const [m, setM] = useState<Membre | null | undefined>(undefined);
  const [b, setB] = useState<Brouillon | null>(null);
  const [taux, setTaux] = useState<string>("");
  const [tauxInitial, setTauxInitial] = useState<string>("");
  const [semaine, setSemaine] = useState<Creneau[] | null>(null);
  const [conges, setConges] = useState<Conge[] | null>(null);
  const [version, setVersion] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [depart, setDepart] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [copie, setCopie] = useState(false);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let actif = true;
    const debut = lundi(new Date());
    Promise.all([
      sb.from("comptes").select(COLONNES_MEMBRE).eq("id", id).eq("etablissement_id", etablissement.id).maybeSingle(),
      directeur ? sb.from("comptes_remuneration").select("taux_brut").eq("compte_id", id).maybeSingle() : null,
      voitTout ? sb.from("planning_creneaux").select("id, compte_id, date, type, heure_debut, heure_fin, pause_minutes, motif, note").eq("compte_id", id).gte("date", debut).lte("date", ajouterJours(debut, 6)).order("date") : null,
      voitTout ? sb.from("conges").select("id, date_debut, date_fin, motif, statut").eq("compte_id", id).eq("type", "conge").gte("date_fin", iso(new Date())).neq("statut", "refusee").order("date_debut").limit(5) : null,
    ]).then(([c, r, p, cg]) => {
      if (!actif) return;
      const membre = (c.data as Membre | null) ?? null;
      setM(membre);
      setB(membre ? versBrouillon(membre) : null);
      const t = r?.data?.taux_brut != null ? String(Number(r.data.taux_brut)) : "";
      setTaux(t);
      setTauxInitial(t);
      setSemaine(p && !p.error ? (p.data as Creneau[]) : null);
      setConges(cg && !cg.error ? (cg.data as Conge[]) : null);
    });
    return () => {
      actif = false;
    };
  }, [sb, id, etablissement.id, directeur, voitTout, version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const modifie = useMemo(() => !!(m && b && (JSON.stringify(versBrouillon(m)) !== JSON.stringify(b) || taux !== tauxInitial)), [m, b, taux, tauxInitial]);

  if (m === undefined || (m && !b)) {
    return <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />;
  }
  if (m === null || !b) {
    return (
      <div className="card soon-card">
        <h1>Collaborateur introuvable</h1>
        <p>Cette fiche n&apos;existe pas ou n&apos;appartient pas à {etablissement.nom}.</p>
        <p style={{ marginTop: 18 }}>
          <Link className="btn" href="/equipe">
            Retour à l&apos;équipe
          </Link>
        </p>
      </div>
    );
  }

  const set = <K extends keyof Brouillon>(k: K, v: Brouillon[K]) => setB({ ...b, [k]: v });
  const lectureSeule = !gestion;

  async function enregistrer() {
    if (!m || !b) return;
    setErreur(null);
    if (!b.prenom.trim() || !b.nom.trim()) return setErreur("Le prénom et le nom sont obligatoires.");
    if (m.statut === "invite" && !emailValide(b.email)) return setErreur("E-mail invalide : il sert à activer le compte.");
    const h = b.heures_contrat.trim() === "" ? null : Number(b.heures_contrat.replace(",", "."));
    if (h !== null && (!Number.isFinite(h) || h < 0 || h > 60)) return setErreur("Heures contrat : un nombre entre 0 et 60.");
    const t = taux.trim() === "" ? null : Number(taux.replace(",", "."));
    if (t !== null && (!Number.isFinite(t) || t < 0 || t > 200)) return setErreur("Taux horaire : un montant en euros, par exemple 12,50.");

    setEnvoi(true);
    const maj: Record<string, unknown> = {
      prenom: b.prenom.trim(),
      nom: b.nom.trim(),
      telephone: b.telephone.trim() || null,
      date_naissance: b.date_naissance || null,
      fonction: b.fonction || null,
      poste: b.poste || null,
      nature_contrat: b.nature_contrat || null,
      type_contrat: b.type_contrat || null,
      heures_contrat: h,
      date_embauche: b.date_embauche || null,
    };
    // L'e-mail relie l'invitation au futur compte : modifiable seulement tant qu'elle n'est pas activée.
    if (m.statut === "invite") maj.email = b.email.trim().toLowerCase();
    // Le niveau d'accès reste l'affaire du directeur, et on ne se retire pas ses propres droits.
    if (directeur && !estMoi) maj.role = b.role;

    const { error } = await sb.from("comptes").update(maj).eq("id", m.id);
    let errTaux = null;
    if (!error && directeur && taux !== tauxInitial) {
      errTaux = (await sb.from("comptes_remuneration").upsert({ compte_id: m.id, etablissement_id: etablissement.id, taux_brut: t }, { onConflict: "compte_id" })).error;
    }
    setEnvoi(false);
    if (error || errTaux) return setErreur("Enregistrement refusé. Vérifie ton niveau d'accès.");
    setToast("Fiche enregistrée");
    recharger();
  }

  async function changerStatut(statut: "parti" | "actif" | "invite", dateDepart: string | null) {
    if (!m) return;
    setEnvoi(true);
    const { error } = await sb.from("comptes").update({ statut, date_depart: dateDepart }).eq("id", m.id);
    setEnvoi(false);
    setDepart(null);
    if (error) return setErreur("Modification refusée.");
    setToast(statut === "parti" ? "Départ enregistré" : "Collaborateur réintégré");
    recharger();
  }

  async function supprimerInvitation() {
    if (!m) return;
    setEnvoi(true);
    const { error } = await sb.from("comptes").delete().eq("id", m.id).eq("statut", "invite");
    setEnvoi(false);
    if (error) return setErreur("Suppression refusée.");
    router.replace("/equipe");
  }

  const lien = typeof window !== "undefined" ? `${window.location.origin}/activer` : "/activer";
  const message = `Bonjour ${m.prenom ?? ""}, ton accès à Juliette (${etablissement.nom}) est prêt.\n\n1. Va sur ${lien}\n2. Code établissement : ${etablissement.code}\n3. E-mail : ${m.email ?? ""}\n4. Choisis ton mot de passe.`;
  const minutesSemaine = (semaine ?? []).reduce((s, c) => s + dureeCreneau(c), 0);
  const mensuel = taux && b.heures_contrat ? Number(taux.replace(",", ".")) * Number(b.heures_contrat.replace(",", ".")) * (52 / 12) : null;

  return (
    <>
      <Link href="/equipe" className="back-link">
        ← Équipe
      </Link>

      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="avatar avatar-xl">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initiales(m)}</span>
          <div>
            <h1 style={{ margin: "0 0 6px" }}>{nomComplet(m)}</h1>
            <div className="person-tags">
              <span className="pill t-lav">{FONCTIONS[m.fonction ?? ""] ?? ROLE_LABEL[m.role]}</span>
              {m.poste && <span className={`pill ${POSTES[m.poste]?.ton}`}>{POSTES[m.poste]?.label}</span>}
              <span className={`pill ${STATUTS[m.statut].ton}`}>{STATUTS[m.statut].label}</span>
            </div>
          </div>
        </div>
        {gestion && (
          <button className="btn btn-primary" onClick={enregistrer} disabled={!modifie || envoi}>
            {envoi ? "Enregistrement…" : modifie ? "Enregistrer les modifications" : "À jour"}
          </button>
        )}
      </div>

      {erreur && (
        <div className="error" role="alert" style={{ marginBottom: 14 }}>
          {erreur}
        </div>
      )}

      {m.statut === "invite" && gestion && (
        <div className="banner">
          <span>
            <b>{m.prenom} n&apos;a pas encore activé son compte.</b> Transmets-lui le lien, le code <b>{etablissement.code}</b> et son e-mail <b>{m.email}</b>.
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => navigator.clipboard.writeText(message).then(() => setCopie(true))}>
              {copie ? "✓ Copié" : "Copier le message d'invitation"}
            </button>
            {!suppression ? (
              <button className="btn btn-danger-ghost" onClick={() => setSuppression(true)}>
                Supprimer l&apos;invitation
              </button>
            ) : (
              <>
                <button className="btn" onClick={() => setSuppression(false)}>
                  Garder
                </button>
                <button className="btn btn-danger" onClick={supprimerInvitation} disabled={envoi}>
                  Confirmer la suppression
                </button>
              </>
            )}
          </span>
        </div>
      )}

      <div className="fiche-grid">
        <section className="card">
          <div className="card-head">
            <h2>Identité & contact</h2>
          </div>
          <div className="form-2">
            <Champ label="Prénom" id="prenom" value={b.prenom} onChange={(v) => set("prenom", v)} disabled={lectureSeule} />
            <Champ label="Nom" id="nom" value={b.nom} onChange={(v) => set("nom", v)} disabled={lectureSeule} />
          </div>
          <Champ
            label="E-mail"
            id="email"
            type="email"
            value={b.email}
            onChange={(v) => set("email", v)}
            disabled={lectureSeule || m.statut !== "invite"}
            aide={m.statut !== "invite" && gestion ? "Lié au compte de connexion : seul le collaborateur peut le changer." : undefined}
          />
          <Champ label="Téléphone" id="tel" type="tel" value={b.telephone} onChange={(v) => set("telephone", v)} disabled={lectureSeule} />
          {voitTout && <Champ label="Date de naissance" id="naissance" type="date" value={b.date_naissance} onChange={(v) => set("date_naissance", v)} disabled={lectureSeule} />}
        </section>

        {voitTout && (
          <section className="card">
            <div className="card-head">
              <h2>Poste & contrat</h2>
              {m.date_embauche && <span className="hint">Ancienneté : {anciennete(m.date_embauche)}</span>}
            </div>
            <div className="form-2">
              <Select label="Fonction" id="fonction" value={b.fonction} onChange={(v) => set("fonction", v)} options={FONCTIONS} disabled={lectureSeule} />
              <Select
                label="Poste au planning"
                id="poste"
                value={b.poste}
                onChange={(v) => set("poste", v)}
                options={Object.fromEntries(ORDRE_POSTES.map((k) => [k, POSTES[k].label]))}
                disabled={lectureSeule}
              />
            </div>
            <div className="form-2">
              <Select label="Type de contrat" id="nature" value={b.nature_contrat} onChange={(v) => set("nature_contrat", v)} options={NATURES} disabled={lectureSeule} />
              <Select
                label="Durée hebdo"
                id="type"
                value={b.type_contrat}
                onChange={(v) => {
                  const h = TYPES_CONTRAT[v]?.heures;
                  setB({ ...b, type_contrat: v, heures_contrat: h != null ? String(h) : b.heures_contrat });
                }}
                options={Object.fromEntries(Object.entries(TYPES_CONTRAT).map(([k, x]) => [k, x.label]))}
                disabled={lectureSeule}
              />
            </div>
            <div className="form-2">
              <Champ label="Heures contrat / semaine" id="heures" value={b.heures_contrat} onChange={(v) => set("heures_contrat", v)} disabled={lectureSeule} inputMode="decimal" />
              <Champ label="Date d'embauche" id="embauche" type="date" value={b.date_embauche} onChange={(v) => set("date_embauche", v)} disabled={lectureSeule} />
            </div>
            {directeur && !estMoi && (
              <div className="field">
                <label>Niveau d&apos;accès</label>
                <div className="seg">
                  {(["salarie", "responsable", "directeur"] as const).map((r) => (
                    <button key={r} className={b.role === r ? "on" : ""} onClick={() => set("role", r)}>
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {directeur && (
          <section className="card">
            <div className="card-head">
              <h2>Rémunération</h2>
              <span className="pill t-lav">Visible par le directeur uniquement</span>
            </div>
            <Champ label="Taux horaire brut (€)" id="taux" value={taux} onChange={setTaux} inputMode="decimal" aide="Sert à estimer le coût du planning." />
            {mensuel != null && Number.isFinite(mensuel) && (
              <p className="hint">
                Soit environ <b>{mensuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</b> brut par mois pour {b.heures_contrat} h / semaine.
              </p>
            )}
          </section>
        )}

        {voitTout && (
          <section className="card">
            <div className="card-head">
              <h2>Cette semaine</h2>
              <Link href="/planning">Planning →</Link>
            </div>
            {semaine === null ? (
              <div className="empty">Planning non accessible.</div>
            ) : !semaine.length ? (
              <div className="empty">Rien de prévu cette semaine.</div>
            ) : (
              <div className="rows">
                {semaine.map((c) => (
                  <div key={c.id} className="row">
                    <span className="main-txt">
                      <b style={{ textTransform: "capitalize" }}>{new Date(c.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })}</b>
                    </span>
                    <span className={`slot slot-${c.type}`}>
                      {c.type === "shift" ? `${c.heure_debut?.slice(0, 5)} – ${c.heure_fin?.slice(0, 5)}` : c.type === "repos" ? "Repos" : MOTIFS_ABSENCE[c.motif ?? "autre"]}
                    </span>
                  </div>
                ))}
                <div className="row">
                  <span className="main-txt">
                    <b>Total</b>
                  </span>
                  <span className="right">
                    <b>{formatDuree(minutesSemaine)}</b>
                    {m.heures_contrat != null ? ` / ${Number(m.heures_contrat)} h` : ""}
                  </span>
                </div>
              </div>
            )}
            {conges && conges.length > 0 && (
              <>
                <div className="nav-label" style={{ padding: 0, margin: "16px 0 6px" }}>
                  Congés à venir
                </div>
                <div className="rows">
                  {conges.map((c) => (
                    <div key={c.id} className="row">
                      <span className="main-txt">
                        <b>{MOTIFS_ABSENCE[c.motif ?? "autre"] ?? "Congé"}</b>
                        <small>
                          du {dateFr(c.date_debut)} au {dateFr(c.date_fin)}
                        </small>
                      </span>
                      <span className={`pill ${c.statut === "validee" ? "t-mint" : "t-yellow"}`}>{c.statut === "validee" ? "Validé" : "En attente"}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {voitTout && (
          <section className="card">
            <div className="card-head">
              <h2>Accès</h2>
            </div>
            <div className="rows">
              <div className="row">
                <span className="main-txt">
                  <b>Niveau d&apos;accès</b>
                  <small>{m.role === "salarie" ? "Son planning, le pointage, ses congés" : m.role === "responsable" ? "Gestion du planning, de l'équipe, du stock" : "Tous les modules"}</small>
                </span>
                <span className="pill t-lav">{ROLE_LABEL[m.role]}</span>
              </div>
              {m.code_badgeuse && (
                <div className="row">
                  <span className="main-txt">
                    <b>Code badgeuse</b>
                    <small>À saisir sur la tablette de pointage</small>
                  </span>
                  <span className="code-badge">{m.code_badgeuse}</span>
                </div>
              )}
              <div className="row">
                <span className="main-txt">
                  <b>Dans l&apos;équipe depuis</b>
                  <small>Fiche créée le {dateFr(m.created_at)}</small>
                </span>
                <span className="right">{dateFr(m.date_embauche)}</span>
              </div>
            </div>
          </section>
        )}

        {gestion && !estMoi && (
          <section className="card">
            <div className="card-head">
              <h2>{m.statut === "parti" ? "Départ" : "Fin de contrat"}</h2>
            </div>
            {m.statut === "parti" ? (
              <>
                <p className="hint" style={{ marginBottom: 12 }}>
                  Parti le {dateFr(m.date_depart)}. Son historique (planning, pointages, congés) est conservé. Il garde l&apos;accès à ses données pendant 6 mois.
                </p>
                <button className="btn" onClick={() => changerStatut(m.auth_user_id ? "actif" : "invite", null)} disabled={envoi}>
                  Réintégrer dans l&apos;équipe
                </button>
              </>
            ) : depart === null ? (
              <>
                <p className="hint" style={{ marginBottom: 12 }}>
                  Enregistre son départ plutôt que de supprimer la fiche : l&apos;historique reste disponible pour la paie et les contrôles.
                </p>
                <button className="btn btn-danger-ghost" onClick={() => setDepart(iso(new Date()))}>
                  Enregistrer un départ
                </button>
              </>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <Champ label="Dernier jour" id="depart" type="date" value={depart} onChange={setDepart} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => setDepart(null)}>
                    Annuler
                  </button>
                  <button className="btn btn-danger" onClick={() => changerStatut("parti", depart)} disabled={envoi || !depart}>
                    Confirmer le départ
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function Champ(p: { label: string; id: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; aide?: string; inputMode?: "decimal" }) {
  return (
    <div className="field">
      <label htmlFor={p.id}>{p.label}</label>
      <input id={p.id} type={p.type ?? "text"} value={p.value} onChange={(e) => p.onChange(e.target.value)} disabled={p.disabled} inputMode={p.inputMode} />
      {p.aide && <span className="hint">{p.aide}</span>}
    </div>
  );
}

function Select(p: { label: string; id: string; value: string; onChange: (v: string) => void; options: Record<string, string>; disabled?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={p.id}>{p.label}</label>
      <select id={p.id} value={p.value} onChange={(e) => p.onChange(e.target.value)} disabled={p.disabled}>
        <option value="">—</option>
        {Object.entries(p.options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}
