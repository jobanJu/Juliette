"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { MODULES } from "@/lib/modules";
import { initiales, nomComplet, useConnecte } from "@/lib/session";
import type { Compte } from "@/lib/session";
import Icone from "@/components/Icone";
import MiseEnRoute from "@/components/MiseEnRoute";
import type { NomIcone } from "@/components/Icone";

type Presence = { compte: Compte; etat: "present" | "pause" | "parti"; depuis: string };
type Creneau = { compte_id: string; heure_debut: string | null; heure_fin: string | null };
type Critique = { id: string; nom: string; stock: number; seuil: number; unite: string };
type Evenement = { id: string; nom: string; date: string; lieu: string | null; sens: "hausse" | "baisse" | null; impact: string | null };
type Commande = { id: string; fournisseur_nom: string; envoyee_at: string; lignes: unknown[] };

type Donnees = {
  presences: Presence[] | null;
  prevus: Creneau[] | null;
  critiques: Critique[] | null;
  inventaireVide: boolean;
  pertes7j: { nb: number; euros: number } | null;
  aCommander: number | null;
  congesEnAttente: number | null;
  evenements: Evenement[] | null;
  commandes: Commande[] | null;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const heure = (t: string) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const hhmm = (t: string | null) => (t ? t.slice(0, 5).replace(":", "h") : "—");
const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const CARTES = [
  { id: "presence", label: "Présences", detail: "Pointages et équipe présente", icon: "horloge", couleur: "t-mint" },
  { id: "stock-stat", label: "Stock critique", detail: "Produits sous le seuil", icon: "stock", couleur: "t-peach" },
  { id: "pertes", label: "Pertes · 7 jours", detail: "Montant et déclarations", icon: "baisse", couleur: "t-red" },
  { id: "commandes-stat", label: "À commander", detail: "Liste d’achat et demandes en attente", icon: "camion", couleur: "t-lav" },
  { id: "equipe", label: "Équipe du jour", detail: "Qui travaille aujourd’hui", icon: "equipe", couleur: "t-blue" },
  { id: "stock", label: "Stock à surveiller", detail: "Détail des alertes stock", icon: "alerte", couleur: "t-peach" },
  { id: "evenements", label: "Événements à venir", detail: "Événements qui influencent l’activité", icon: "evenement", couleur: "t-yellow" },
  { id: "commandes", label: "Dernières commandes", detail: "Commandes envoyées aux fournisseurs", icon: "camion", couleur: "t-lav" },
  { id: "raccourcis", label: "Raccourcis", detail: "Accès rapides aux modules", icon: "eclair", couleur: "t-blue" },
] as const satisfies readonly { id: string; label: string; detail: string; icon: NomIcone; couleur: string }[];

const CARTES_PAR_DEFAUT = CARTES.map((carte) => carte.id);
const VUE_ESSENTIELLE = ["presence", "stock-stat", "equipe", "stock", "raccourcis"];

function salutation() {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
}

async function charger(etabId: string, modules: Set<string>, cartesActives: Set<string>): Promise<Donnees> {
  const sb = getSupabaseClient()!;
  const auj = new Date();
  const debutJour = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate()).toISOString();
  const il7j = new Date(auj.getTime() - 7 * 864e5);
  const a = (m: string) => modules.has(m);

  const equipeVisible = cartesActives.has("equipe") || cartesActives.has("presence");
  const stockVisible = cartesActives.has("stock") || cartesActives.has("stock-stat");
  const [comptes, pointages, planning, produits, releves, pertes, liste, conges, evts, cmds] = await Promise.all([
    equipeVisible
      ? sb.from("comptes").select("id, prenom, nom, email, role, statut, poste, avatar_url, etablissement_id").eq("etablissement_id", etabId)
      : null,
    equipeVisible && a("pointeuse")
      ? sb.from("pointages").select("compte_id, type, horodatage").eq("etablissement_id", etabId).gte("horodatage", debutJour).order("horodatage")
      : null,
    equipeVisible
      ? sb.from("planning_creneaux").select("compte_id, heure_debut, heure_fin").eq("etablissement_id", etabId).eq("date", iso(auj)).eq("type", "shift")
      : null,
    (stockVisible && a("inventaire")) || (cartesActives.has("pertes") && a("perte"))
      ? sb.from("produits").select("id, nom, unite, seuil, prix_unitaire").eq("etablissement_id", etabId)
      : null,
    stockVisible && a("inventaire")
      ? sb.from("inventaire_releves").select("produit_id, zone_id, valeur, created_at").eq("etablissement_id", etabId).order("created_at", { ascending: false }).limit(5000)
      : null,
    cartesActives.has("pertes") && a("perte") ? sb.from("pertes").select("produit_id, valeur").eq("etablissement_id", etabId).gte("date", iso(il7j)) : null,
    cartesActives.has("commandes-stat") && a("aide-commande") ? sb.from("commande_liste").select("produit_id", { count: "exact", head: true }).eq("etablissement_id", etabId) : null,
    cartesActives.has("commandes-stat") && a("rh-conges") ? sb.from("conges").select("id", { count: "exact", head: true }).eq("etablissement_id", etabId).eq("statut", "en_attente") : null,
    cartesActives.has("evenements")
      ? sb.from("evenements").select("id, nom, date, lieu, sens, impact").eq("etablissement_id", etabId).gte("date", iso(auj)).order("date").limit(5)
      : null,
    cartesActives.has("commandes") && a("aide-commande")
      ? sb.from("commandes_envoyees").select("id, fournisseur_nom, envoyee_at, lignes").eq("etablissement_id", etabId).order("envoyee_at", { ascending: false }).limit(4)
      : null,
  ]);

  const parCompte = new Map((comptes?.data ?? []).map((c) => [c.id, c as Compte]));

  // Présence : le dernier pointage du jour de chaque personne dit où elle en est.
  let presences: Presence[] | null = null;
  if (pointages && !pointages.error) {
    const dernier = new Map<string, { type: string; horodatage: string }>();
    for (const p of pointages.data ?? []) dernier.set(p.compte_id, p);
    presences = [...dernier.entries()]
      .filter(([id]) => parCompte.has(id))
      .map(([id, p]) => ({
        compte: parCompte.get(id)!,
        etat: p.type === "depart" ? "parti" : p.type === "pause_debut" ? "pause" : "present",
        depuis: p.horodatage,
      }));
    presences.sort((x, y) => ["present", "pause", "parti"].indexOf(x.etat) - ["present", "pause", "parti"].indexOf(y.etat));
  }

  // Stock : dernier relevé par (produit, zone), additionné sur les zones, comparé au seuil.
  let critiques: Critique[] | null = null;
  let inventaireVide = false;
  const prix = new Map<string, number>();
  if (produits && !produits.error) {
    for (const p of produits.data ?? []) prix.set(p.id, Number(p.prix_unitaire ?? 0));
  }
  if (produits && releves && !produits.error && !releves.error) {
    inventaireVide = !(releves.data ?? []).length;
    const vus = new Set<string>();
    const stock = new Map<string, number>();
    for (const r of releves.data ?? []) {
      const k = `${r.produit_id}:${r.zone_id}`;
      if (vus.has(k)) continue;
      vus.add(k);
      stock.set(r.produit_id, (stock.get(r.produit_id) ?? 0) + Number(r.valeur));
    }
    critiques = (produits.data ?? [])
      .filter((p) => p.seuil != null && stock.has(p.id) && stock.get(p.id)! <= Number(p.seuil))
      .map((p) => ({ id: p.id, nom: p.nom, stock: stock.get(p.id)!, seuil: Number(p.seuil), unite: p.unite ?? "" }))
      .sort((x, y) => x.stock / (x.seuil || 1) - y.stock / (y.seuil || 1));
  }

  const pertes7j =
    pertes && !pertes.error
      ? {
          nb: pertes.data?.length ?? 0,
          euros: (pertes.data ?? []).reduce((s, p) => s + Number(p.valeur) * (prix.get(p.produit_id) ?? 0), 0),
        }
      : null;

  return {
    presences,
    prevus: planning ? (planning.error ? null : (planning.data as Creneau[])) : null,
    critiques,
    inventaireVide,
    pertes7j,
    aCommander: liste && !liste.error ? (liste.count ?? 0) : null,
    congesEnAttente: conges && !conges.error ? (conges.count ?? 0) : null,
    evenements: evts ? (evts.error ? null : (evts.data as Evenement[])) : null,
    commandes: cmds && !cmds.error ? (cmds.data as Commande[]) : null,
  };
}

