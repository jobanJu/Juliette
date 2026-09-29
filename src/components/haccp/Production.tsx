"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { depuisIso, iso } from "@/lib/planning";
import { CONSERVATIONS, etapeRefroidissementConforme, formatTemp, numeroLot, PROCEDES_REFROIDISSEMENT, REFROID_DUREE_MAX_MIN, REFROID_TEMP_FIN, rendement } from "@/lib/haccp";
import type { Enregistrement, Etape, LigneProduction, Production as Fiche } from "@/lib/haccp";
import type { Ingredient } from "@/lib/fiches";
import PhotoHaccp, { envoyerPhoto } from "@/components/haccp/Photo";
import Camera from "@/components/Camera";

type Props = {
  etablissementId: string;
  compteId: string;
  initiales: string;
  etablissementNom: string;
  liste: Enregistrement<Fiche>[];
  historique: boolean;
  onSaved: (message: string) => void;
};

type Recette = { id: string; nom: string; ingredients: Ingredient[] };

const heure = (at?: string) => (at ? new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—");

/** Applique une heure « HH:MM » au jour de la fiche. */
function aHeure(jour: string, hhmm: string) {
  if (!hhmm) return undefined;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(jour);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const versHHMM = (at?: string) => (at ? new Date(at).toTimeString().slice(0, 5) : "");
const nombre = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));

