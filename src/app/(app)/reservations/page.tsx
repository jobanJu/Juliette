"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConnecte } from "@/lib/session";
import { ajouterJours, depuisIso, iso, JOURS_COURTS, lundi } from "@/lib/planning";
import { BRIEFING, COLONNES_RESA, service, STATUT_RESA } from "@/lib/salle";
import type { NoteBriefing, Reservation, TableSalle } from "@/lib/salle";
import Modal from "@/components/Modal";

const HEURES = { midi: ["11:45", "12:00", "12:15", "12:30", "12:45", "13:00", "13:30"], soir: ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"] };
/** Durée d'occupation d'une table par une réservation, pour proposer les tables libres. */
const DUREE_TABLE_MIN = 105;

export default function Reservations() {
  const { compte, etablissement } = useConnecte();
  const gestion = compte.role === "directeur" || compte.role === "responsable";
  const sb = getSupabaseClient()!;

  const [jour, setJour] = useState(() => iso(new Date()));
  const [resas, setResas] = useState<Reservation[] | null>(null);
  const [semaine, setSemaine] = useState<{ date: string; heure: string; couverts: number; statut: string }[]>([]);
  const [tables, setTables] = useState<TableSalle[]>([]);
  const [notes, setNotes] = useState<NoteBriefing[]>([]);
  const [edition, setEdition] = useState<Reservation | "nouvelle" | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  const lundiSemaine = lundi(depuisIso(jour));

  useEffect(() => {
    let vivant = true;
    Promise.all([
      sb.from("reservations").select(COLONNES_RESA).eq("etablissement_id", etablissement.id).eq("date", jour).order("heure"),
      sb.from("reservations").select("date, heure, couverts, statut").eq("etablissement_id", etablissement.id).gte("date", lundiSemaine).lte("date", ajouterJours(lundiSemaine, 6)),
      sb.from("tables_salle").select("id, nom, couverts_max, ordre, active").eq("etablissement_id", etablissement.id).eq("active", true).order("ordre").order("nom"),
      sb.from("briefing_notes").select("id, date, categorie, libelle, restant, note").eq("etablissement_id", etablissement.id).eq("date", jour),
    ]).then(([r, s, t, n]) => {
      if (!vivant) return;
      setResas((r.data ?? []) as Reservation[]);
      setSemaine(s.data ?? []);
      setTables((t.data ?? []) as TableSalle[]);
      setNotes((n.data ?? []) as NoteBriefing[]);
    });
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, jour, lundiSemaine, version]);

  useEffect(() => {
    const canal = sb
      .channel(`resas-${etablissement.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `etablissement_id=eq.${etablissement.id}` }, () => recharger())
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  }, [sb, etablissement.id, recharger]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const capacite = tables.reduce((s, t) => s + t.couverts_max, 0);
  const actives = (resas ?? []).filter((r) => r.statut !== "annulee" && r.statut !== "no_show");
  const parService = (s: "midi" | "soir") => actives.filter((r) => service(r.heure.slice(0, 5)) === s);

  async function statut(r: Reservation, s: Reservation["statut"]) {
    const { error } = await sb.from("reservations").update({ statut: s }).eq("id", r.id);
    setToast(error ? "Modification refusée" : `${r.nom} : ${STATUT_RESA[s].label.toLowerCase()}`);
    recharger();
  }

  const aujourdhui = iso(new Date());

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Salle</p>
          <h1>Réservations</h1>
          <p>Le carnet de réservations et le briefing du service.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdition("nouvelle")}>
          + Réservation
        </button>
      </div>

      <div className="week-strip">
        <button className="btn" onClick={() => setJour(ajouterJours(jour, -7))} aria-label="Semaine précédente">
          ←
        </button>
        {Array.from({ length: 7 }, (_, i) => ajouterJours(lundiSemaine, i)).map((d, i) => {
          const du = semaine.filter((r) => r.date === d && r.statut !== "annulee" && r.statut !== "no_show");
          const midi = du.filter((r) => service(r.heure.slice(0, 5)) === "midi").reduce((s, r) => s + r.couverts, 0);
          const soir = du.filter((r) => service(r.heure.slice(0, 5)) === "soir").reduce((s, r) => s + r.couverts, 0);
          return (
            <button key={d} className={`day${d === jour ? " on" : ""}${d === aujourdhui ? " today" : ""}`} onClick={() => setJour(d)}>
              <small>{JOURS_COURTS[i]}</small>
              <b>{depuisIso(d).getDate()}</b>
              <span>{midi || soir ? `${midi} · ${soir}` : "—"}</span>
            </button>
          );
        })}
        <button className="btn" onClick={() => setJour(ajouterJours(jour, 7))} aria-label="Semaine suivante">
          →
        </button>
        <input type="date" className="select-sm" value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} aria-label="Choisir une date" />
      </div>
      <p className="hint" style={{ margin: "-4px 0 14px" }}>
        Couverts réservés midi · soir. {capacite ? `Capacité de la salle : ${capacite} places.` : ""}
      </p>

      {!resas ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      ) : (
        <div className="resa-grid">
          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            {(["midi", "soir"] as const).map((s) => {
              const liste = (resas ?? []).filter((r) => service(r.heure.slice(0, 5)) === s);
              const couverts = parService(s).reduce((t, r) => t + r.couverts, 0);
              const taux = capacite ? Math.min(100, (couverts / capacite) * 100) : 0;
              return (
                <section key={s} className="card">
                  <div className="card-head">
                    <h2>
                      Service du {s} <span className="hint">· {couverts} couvert(s)</span>
                    </h2>
                    {capacite > 0 && <span className={`pill ${taux >= 90 ? "t-red" : taux >= 70 ? "t-yellow" : "t-mint"}`}>{Math.round(taux)} % de la salle</span>}
                  </div>
                  {capacite > 0 && (
                    <span className="bar" style={{ height: 6, marginBottom: 10 }}>
                      <i style={{ width: `${taux}%`, background: taux >= 90 ? "var(--red-ink)" : "var(--purple)" }} />
                    </span>
                  )}
                  {!liste.length ? (
                    <div className="empty">Aucune réservation.</div>
                  ) : (
                    <div className="rows">
                      {liste.map((r) => {
                        const t = tables.find((x) => x.id === r.table_id);
                        const barre = r.statut === "annulee" || r.statut === "no_show";
                        return (
                          <div key={r.id} className={`row resa-row${barre ? " barre" : ""}`}>
                            <span className="resa-heure">{r.heure.slice(0, 5)}</span>
                            <button className="main-txt resa-main" onClick={() => setEdition(r)}>
                              <b>
                                {r.nom} · {r.couverts} pers.
                              </b>
                              <small>{[t ? `table ${t.nom}` : "table à attribuer", r.telephone, r.note].filter(Boolean).join(" · ")}</small>
                            </button>
                            {r.statut === "confirmee" ? (
                              <span className="resa-actions">
                                <button className="btn" style={{ height: 30 }} onClick={() => statut(r, "arrivee")}>
                                  Arrivé
                                </button>
                                <button className="btn btn-danger-ghost" style={{ height: 30 }} onClick={() => statut(r, "no_show")} title="Pas venu">
                                  No-show
                                </button>
                              </span>
                            ) : (
                              <button className={`pill ${STATUT_RESA[r.statut].ton}`} style={{ border: 0, cursor: "pointer" }} onClick={() => statut(r, "confirmee")} title="Revenir à « confirmée »">
                                {STATUT_RESA[r.statut].label}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <Briefing etablissementId={etablissement.id} compteId={compte.id} jour={jour} notes={notes} gestion={gestion} onChange={(m) => { if (m) setToast(m); recharger(); }} />
        </div>
      )}

      {edition && (
        <ModalReservation
          etablissementId={etablissement.id}
          compteId={compte.id}
          gestion={gestion}
          jour={jour}
          resa={edition === "nouvelle" ? undefined : edition}
          tables={tables}
          onClose={() => setEdition(null)}
          onSaved={(m, date) => {
            setEdition(null);
            setToast(m);
            if (date) setJour(date);
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

function Briefing({ etablissementId, compteId, jour, notes, gestion, onChange }: { etablissementId: string; compteId: string; jour: string; notes: NoteBriefing[]; gestion: boolean; onChange: (m?: string) => void }) {
  const [categorie, setCategorie] = useState<NoteBriefing["categorie"]>("a_pousser");
  const [libelle, setLibelle] = useState("");
  const [restant, setRestant] = useState("");
  const sb = getSupabaseClient()!;

  async function ajouter() {
    if (!libelle.trim()) return;
    const { error } = await sb.from("briefing_notes").insert({ etablissement_id: etablissementId, date: jour, categorie, libelle: libelle.trim(), restant: restant.trim() ? Number(restant) : null, created_by: compteId });
    if (error) return onChange("Ajout refusé : réservé aux responsables");
    setLibelle("");
    setRestant("");
    onChange();
  }

  async function retirer(id: string) {
    await sb.from("briefing_notes").delete().eq("id", id);
    onChange();
  }

  return (
    <section className="card" style={{ alignSelf: "start" }}>
      <div className="card-head">
        <h2>Briefing du service</h2>
      </div>
      {!notes.length ? (
        <p className="hint" style={{ margin: "0 0 10px" }}>
          {gestion ? "Ruptures, plats à pousser, quantités limitées : l'équipe de salle les voit ici." : "Rien de particulier pour ce service."}
        </p>
      ) : (
        <div className="rows" style={{ marginBottom: 10 }}>
          {notes.map((n) => (
            <div key={n.id} className="row">
              <span className={`pill ${BRIEFING[n.categorie].ton}`}>{BRIEFING[n.categorie].label}</span>
              <span className="main-txt">
                <b>{n.libelle}</b>
                {n.restant != null && <small>reste {n.restant}</small>}
              </span>
              {gestion && (
                <button className="icon-btn" onClick={() => retirer(n.id)} aria-label="Retirer">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {gestion && (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="chips">
            {(Object.keys(BRIEFING) as NoteBriefing["categorie"][]).map((c) => (
              <button key={c} className={`chip${categorie === c ? " on" : ""}`} onClick={() => setCategorie(c)}>
                {BRIEFING[c].label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="ticket-note" style={{ margin: 0, flex: 1 }} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. : Carbonade" onKeyDown={(e) => e.key === "Enter" && ajouter()} />
            {categorie === "quantite_limitee" && <input className="ticket-note" style={{ margin: 0, width: 70 }} inputMode="numeric" value={restant} onChange={(e) => setRestant(e.target.value)} placeholder="reste" />}
            <button className="btn" onClick={ajouter}>
              Ajouter
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ModalReservation({ etablissementId, compteId, gestion, jour, resa, tables, onClose, onSaved }: { etablissementId: string; compteId: string; gestion: boolean; jour: string; resa?: Reservation; tables: TableSalle[]; onClose: () => void; onSaved: (m: string, date?: string) => void }) {
  const [nom, setNom] = useState(resa?.nom ?? "");
  const [telephone, setTelephone] = useState(resa?.telephone ?? "");
  const [date, setDate] = useState(resa?.date ?? jour);
  const [heure, setHeure] = useState(resa?.heure.slice(0, 5) ?? "20:00");
  const [couverts, setCouverts] = useState(String(resa?.couverts ?? 2));
  const [tableId, setTableId] = useState(resa?.table_id ?? "");
  const [note, setNote] = useState(resa?.note ?? "");
  const [source, setSource] = useState<Reservation["source"]>(resa?.source ?? "telephone");
  const [autres, setAutres] = useState<{ id: string; heure: string; table_id: string | null }[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const sb = getSupabaseClient()!;

  // Réservations du même jour, pour savoir quelles tables sont libres à l'heure choisie.
  useEffect(() => {
    let vivant = true;
    sb.from("reservations")
      .select("id, heure, table_id")
      .eq("etablissement_id", etablissementId)
      .eq("date", date)
      .in("statut", ["confirmee", "arrivee"])
      .then(({ data }) => vivant && setAutres(data ?? []));
    return () => {
      vivant = false;
    };
  }, [sb, etablissementId, date]);

  const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const occupees = new Set(autres.filter((a) => a.id !== resa?.id && a.table_id && Math.abs(minutes(a.heure) - minutes(heure)) < DUREE_TABLE_MIN).map((a) => a.table_id!));
  const n = Number(couverts);
  const libres = tables.filter((t) => !occupees.has(t.id));
  const conseillees = libres.filter((t) => t.couverts_max >= n).sort((a, b) => a.couverts_max - b.couverts_max);

  async function enregistrer() {
    setErreur(null);
    if (!nom.trim()) return setErreur("Au nom de qui ?");
    if (!Number.isInteger(n) || n < 1 || n > 200) return setErreur("Nombre de personnes invalide.");
    if (!/^\d{2}:\d{2}$/.test(heure)) return setErreur("Heure invalide.");
    if (tableId && occupees.has(tableId)) return setErreur("Cette table est déjà réservée à cette heure-là.");
    setEnvoi(true);
    const ligne = { etablissement_id: etablissementId, nom: nom.trim(), telephone: telephone.trim() || null, date, heure, couverts: n, table_id: tableId || null, note: note.trim() || null, source };
    const { error } = resa ? await sb.from("reservations").update(ligne).eq("id", resa.id) : await sb.from("reservations").insert({ ...ligne, cree_par: compteId });
    setEnvoi(false);
    if (error) return setErreur("Enregistrement refusé.");
    onSaved(resa ? "Réservation modifiée" : `Réservation de ${ligne.nom} enregistrée`, date);
  }

  async function annuler() {
    const { error } = await sb.from("reservations").update({ statut: "annulee" }).eq("id", resa!.id);
    if (error) return setErreur("Annulation refusée.");
    onSaved("Réservation annulée");
  }

  async function supprimer() {
    const { error } = await sb.from("reservations").delete().eq("id", resa!.id);
    if (error) return setErreur("Suppression refusée.");
    onSaved("Réservation supprimée");
  }

  return (
    <Modal
      titre={resa ? `Réservation de ${resa.nom}` : "Nouvelle réservation"}
      onClose={onClose}
      pied={
        <>
          {resa && (
            <span style={{ marginRight: "auto", display: "flex", gap: 6 }}>
              {resa.statut !== "annulee" && (
                <button className="btn btn-danger-ghost" onClick={annuler}>
                  Annuler la résa
                </button>
              )}
              {gestion &&
                (!suppr ? (
                  <button className="btn btn-danger-ghost" onClick={() => setSuppr(true)} title="Supprimer définitivement">
                    🗑
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={supprimer}>
                    Supprimer
                  </button>
                ))}
            </span>
          )}
          <button className="btn" onClick={onClose} disabled={envoi}>
            Fermer
          </button>
          <button className="btn btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="form-2">
        <div className="field">
          <label htmlFor="r-nom">Nom *</label>
          <input id="r-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus={!resa} />
        </div>
        <div className="field">
          <label htmlFor="r-tel">Téléphone</label>
          <input id="r-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="r-date">Date</label>
          <input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="r-couv">Personnes</label>
          <input id="r-couv" inputMode="numeric" value={couverts} onChange={(e) => setCouverts(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Heure</label>
        <div className="chips">
          {[...HEURES.midi, ...HEURES.soir].map((h) => (
            <button key={h} className={`chip${heure === h ? " on" : ""}`} onClick={() => setHeure(h)}>
              {h}
            </button>
          ))}
          <input className="chip-input" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} aria-label="Autre heure" style={{ width: 100 }} />
        </div>
      </div>
      <div className="field">
        <label>Table {conseillees.length ? <span className="hint">· libres à {heure} pour {n || "?"} pers.</span> : null}</label>
        <div className="chips">
          <button className={`chip${!tableId ? " on" : ""}`} onClick={() => setTableId("")}>
            Plus tard
          </button>
          {tables.map((t) => {
            const prise = occupees.has(t.id);
            const conseillee = conseillees[0]?.id === t.id;
            return (
              <button key={t.id} className={`chip${tableId === t.id ? " on" : ""}${prise ? " chip-off" : ""}`} onClick={() => !prise && setTableId(t.id)} disabled={prise} title={prise ? "Déjà réservée à cette heure" : `${t.couverts_max} places`}>
                {t.nom} · {t.couverts_max}
                {conseillee ? " ★" : ""}
              </button>
            );
          })}
        </div>
        {!tables.length && <span className="hint">Aucune table créée (voir Commandes clients → Carte & tables).</span>}
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="r-note">Note</label>
          <input id="r-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anniversaire, allergie, chaise bébé…" />
        </div>
        <div className="field">
          <label htmlFor="r-src">Pris par</label>
          <select id="r-src" value={source} onChange={(e) => setSource(e.target.value as Reservation["source"])}>
            <option value="telephone">Téléphone</option>
            <option value="sur_place">Sur place</option>
            <option value="en_ligne">En ligne</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