function Stat({ label, icon, ton, valeur, unite, pied, href }: { label: string; icon: NomIcone; ton: string; valeur: string | number | null; unite?: string; pied: string; href: string }) {
  return (
    <Link href={href} className="card stat">
      <div className="stat-top">
        {label}
        <span className={`chip-ic ${ton}`}><Icone nom={icon} /></span>
      </div>
      {valeur === null ? (
        <div className="skeleton" style={{ height: 31, width: "50%" }} />
      ) : (
        <div className="stat-value">
          {valeur}
          {unite && <small>{unite}</small>}
        </div>
      )}
      <div className="stat-foot">{pied}</div>
    </Link>
  );
}

export default function TableauDeBord() {
  const { compte, etablissement, modules } = useConnecte();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [cartes, setCartes] = useState<string[]>(CARTES_PAR_DEFAUT);
  const [preferencesChargees, setPreferencesChargees] = useState(false);
  const [preferencesEnregistrables, setPreferencesEnregistrables] = useState(false);
  const [personnalisation, setPersonnalisation] = useState(false);
  const [sauvegarde, setSauvegarde] = useState<"repos" | "en-cours" | "ok" | "erreur">("repos");
  const visibles = useMemo(() => new Set(cartes), [cartes]);

  useEffect(() => {
    let actif = true;
    setPreferencesChargees(false);
    setPreferencesEnregistrables(false);
    getSupabaseClient()!
      .from("tableau_bord_preferences")
      .select("cartes")
      .eq("compte_id", compte.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!actif) return;
        if (error) {
          setCartes(CARTES_PAR_DEFAUT);
          setSauvegarde("erreur");
          setPreferencesChargees(true);
          return;
        }
        const enregistrees = Array.isArray(data?.cartes) ? data.cartes.filter((id: string) => CARTES.some((carte) => carte.id === id)) : null;
        setCartes(enregistrees ?? CARTES_PAR_DEFAUT);
        setPreferencesEnregistrables(true);
        setPreferencesChargees(true);
      }, () => {
        if (!actif) return;
        setCartes(CARTES_PAR_DEFAUT);
        setSauvegarde("erreur");
        setPreferencesChargees(true);
      });
    return () => {
      actif = false;
    };
  }, [compte.id]);

  useEffect(() => {
    if (!preferencesChargees || !preferencesEnregistrables) return;
    setSauvegarde("en-cours");
    const minuteur = window.setTimeout(async () => {
      try {
        const { error } = await getSupabaseClient()!
          .from("tableau_bord_preferences")
          .upsert({ compte_id: compte.id, cartes }, { onConflict: "compte_id" });
        setSauvegarde(error ? "erreur" : "ok");
      } catch {
        setSauvegarde("erreur");
      }
    }, 350);
    return () => window.clearTimeout(minuteur);
  }, [cartes, compte.id, preferencesChargees, preferencesEnregistrables]);

  function basculerCarte(id: string) {
    setCartes((actuelles) => actuelles.includes(id) ? actuelles.filter((carte) => carte !== id) : [...actuelles, id]);
  }

  useEffect(() => {
    if (!preferencesChargees) return;
    let actif = true;
    if (!visibles.size) {
      setD(null);
      setErreur(false);
      return;
    }
    const minuteur = window.setTimeout(() => {
      charger(etablissement.id, modules, visibles)
        .then((r) => actif && setD(r))
        .catch(() => actif && setErreur(true));
    }, 220);
    return () => {
      actif = false;
      window.clearTimeout(minuteur);
    };
  }, [etablissement.id, modules, preferencesChargees, visibles]);

  const presents = d?.presences?.filter((p) => p.etat !== "parti").length ?? null;
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const raccourcis = MODULES.filter((m) => m.module !== "dashboard" && modules.has(m.module)).slice(0, 6);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{date}</p>
          <h1>
            {salutation()} {compte.prenom ?? ""}
          </h1>
          <p>Voici l&apos;essentiel de {etablissement.nom} aujourd&apos;hui.</p>
        </div>
        <div className="dashboard-actions">
          <button className={`btn ${personnalisation ? "btn-on" : ""}`} onClick={() => setPersonnalisation((ouverte) => !ouverte)} aria-expanded={personnalisation}>
            <Icone nom="reglages" /> {personnalisation ? "Terminer" : "Personnaliser"}
          </button>
          {modules.has("pointeuse") && <Link className="btn btn-primary" href="/pointeuse"><Icone nom="horloge" /> Pointer</Link>}
        </div>
      </div>

      {personnalisation && (
        <section className="dashboard-customizer card" aria-label="Personnaliser le tableau de bord">
          <div className="dashboard-customizer-head">
            <div>
              <span className="dashboard-customizer-kicker">À TON IMAGE</span>
              <h2>Garde l’essentiel sous les yeux</h2>
              <p>Choisis les cartes utiles à ton quotidien. Tes préférences sont enregistrées pour cet établissement.</p>
            </div>
            <span className="dashboard-customizer-count">{visibles.size}<small> / {CARTES.length} cartes</small></span>
          </div>
          <div className="dashboard-presets" aria-label="Vues rapides">
            <button className="chip" onClick={() => setCartes([...CARTES_PAR_DEFAUT])}>Tout afficher</button>
            <button className="chip" onClick={() => setCartes([...VUE_ESSENTIELLE])}>Vue essentielle</button>
            <button className="chip" onClick={() => setCartes([])}>Tout masquer</button>
            <span className={`dashboard-save dashboard-save-${sauvegarde}`} aria-live="polite">
              {sauvegarde === "en-cours" ? "Enregistrement…" : sauvegarde === "ok" ? "✓ Enregistré" : sauvegarde === "erreur" ? "Enregistrement impossible" : ""}
            </span>
          </div>
          <div className="dashboard-card-options">
            {CARTES.map((carte) => {
              const active = visibles.has(carte.id);
              return (
                <button key={carte.id} className={`dashboard-card-option ${active ? "selected" : ""}`} onClick={() => basculerCarte(carte.id)} aria-pressed={active}>
                  <span className={`chip-ic ${carte.couleur}`}><Icone nom={carte.icon} /></span>
                  <span className="dashboard-card-option-text"><b>{carte.label}</b><small>{carte.detail}</small></span>
                  <span className={`dashboard-switch ${active ? "on" : ""}`} aria-hidden="true"><i /></span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {compte.role === "directeur" && <MiseEnRoute etablissementId={etablissement.id} />}

      {erreur && <div className="error" style={{ marginBottom: 14 }}>Impossible de charger les données. Vérifie ta connexion puis recharge la page.</div>}

      {CARTES.slice(0, 4).some((carte) => visibles.has(carte.id)) && <div className="grid-stats">
        {visibles.has("presence") && <Stat
          label="Présents"
          icon="horloge"
          ton="t-mint"
          href="/pointeuse"
          valeur={d ? (d.presences ? presents : "—") : null}
          unite={d?.prevus ? `/ ${d.prevus.length} prévus` : undefined}
          pied={d?.presences ? (d.presences.length ? `${d.presences.length} pointé(s) aujourd'hui` : "Personne n'a pointé") : "Pointage non accessible"}
        />}
        {visibles.has("stock-stat") && <Stat
          label="Stock critique"
          icon="stock"
          ton="t-peach"
          href="/inventaire"
          valeur={d ? (d.critiques ? d.critiques.length : "—") : null}
          unite={d?.critiques ? "produits" : undefined}
          pied={d?.inventaireVide ? "Aucun inventaire saisi" : "Sous le seuil d'alerte"}
        />}
        {visibles.has("pertes") && <Stat
          label="Pertes · 7 jours"
          icon="baisse"
          ton="t-red"
          href="/perte"
          valeur={d ? (d.pertes7j ? euros(d.pertes7j.euros) : "—") : null}
          pied={d?.pertes7j ? `${d.pertes7j.nb} déclaration(s)` : "Pertes non accessibles"}
        />}
        {visibles.has("commandes-stat") && <Stat
          label="À commander"
          icon="camion"
          ton="t-lav"
          href="/aide-commande"
          valeur={d ? (d.aCommander ?? "—") : null}
          unite={d?.aCommander != null ? "produits" : undefined}
          pied={d?.congesEnAttente ? `${d.congesEnAttente} demande(s) RH en attente` : "Dans la liste de commande"}
        />}
      </div>}

      {(visibles.has("equipe") || visibles.has("stock")) && <div className="grid-2">
        {visibles.has("equipe") && <section className="card dashboard-widget">
          <div className="card-head">
            <h2>Équipe du jour</h2>
            <Link href={modules.has("pointeuse") ? "/pointeuse" : "/planning"}>Voir le détail →</Link>
          </div>
          {!d ? (
            <Lignes />
          ) : (
            <EquipeDuJour d={d} />
          )}
        </section>}

        {visibles.has("stock") && <section className="card dashboard-widget">
          <div className="card-head">
            <h2>Stock à surveiller</h2>
            <Link href="/inventaire">Inventaire →</Link>
          </div>
          {!d ? (
            <Lignes />
          ) : !d.critiques ? (
            <div className="empty">Le stock n&apos;est pas accessible avec ton niveau d&apos;accès.</div>
          ) : d.inventaireVide ? (
            <div className="empty">
              <b>Aucun inventaire pour l&apos;instant</b>
              Les alertes apparaîtront après le premier relevé de stock.
            </div>
          ) : !d.critiques.length ? (
            <div className="empty">
              <b>Tout est au-dessus du seuil</b>
              Rien à signaler.
            </div>
          ) : (
            <div className="rows">
              {d.critiques.slice(0, 6).map((p) => (
                <div key={p.id} className="row">
                  <span className="chip-ic t-peach"><Icone nom="alerte" /></span>
                  <span className="main-txt">
                    <b>{p.nom}</b>
                    <small>
                      Seuil {p.seuil} {p.unite}
                    </small>
                  </span>
                  <span className="pill t-red">
                    {p.stock} {p.unite}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>}
      </div>}

      {(visibles.has("evenements") || visibles.has("commandes") || visibles.has("raccourcis")) && <div className="grid-3">
        {visibles.has("evenements") && <section className="card dashboard-widget">
          <div className="card-head">
            <h2>Événements à venir</h2>
            <Link href="/evenements">Tous →</Link>
          </div>
          {!d ? (
            <Lignes />
          ) : !d.evenements?.length ? (
            <div className="empty">
              <b>Aucun événement prévu</b>
              Ajoute les concerts, matchs et marchés qui changent l&apos;affluence.
            </div>
          ) : (
            <div className="rows">
              {d.evenements.map((e) => (
                <div key={e.id} className="row">
                  <span className={`chip-ic ${e.sens === "baisse" ? "t-blue" : "t-yellow"}`}><Icone nom={e.sens === "baisse" ? "baisse" : "hausse"} /></span>
                  <span className="main-txt">
                    <b>{e.nom}</b>
                    <small>
                      {new Date(e.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                      {e.lieu ? ` · ${e.lieu}` : ""}
                    </small>
                  </span>
                  {e.impact && <span className="pill t-lav">{e.impact}</span>}
                </div>
              ))}
            </div>
          )}
        </section>}

        {visibles.has("commandes") && <section className="card dashboard-widget">
          <div className="card-head">
            <h2>Dernières commandes</h2>
            <Link href="/aide-commande">Commandes →</Link>
          </div>
          {!d ? (
            <Lignes />
          ) : !d.commandes ? (
            <div className="empty">Commandes non accessibles.</div>
          ) : !d.commandes.length ? (
            <div className="empty">
              <b>Aucune commande envoyée</b>
            </div>
          ) : (
            <div className="rows">
              {d.commandes.map((c) => (
                <div key={c.id} className="row">
                  <span className="chip-ic t-lav"><Icone nom="camion" /></span>
                  <span className="main-txt">
                    <b>{c.fournisseur_nom}</b>
                    <small>{new Date(c.envoyee_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                  </span>
                  <span className="right">{Array.isArray(c.lignes) ? c.lignes.length : 0} lignes</span>
                </div>
              ))}
            </div>
          )}
        </section>}

        {visibles.has("raccourcis") && <section className="card dashboard-widget">
          <div className="card-head">
            <h2>Raccourcis</h2>
          </div>
          <div className="shortcuts">
            {raccourcis.map((m) => (
              <Link key={m.href} href={m.href} className="shortcut">
                <span className="chip-ic t-lav"><Icone nom={m.icon} /></span>
                <span>
                  {m.label}
                  <small>{m.sub}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>}
      </div>}
      {preferencesChargees && cartes.length === 0 && <section className="dashboard-empty card">
        <Icone nom="tableau" taille={30} /><h2>Ton tableau, ta page blanche</h2>
        <p>Réactive les cartes dont tu as besoin pour retrouver tes repères.</p>
        <button className="btn btn-primary" onClick={() => setCartes([...VUE_ESSENTIELLE])}>Afficher la vue essentielle</button>
      </section>}
    </>
  );
}

function EquipeDuJour({ d }: { d: Donnees }) {
  if (!d.presences && !d.prevus?.length) {
    return <div className="empty">Aucun planning ni pointage aujourd&apos;hui.</div>;
  }
  if (d.presences && d.presences.length) {
    const libelle = { present: ["Présent", "t-mint"], pause: ["En pause", "t-yellow"], parti: ["Parti", "t-blue"] } as const;
    return (
      <div className="rows">
        {d.presences.map((p) => (
          <div key={p.compte.id} className="row">
            <span className="avatar">{p.compte.avatar_url ? <img src={p.compte.avatar_url} alt="" /> : initiales(p.compte)}</span>
            <span className="main-txt">
              <b>{nomComplet(p.compte)}</b>
              <small>{p.compte.poste ?? "—"}</small>
            </span>
            <span className={`pill ${libelle[p.etat][1]}`}>
              {libelle[p.etat][0]} · {heure(p.depuis)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="empty">
      <b>Personne n&apos;a encore pointé aujourd&apos;hui</b>
      {d.prevus?.length
        ? `${d.prevus.length} personne(s) prévue(s) au planning, première prise de poste à ${hhmm(
            [...d.prevus].sort((a, b) => (a.heure_debut ?? "").localeCompare(b.heure_debut ?? ""))[0].heure_debut,
          )}.`
        : "Aucun créneau prévu au planning."}
    </div>
  );
}

function Lignes() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton" style={{ height: 34 }} />
      ))}
    </div>
  );
}