// Suivi de production (maquette p. 5) : une fiche de fabrication par préparation. Elle se remplit au
// fil de la journée (ingrédients et lots, cuisson, refroidissement, conservation) puis se clôture ;
// clôturée, elle rejoint l'historique et s'imprime (ou s'enregistre en PDF) fiche par fiche.
export default function Production(p: Props) {
  const sb = getSupabaseClient()!;
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [choix, setChoix] = useState("");
  const [libre, setLibre] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [vue, setVue] = useState<"en-cours" | "historique">("en-cours");
  const [imprime, setImprime] = useState<string | null>(null);

  useEffect(() => {
    sb.from("fiches_techniques")
      .select("id, nom, ingredients")
      .eq("etablissement_id", p.etablissementId)
      .order("nom")
      .then(({ data }) => setRecettes((data ?? []) as Recette[]));
  }, [sb, p.etablissementId]);

  useEffect(() => {
    if (!imprime) return;
    const fin = () => setImprime(null);
    window.addEventListener("afterprint", fin);
    const t = setTimeout(() => window.print(), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", fin);
    };
  }, [imprime]);

  const enCours = p.liste.filter((e) => !e.data.cloture_at).slice().reverse();
  const closes = p.liste.filter((e) => e.data.cloture_at).slice().reverse();

  async function creer() {
    const r = recettes.find((x) => x.id === choix);
    const nom = r?.nom ?? libre.trim();
    if (!nom) return;
    setEnvoi(true);
    const data: Fiche = {
      fiche_id: r?.id,
      recette: nom,
      lot: numeroLot(p.initiales),
      unite: "kg",
      lignes: (r?.ingredients ?? []).filter((i) => i.name).map((i) => ({ produit: i.name, quantite: i.qty ? `${i.qty} ${i.unit}` : "", lot: "", dlc: "" })),
      cuisson: {},
      refroidissement: {},
    };
    if (!data.lignes.length) data.lignes = [{ produit: "", quantite: "", lot: "", dlc: "" }];
    const { error } = await sb.from("haccp_enregistrements").insert({ etablissement_id: p.etablissementId, compte_id: p.compteId, type: "production", data });
    setEnvoi(false);
    setChoix("");
    setLibre("");
    p.onSaved(error ? "Création refusée" : `Fiche « ${nom} » ouverte`);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card print-hide">
        <div className="prod-nouvelle">
          <div className="field" style={{ flex: "1 1 240px" }}>
            <label htmlFor="prod-recette">Sélectionner une recette</label>
            <select id="prod-recette" value={choix} onChange={(e) => setChoix(e.target.value)}>
              <option value="">— Préparation hors fiche technique —</option>
              {recettes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom}
                </option>
              ))}
            </select>
          </div>
          {!choix && (
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label htmlFor="prod-libre">Nom de la préparation</label>
              <input id="prod-libre" value={libre} onChange={(e) => setLibre(e.target.value)} placeholder="ex. Fond de veau" />
            </div>
          )}
          <button className="btn btn-primary" onClick={creer} disabled={envoi || (!choix && !libre.trim())} style={{ alignSelf: "end", minHeight: 44 }}>
            + Ouvrir une fiche de production
          </button>
        </div>
        <p className="hint" style={{ margin: "8px 0 0" }}>
          Les ingrédients de la fiche technique sont repris : il reste à noter lots, DLC et photos.
        </p>
      </section>

      <div className="week-nav print-hide">
        <div className="seg seg-inline" role="tablist">
          <button role="tab" aria-selected={vue === "en-cours"} className={vue === "en-cours" ? "on" : ""} onClick={() => setVue("en-cours")}>
            En cours ({enCours.length})
          </button>
          {p.historique && (
            <button role="tab" aria-selected={vue === "historique"} className={vue === "historique" ? "on" : ""} onClick={() => setVue("historique")}>
              Historique ({closes.length})
            </button>
          )}
        </div>
      </div>

      {vue === "en-cours" ? (
        !enCours.length ? (
          <section className="card empty">Aucune production en cours.</section>
        ) : (
          enCours.map((e) => <FicheProduction key={`${e.id}-${e.updated_at}`} e={e} {...p} imprime={imprime} onImprimer={setImprime} />)
        )
      ) : !closes.length ? (
        <section className="card empty">Aucune fiche clôturée sur les 90 derniers jours.</section>
      ) : (
        <>
          <section className={`card${imprime ? " print-hide" : ""}`} style={{ padding: "12px 6px 6px" }}>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Préparation</th>
                    <th>Lot</th>
                    <th>Refroidissement</th>
                    <th>Conservation</th>
                    <th>Auteur</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {closes.map((e) => {
                    const ok = etapeRefroidissementConforme(e.data.refroidissement);
                    return (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleDateString("fr-FR")}</td>
                        <td>
                          <b>{e.data.recette}</b>
                        </td>
                        <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>{e.data.lot}</td>
                        <td>{ok === null ? "—" : <span className={`pill ${ok ? "t-mint" : "t-red"}`}>{ok ? "Conforme" : "Non conforme"}</span>}</td>
                        <td>{e.data.conservation ? CONSERVATIONS[e.data.conservation]?.label : "—"}</td>
                        <td className="hint">{e.auteur}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn" style={{ height: 32 }} onClick={() => setImprime(e.id)}>
                            ⎙ Imprimer / PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {imprime && closes.some((e) => e.id === imprime) && <FicheImprimee e={closes.find((e) => e.id === imprime)!} etablissementNom={p.etablissementNom} />}
        </>
      )}
    </div>
  );
}

function FicheProduction({ e, etablissementId, etablissementNom, onSaved, imprime, onImprimer }: Props & { e: Enregistrement<Fiche>; imprime: string | null; onImprimer: (id: string) => void }) {
  const sb = getSupabaseClient()!;
  const [f, setF] = useState<Fiche>(e.data);
  const [envoi, setEnvoi] = useState(false);
  const [photoEnvoi, setPhotoEnvoi] = useState<number | "fiche" | null>(null);
  const [camera, setCamera] = useState<number | "fiche" | null>(null);
  const modifie = JSON.stringify(f) !== JSON.stringify(e.data);

  const maj = (c: Partial<Fiche>) => setF((x) => ({ ...x, ...c }));
  const majLigne = (i: number, c: Partial<LigneProduction>) => setF((x) => ({ ...x, lignes: x.lignes.map((l, j) => (j === i ? { ...l, ...c } : l)) }));
  const majEtape = (k: "cuisson" | "refroidissement", c: Partial<Etape & { procede?: string }>) => setF((x) => ({ ...x, [k]: { ...x[k], ...c } }));

  async function sauver(donnees: Fiche, message: string) {
    setEnvoi(true);
    const { error } = await sb.from("haccp_enregistrements").update({ data: donnees }).eq("id", e.id);
    setEnvoi(false);
    onSaved(error ? "Enregistrement refusé" : message);
  }

  async function photo(cible: number | "fiche", fichier: File) {
    setCamera(null);
    setPhotoEnvoi(cible);
    try {
      const chemin = await envoyerPhoto(etablissementId, "production", fichier);
      const suite = cible === "fiche" ? { ...f, photo: chemin } : { ...f, lignes: f.lignes.map((l, j) => (j === cible ? { ...l, photo: chemin } : l)) };
      setF(suite);
      await sauver(suite, "Photo ajoutée");
    } catch {
      onSaved("Envoi de la photo impossible");
    }
    setPhotoEnvoi(null);
  }

  const refroidOk = etapeRefroidissementConforme(f.refroidissement);
  const rdt = rendement(f);
  const conservation = f.conservation ? CONSERVATIONS[f.conservation] : null;
  const jour = e.created_at;

  function cloturer() {
    const manque = [!f.cuisson.fin_at && "fin de cuisson", f.refroidissement.procede !== PROCEDES_REFROIDISSEMENT[3] && !f.refroidissement.fin_at && "fin du refroidissement", !f.conservation && "type de conservation"].filter(Boolean);
    if (manque.length && !confirm(`Il manque : ${manque.join(", ")}. Clôturer quand même ?`)) return;
    sauver({ ...f, cloture_at: new Date().toISOString() }, `Fiche « ${f.recette} » clôturée`);
  }

  if (imprime === e.id) return <FicheImprimee e={{ ...e, data: f }} etablissementNom={etablissementNom} />;

  return (
    <section className={`card prod-fiche${imprime ? " print-hide" : ""}`}>
      <div className="card-head">
        <h2>
          {f.recette} <span className="hint">· lot {f.lot}</span>
        </h2>
        <span className="hint">
          Ouverte par {e.auteur.split(" ")[0]} à {heure(e.created_at)}
        </span>
      </div>

      <div className="table-wrap">
        <table className="data prod-lignes">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
              <th>N° de lot</th>
              <th>DLC</th>
              <th>Photo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {f.lignes.map((l, i) => (
              <tr key={i}>
                <td>
                  <input className="select-sm" value={l.produit} onChange={(x) => majLigne(i, { produit: x.target.value })} aria-label="Produit" placeholder="Produit" />
                </td>
                <td>
                  <input className="select-sm" value={l.quantite} onChange={(x) => majLigne(i, { quantite: x.target.value })} aria-label="Quantité" style={{ width: 96 }} />
                </td>
                <td>
                  <input className="select-sm" value={l.lot} onChange={(x) => majLigne(i, { lot: x.target.value })} aria-label="Numéro de lot" style={{ width: 120 }} />
                </td>
                <td>
                  <input className="select-sm" type="date" value={l.dlc} onChange={(x) => majLigne(i, { dlc: x.target.value })} aria-label="DLC" />
                </td>
                <td>
                  {l.photo ? (
                    <PhotoHaccp chemin={l.photo} className="prod-vignette" alt={l.produit} />
                  ) : (
                    <button className="prod-photo-btn" title="Photographier l'étiquette" onClick={() => setCamera(i)} disabled={photoEnvoi !== null}>
                      {photoEnvoi === i ? "…" : "📷"}
                    </button>
                  )}
                </td>
                <td>
                  <button className="icon-btn" onClick={() => setF((x) => ({ ...x, lignes: x.lignes.filter((_, j) => j !== i) }))} aria-label="Retirer la ligne">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn" style={{ justifySelf: "start" }} onClick={() => maj({ lignes: [...f.lignes, { produit: "", quantite: "", lot: "", dlc: "" }] })}>
        + Ajouter un produit
      </button>

      <div className="prod-etapes">
        <BlocEtape titre="Cuisson" etape={f.cuisson} jour={jour} onChange={(c) => majEtape("cuisson", c)} />
        <BlocEtape titre="Refroidissement" etape={f.refroidissement} jour={jour} onChange={(c) => majEtape("refroidissement", c)} note={`≤ ${formatTemp(REFROID_TEMP_FIN)} à cœur en ${REFROID_DUREE_MAX_MIN / 60} h max`}>
          <div className="field">
            <label>Procédé de refroidissement</label>
            <select value={f.refroidissement.procede ?? ""} onChange={(x) => majEtape("refroidissement", { procede: x.target.value || undefined })}>
              <option value="">—</option>
              {PROCEDES_REFROIDISSEMENT.map((pr) => (
                <option key={pr}>{pr}</option>
              ))}
            </select>
          </div>
          {refroidOk !== null && <span className={`pill ${refroidOk ? "t-mint" : "t-red"}`}>{refroidOk ? "Refroidissement conforme" : "Refroidissement non conforme"}</span>}
        </BlocEtape>
        <div className="prod-etape">
          <b>Conservation & volumes</b>
          <div className="field">
            <label>Type de conservation</label>
            <select value={f.conservation ?? ""} onChange={(x) => maj({ conservation: x.target.value || undefined })}>
              <option value="">—</option>
              {Object.entries(CONSERVATIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          {conservation?.champs.map((c) => (
            <div key={c.cle} className="field">
              <label>{c.label}</label>
              <input type={c.type} inputMode={c.type === "number" ? "decimal" : undefined} value={f.conservation_detail?.[c.cle] ?? ""} onChange={(x) => maj({ conservation_detail: { ...f.conservation_detail, [c.cle]: x.target.value } })} />
            </div>
          ))}
          <div className="form-2">
            <div className="field">
              <label>Volume cru ({f.unite})</label>
              <input inputMode="decimal" value={f.volume_cru ?? ""} onChange={(x) => maj({ volume_cru: nombre(x.target.value) })} />
            </div>
            <div className="field">
              <label>Volume cuit ({f.unite})</label>
              <input inputMode="decimal" value={f.volume_cuit ?? ""} onChange={(x) => maj({ volume_cuit: nombre(x.target.value) })} />
            </div>
          </div>
          {rdt !== null && <span className="hint">Rendement cuisson : {rdt} %</span>}
          <div className="field">
            <label>DLC de la préparation</label>
            <input type="date" value={f.dlc ?? ""} onChange={(x) => maj({ dlc: x.target.value || undefined })} />
          </div>
        </div>
      </div>

      <div className="field">
        <label>Remarque</label>
        <input value={f.remarque ?? ""} onChange={(x) => maj({ remarque: x.target.value || undefined })} placeholder="Action corrective, incident…" />
      </div>

      {camera !== null && (
        <Camera
          titre={camera === "fiche" ? `Photo : ${f.recette}` : `Étiquette : ${f.lignes[camera]?.produit || "produit"}`}
          onCapture={(fichier) => photo(camera, fichier)}
          onClose={() => setCamera(null)}
        />
      )}

      <div className="prod-actions">
        <button className="btn" title="Photo de la préparation" onClick={() => setCamera("fiche")} disabled={photoEnvoi !== null}>
          {photoEnvoi === "fiche" ? "Envoi…" : f.photo ? "📷 Changer la photo" : "📷 Photo de la préparation"}
        </button>
        {f.photo && <PhotoHaccp chemin={f.photo} className="prod-vignette" alt={f.recette} />}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => onImprimer(e.id)}>
          ⎙ Imprimer
        </button>
        <button className="btn" onClick={() => sauver(f, "Fiche enregistrée")} disabled={envoi || !modifie}>
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="btn btn-primary" onClick={cloturer} disabled={envoi}>
          Clôturer la fiche
        </button>
      </div>
    </section>
  );
}

function BlocEtape({ titre, etape, jour, note, onChange, children }: { titre: string; etape: Etape; jour: string; note?: string; onChange: (c: Partial<Etape>) => void; children?: ReactNode }) {
  const maintenant = () => new Date().toISOString();
  return (
    <div className="prod-etape">
      <b>
        {titre} {note && <span className="hint">· {note}</span>}
      </b>
      {(["debut", "fin"] as const).map((k) => (
        <div key={k} className="form-2">
          <div className="field">
            <label>Heure {k === "debut" ? "début" : "fin"}</label>
            <span style={{ display: "flex", gap: 6 }}>
              <input type="time" value={versHHMM(etape[`${k}_at`])} onChange={(x) => onChange({ [`${k}_at`]: aHeure(jour, x.target.value) })} style={{ flex: 1 }} />
              <button className="btn" onClick={() => onChange({ [`${k}_at`]: maintenant() })} title="Maintenant" aria-label={`Heure de ${k === "debut" ? "début" : "fin"} : maintenant`}>
                ⏱
              </button>
            </span>
          </div>
          <div className="field">
            <label>Température {k === "debut" ? "début" : "fin"} (°C)</label>
            <input inputMode="decimal" value={etape[`temp_${k}`] ?? ""} onChange={(x) => onChange({ [`temp_${k}`]: nombre(x.target.value) })} />
          </div>
        </div>
      ))}
      {children}
    </div>
  );
}

function FicheImprimee({ e, etablissementNom }: { e: Enregistrement<Fiche>; etablissementNom: string }) {
  const f = e.data;
  const ok = etapeRefroidissementConforme(f.refroidissement);
  const conservation = f.conservation ? CONSERVATIONS[f.conservation] : null;
  const ligne = (t: Etape) => `${heure(t.debut_at)} ${t.temp_debut != null ? `(${formatTemp(t.temp_debut)})` : ""} → ${heure(t.fin_at)} ${t.temp_fin != null ? `(${formatTemp(t.temp_fin)})` : ""}`;
  const date = useMemo(() => new Date(e.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [e.created_at]);
  return (
    <section className="card prod-imprimee">
      <div className="card-head">
        <h2>Fiche de production · {f.recette}</h2>
        <span className="hint">{etablissementNom}</span>
      </div>
      <p>
        <b>Date :</b> {date} · <b>Lot :</b> {f.lot} · <b>Par :</b> {e.auteur}
        {f.cloture_at && ` · clôturée à ${heure(f.cloture_at)}`}
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Lot</th>
            <th>DLC</th>
          </tr>
        </thead>
        <tbody>
          {f.lignes.map((l, i) => (
            <tr key={i}>
              <td>{l.produit}</td>
              <td>{l.quantite}</td>
              <td>{l.lot || "—"}</td>
              <td>{l.dlc ? depuisIso(l.dlc).toLocaleDateString("fr-FR") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <b>Cuisson :</b> {ligne(f.cuisson)}
        <br />
        <b>Refroidissement :</b> {ligne(f.refroidissement)} {f.refroidissement.procede ? `· ${f.refroidissement.procede}` : ""} {ok !== null && `· ${ok ? "conforme" : "NON CONFORME"}`}
        <br />
        <b>Conservation :</b> {conservation?.label ?? "—"}
        {conservation?.champs.map((c) => (f.conservation_detail?.[c.cle] ? ` · ${c.label} : ${f.conservation_detail[c.cle]}` : ""))}
        <br />
        <b>Volumes :</b> cru {f.volume_cru ?? "—"} {f.unite} · cuit {f.volume_cuit ?? "—"} {f.unite}
        {rendement(f) !== null && ` · rendement ${rendement(f)} %`}
        <br />
        <b>DLC préparation :</b> {f.dlc ? depuisIso(f.dlc).toLocaleDateString("fr-FR") : "—"}
        {f.remarque && (
          <>
            <br />
            <b>Remarque :</b> {f.remarque}
          </>
        )}
      </p>
      <div className="prod-photos">
        {f.photo && <PhotoHaccp chemin={f.photo} className="prod-photo-print" alt={f.recette} />}
        {f.lignes.filter((l) => l.photo).map((l, i) => (
          <PhotoHaccp key={i} chemin={l.photo!} className="prod-photo-print" alt={l.produit} />
        ))}
      </div>
      <p className="hint">Imprimé le {iso(new Date())} depuis Juliette.</p>
    </section>
  );
}
