"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { initiales, nomComplet, useConnecte } from "@/lib/session";
import type { Compte } from "@/lib/session";
import { COLONNES_MESSAGE, heureMessage, jourMessage, lireLus, lirePieceJointe, marquerLu, morceauxTexte } from "@/lib/messagerie";
import type { Groupe, Membre, Message, PieceJointe } from "@/lib/messagerie";
import ModalGroupe from "@/components/messagerie/ModalGroupe";
import Modal from "@/components/Modal";
import Icone from "@/components/Icone";

const PAGE = 60;

export default function Messagerie() {
  const { compte, etablissement } = useConnecte();
  const sb = getSupabaseClient()!;
  const directeur = compte.role === "directeur";
  const gestion = directeur || compte.role === "responsable";

  const [equipe, setEquipe] = useState<Compte[]>([]);
  const [groupes, setGroupes] = useState<Groupe[] | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [recents, setRecents] = useState<Message[]>([]);
  const [lus, setLus] = useState<Record<string, string>>({});
  const [actif, setActif] = useState<string | null>(null);
  const [fil, setFil] = useState<Message[] | null>(null);
  const [plusAncien, setPlusAncien] = useState(false);
  const [texte, setTexte] = useState("");
  const [pieces, setPieces] = useState<PieceJointe[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modal, setModal] = useState<"groupe" | "gerer" | "direct" | null>(null);
  const [apercu, setApercu] = useState<PieceJointe | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const basRef = useRef<HTMLDivElement>(null);
  const filRef = useRef<HTMLDivElement>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const actifRef = useRef<string | null>(null);

  useEffect(() => {
    actifRef.current = actif;
  }, [actif]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  // Conversations, membres et derniers messages (pour les aperçus et les non-lus).
  useEffect(() => {
    let vivant = true;
    Promise.all([
      sb.from("comptes").select("id, etablissement_id, prenom, nom, email, role, statut, poste, avatar_url").eq("etablissement_id", etablissement.id),
      sb.from("message_groups").select("id, nom, est_direct, ouvert_a_tous, created_by, created_at").eq("etablissement_id", etablissement.id),
      sb.from("message_group_membres").select("group_id, compte_id, est_admin").eq("etablissement_id", etablissement.id),
      sb.from("messages").select(COLONNES_MESSAGE).eq("etablissement_id", etablissement.id).order("created_at", { ascending: false }).limit(400),
    ]).then(([e, g, m, r]) => {
      if (!vivant) return;
      setEquipe((e.data ?? []) as Compte[]);
      setGroupes((g.data ?? []) as Groupe[]);
      setMembres((m.data ?? []) as Membre[]);
      setRecents((r.data ?? []) as Message[]);
      setLus(lireLus(compte.id));
    });
    return () => {
      vivant = false;
    };
  }, [sb, etablissement.id, compte.id, version]);

  // Fil de la conversation ouverte.
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    sb.from("messages")
      .select(COLONNES_MESSAGE)
      .eq("group_id", actif)
      .order("created_at", { ascending: false })
      .limit(PAGE)
      .then(({ data }) => {
        if (!vivant) return;
        const l = ((data ?? []) as Message[]).reverse();
        setFil(l);
        setPlusAncien((data ?? []).length === PAGE);
        requestAnimationFrame(() => basRef.current?.scrollIntoView());
      });
    return () => {
      vivant = false;
    };
  }, [sb, actif]);

  // Temps réel : nouveaux messages et suppressions.
  useEffect(() => {
    const canal = sb
      .channel(`messages-${etablissement.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `etablissement_id=eq.${etablissement.id}` }, (payload) => {
        const m = payload.new as Message;
        setRecents((r) => (r.some((x) => x.id === m.id) ? r : [m, ...r]));
        if (m.group_id === actifRef.current) {
          const el = filRef.current;
          const enBas = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          setFil((f) => (f && !f.some((x) => x.id === m.id) ? [...f, m] : f));
          if (enBas) requestAnimationFrame(() => basRef.current?.scrollIntoView({ behavior: "smooth" }));
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (!id) return;
        setRecents((r) => r.filter((x) => x.id !== id));
        setFil((f) => (f ? f.filter((x) => x.id !== id) : f));
      })
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  }, [sb, etablissement.id]);

  // Conversation ouverte = lue.
  useEffect(() => {
    if (!actif || !fil?.length) return;
    marquerLu(compte.id, actif, fil[fil.length - 1].created_at);
  }, [actif, fil, compte.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const parId = useMemo(() => new Map(equipe.map((c) => [c.id, c])), [equipe]);

  const conversations = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (groupes ?? [])
      .map((g) => {
        const ids = membres.filter((m) => m.group_id === g.id).map((m) => m.compte_id);
        const autre = g.est_direct ? parId.get(ids.find((id) => id !== compte.id) ?? "") : undefined;
        const titre = g.est_direct ? (autre ? nomComplet(autre) : "Message privé") : g.nom;
        const msgs = recents.filter((m) => m.group_id === g.id);
        const dernier = msgs[0];
        // La conversation ouverte est lue au fil de l'eau ; les autres se comparent à la dernière lecture.
        const nonLus = g.id === actif ? 0 : msgs.filter((m) => m.compte_id !== compte.id && m.created_at > (lus[g.id] ?? "")).length;
        return { g, titre, autre, ids, dernier, nonLus };
      })
      .filter((c) => !q || c.titre.toLowerCase().includes(q))
      .sort((a, b) => Number(b.g.ouvert_a_tous) - Number(a.g.ouvert_a_tous) || (b.dernier?.created_at ?? b.g.created_at).localeCompare(a.dernier?.created_at ?? a.g.created_at));
  }, [groupes, membres, recents, lus, parId, compte.id, recherche, actif]);

  const courant = conversations.find((c) => c.g.id === actif) ?? (actif ? undefined : undefined);
  const membresCourant = membres.filter((m) => m.group_id === actif);
  const adminCourant = directeur || membresCourant.some((m) => m.compte_id === compte.id && m.est_admin) || courant?.g.created_by === compte.id;

  async function envoyer() {
    if (!actif || envoi || (!texte.trim() && !pieces.length)) return;
    setErreur(null);
    setEnvoi(true);
    const { data, error } = await sb
      .from("messages")
      .insert({ etablissement_id: etablissement.id, compte_id: compte.id, group_id: actif, texte: texte.trim(), attachments: pieces.length ? pieces : null })
      .select(COLONNES_MESSAGE)
      .single();
    setEnvoi(false);
    if (error || !data) return setErreur("Message non envoyé. Vérifie ta connexion puis réessaie.");
    const m = data as Message;
    setFil((f) => (f && !f.some((x) => x.id === m.id) ? [...f, m] : f));
    setRecents((r) => (r.some((x) => x.id === m.id) ? r : [m, ...r]));
    setTexte("");
    setPieces([]);
    requestAnimationFrame(() => basRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  async function supprimer(m: Message) {
    const { error } = await sb.from("messages").delete().eq("id", m.id);
    if (error) return setToast("Suppression refusée");
    setFil((f) => (f ? f.filter((x) => x.id !== m.id) : f));
    setRecents((r) => r.filter((x) => x.id !== m.id));
  }

  async function chargerPlus() {
    if (!actif || !fil?.length) return;
    const { data } = await sb.from("messages").select(COLONNES_MESSAGE).eq("group_id", actif).lt("created_at", fil[0].created_at).order("created_at", { ascending: false }).limit(PAGE);
    const anciens = ((data ?? []) as Message[]).reverse();
    setFil((f) => [...anciens, ...(f ?? [])]);
    setPlusAncien((data ?? []).length === PAGE);
  }

  async function ajouterFichiers(fichiers: FileList | File[]) {
    setErreur(null);
    for (const f of Array.from(fichiers).slice(0, 4 - pieces.length)) {
      try {
        const pj = await lirePieceJointe(f);
        setPieces((p) => [...p, pj]);
      } catch (e) {
        setErreur((e as Error).message);
      }
    }
  }

  async function ouvrirDirect(autreId: string) {
    setModal(null);
    // Conversation privée existante entre nous deux ?
    const existante = (groupes ?? []).find((g) => {
      if (!g.est_direct) return false;
      const ids = membres.filter((m) => m.group_id === g.id).map((m) => m.compte_id);
      return ids.length === 2 && ids.includes(compte.id) && ids.includes(autreId);
    });
    if (existante) return ouvrir(existante.id);
    const autre = parId.get(autreId);
    const { data, error } = await sb
      .from("message_groups")
      .insert({ etablissement_id: etablissement.id, nom: `${nomComplet(compte)} ↔ ${autre ? nomComplet(autre) : ""}`, est_direct: true, created_by: compte.id })
      .select("id")
      .single();
    if (error || !data) return setToast("Impossible de démarrer la conversation");
    const { error: e2 } = await sb.from("message_group_membres").insert([
      { etablissement_id: etablissement.id, group_id: data.id, compte_id: compte.id },
      { etablissement_id: etablissement.id, group_id: data.id, compte_id: autreId },
    ]);
    if (e2) return setToast("Impossible d'ajouter ce collègue à la conversation");
    recharger();
    ouvrir(data.id);
  }

  function ouvrir(id: string) {
    setLus(lireLus(compte.id));
    setFil(null);
    setErreur(null);
    setPieces([]);
    setActif(id);
  }

  function touche(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      envoyer();
    }
  }

  function coller(e: ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (images.length) {
      e.preventDefault();
      ajouterFichiers(images);
    }
  }

  const titreCourant = courant?.titre ?? "";
  const sousTitre = courant
    ? courant.g.ouvert_a_tous
      ? "Toute l'équipe"
      : courant.g.est_direct
        ? "Conversation privée"
        : `${courant.ids.length} membre${courant.ids.length > 1 ? "s" : ""}`
    : "";

  return (
    <>
      <div className={`chat card${actif ? " chat-open" : ""}`}>
        <aside className="chat-list">
          <div className="chat-list-head">
            <h1>Messagerie</h1>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="icon-btn" title="Nouveau message privé" aria-label="Nouveau message privé" onClick={() => setModal("direct")}>
                <Icone nom="modifier" taille={16} />
              </button>
              {directeur && (
                <button className="icon-btn" title="Nouveau groupe" aria-label="Nouveau groupe" onClick={() => setModal("groupe")}>
                  ＋
                </button>
              )}
            </span>
          </div>
          <label className="search" style={{ margin: "0 12px 8px" }}>
            <Icone nom="recherche" taille={15} />
            <input placeholder="Rechercher une conversation" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
          <div className="chat-convs">
            {!groupes ? (
              [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 52, margin: "4px 12px" }} />)
            ) : !conversations.length ? (
              <div className="empty">Aucune conversation.</div>
            ) : (
              conversations.map((c) => (
                <button key={c.g.id} className={`conv${c.g.id === actif ? " on" : ""}`} onClick={() => ouvrir(c.g.id)}>
                  <span className={`avatar conv-av${c.g.est_direct ? "" : " conv-group"}`}>
                    {c.g.est_direct ? c.autre?.avatar_url ? <img src={c.autre.avatar_url} alt="" /> : c.autre ? initiales(c.autre) : "?" : c.g.ouvert_a_tous ? "#" : c.titre[0]?.toUpperCase()}
                  </span>
                  <span className="conv-txt">
                    <span className="conv-top">
                      <b>{c.titre}</b>
                      {c.dernier && <small>{heureMessage(c.dernier.created_at)}</small>}
                    </span>
                    <span className="conv-bottom">
                      <small>
                        {c.dernier
                          ? `${c.dernier.compte_id === compte.id ? "Toi : " : c.g.est_direct ? "" : `${parId.get(c.dernier.compte_id)?.prenom ?? ""} : `}${c.dernier.texte || (c.dernier.attachments?.length ? "Pièce jointe" : "")}`
                          : "Aucun message"}
                      </small>
                      {c.nonLus > 0 && <i className="conv-badge">{c.nonLus > 99 ? "99+" : c.nonLus}</i>}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="chat-main">
          {!actif || !courant ? (
            <div className="chat-empty">
              <span className="chip-ic t-lav" style={{ width: 52, height: 52, fontSize: 24, borderRadius: 15 }}>
                ✉
              </span>
              <b>Choisis une conversation</b>
              <span className="hint">Le fil « Général » réunit toute l&apos;équipe. Le crayon démarre un message privé.</span>
            </div>
          ) : (
            <>
              <header className="chat-head">
                <button className="icon-btn chat-back" onClick={() => {
                    setLus(lireLus(compte.id));
                    setActif(null);
                  }}
                  aria-label="Retour aux conversations">
                  ←
                </button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{titreCourant}</b>
                  <small>{sousTitre}</small>
                </div>
                {!courant.g.est_direct && !courant.g.ouvert_a_tous && adminCourant && (
                  <button className="btn" style={{ height: 32 }} onClick={() => setModal("gerer")}>
                    Gérer
                  </button>
                )}
              </header>

              <div className="chat-fil" ref={filRef}>
                {plusAncien && (
                  <button className="btn chat-more" onClick={chargerPlus}>
                    Messages plus anciens
                  </button>
                )}
                {!fil ? (
                  <div className="chat-empty">
                    <span className="hint">Chargement…</span>
                  </div>
                ) : !fil.length ? (
                  <div className="chat-empty">
                    <b>Aucun message pour l&apos;instant</b>
                    <span className="hint">Écris le premier !</span>
                  </div>
                ) : (
                  fil.map((m, i) => {
                    const avant = fil[i - 1];
                    const nouveauJour = !avant || new Date(avant.created_at).toDateString() !== new Date(m.created_at).toDateString();
                    const suite = !nouveauJour && avant?.compte_id === m.compte_id && new Date(m.created_at).getTime() - new Date(avant.created_at).getTime() < 5 * 60000;
                    const moi = m.compte_id === compte.id;
                    const auteur = parId.get(m.compte_id);
                    const peutSupprimer = moi || (gestion && !courant.g.est_direct);
                    return (
                      <div key={m.id}>
                        {nouveauJour && <div className="chat-day">{jourMessage(m.created_at)}</div>}
                        <div className={`msg${moi ? " msg-moi" : ""}${suite ? " msg-suite" : ""}`}>
                          {!moi && <span className="avatar msg-av">{suite ? "" : auteur?.avatar_url ? <img src={auteur.avatar_url} alt="" /> : auteur ? initiales(auteur) : "?"}</span>}
                          <div className="msg-body">
                            {!moi && !suite && !courant.g.est_direct && <small className="msg-auteur">{auteur ? nomComplet(auteur) : "Ancien collaborateur"}</small>}
                            <div className="msg-bulle">
                              {m.attachments?.map((pj, k) =>
                                pj.kind === "image" ? (
                                  <button key={k} className="msg-img" onClick={() => setApercu(pj)}>
                                    <img src={pj.dataUrl} alt={pj.name} />
                                  </button>
                                ) : (
                                  <a key={k} className="msg-file" href={pj.dataUrl} download={pj.name}>
                                    <Icone nom="piece_jointe" taille={14} /> {pj.name}
                                  </a>
                                ),
                              )}
                              {m.texte && (
                                <p>
                                  {morceauxTexte(m.texte).map((x, k) =>
                                    x.lien ? (
                                      <a key={k} href={x.t} target="_blank" rel="noreferrer">
                                        {x.t}
                                      </a>
                                    ) : (
                                      <span key={k}>{x.t}</span>
                                    ),
                                  )}
                                </p>
                              )}
                              <span className="msg-meta">
                                {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                {peutSupprimer && (
                                  <button className="msg-del" onClick={() => supprimer(m)} aria-label="Supprimer ce message" title="Supprimer">
                                    ✕
                                  </button>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={basRef} />
              </div>

              <footer className="chat-compose">
                {pieces.length > 0 && (
                  <div className="chat-pieces">
                    {pieces.map((p, i) => (
                      <span key={i} className="piece">
                        {p.kind === "image" ? <img src={p.dataUrl} alt="" /> : <Icone nom="piece_jointe" taille={20} />}
                        <small>{p.name}</small>
                        <button onClick={() => setPieces((x) => x.filter((_, k) => k !== i))} aria-label="Retirer">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {erreur && (
                  <div className="error" role="alert" style={{ marginBottom: 8 }}>
                    {erreur}
                  </div>
                )}
                <div className="chat-input">
                  <button className="icon-btn" onClick={() => fichierRef.current?.click()} aria-label="Joindre un fichier" title="Photo ou fichier (2 Mo max)" disabled={pieces.length >= 4}>
                    <Icone nom="piece_jointe" taille={18} />
                  </button>
                  <input
                    ref={fichierRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) ajouterFichiers(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    value={texte}
                    onChange={(e) => setTexte(e.target.value)}
                    onKeyDown={touche}
                    onPaste={coller}
                    placeholder={`Écrire à ${titreCourant}…`}
                    rows={Math.min(6, Math.max(1, texte.split("\n").length))}
                    maxLength={4000}
                  />
                  <button className="btn btn-primary chat-send" onClick={envoyer} disabled={envoi || (!texte.trim() && !pieces.length)} aria-label="Envoyer">
                    ➤
                  </button>
                </div>
                <small className="hint chat-tip">Entrée pour envoyer · Maj + Entrée pour aller à la ligne · tu peux coller une photo</small>
              </footer>
            </>
          )}
        </section>
      </div>

      {modal === "direct" && (
        <Modal titre="Nouveau message privé" sousTitre="Choisis un collègue" onClose={() => setModal(null)}>
          <div className="pick-list" style={{ maxHeight: 380 }}>
            {equipe
              .filter((c) => c.id !== compte.id && c.statut === "actif")
              .sort((a, b) => nomComplet(a).localeCompare(nomComplet(b)))
              .map((c) => (
                <button key={c.id} className="pick" onClick={() => ouvrirDirect(c.id)}>
                  <span className="avatar">{c.avatar_url ? <img src={c.avatar_url} alt="" /> : initiales(c)}</span>
                  <span>{nomComplet(c)}</span>
                </button>
              ))}
            {!equipe.some((c) => c.id !== compte.id && c.statut === "actif") && (
              <p className="hint">Aucun collègue n&apos;a encore activé son compte : les invités apparaîtront ici après leur première connexion.</p>
            )}
          </div>
        </Modal>
      )}

      {(modal === "groupe" || (modal === "gerer" && courant)) && (
        <ModalGroupe
          etablissementId={etablissement.id}
          moiId={compte.id}
          equipe={equipe}
          groupe={modal === "gerer" ? courant!.g : undefined}
          membres={modal === "gerer" ? membresCourant : undefined}
          peutSupprimer={directeur}
          onClose={() => setModal(null)}
          onFait={(msg, id) => {
            setModal(null);
            setToast(msg);
            if (msg === "Groupe supprimé") setActif(null);
            recharger();
            if (id) ouvrir(id);
          }}
        />
      )}

      {apercu && (
        <div className="modal-scrim" onMouseDown={() => setApercu(null)}>
          <img src={apercu.dataUrl} alt={apercu.name} className="lightbox" />
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
