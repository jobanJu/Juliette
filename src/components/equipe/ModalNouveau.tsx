"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@/lib/supabase";
import { ORDRE_POSTES, POSTES } from "@/lib/planning";
import { emailValide, FONCTIONS, NATURES, POSTE_DE_FONCTION, TYPES_CONTRAT } from "@/lib/personnel";
import type { Role } from "@/lib/session";

type Props = {
  etablissementId: string;
  code: string;
  nomEtablissement: string;
  monRole: Role;
  emailsExistants: string[];
  onClose: () => void;
  onCree: () => void;
};

export default function ModalNouveau(p: Props) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [fonction, setFonction] = useState("");
  const [poste, setPoste] = useState("");
  const [role, setRole] = useState<Role>("salarie");
  const [nature, setNature] = useState("cdi");
  const [type, setType] = useState("35h");
  const [embauche, setEmbauche] = useState(() => new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [cree, setCree] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  async function creer() {
    setErreur(null);
    if (!prenom.trim()) return setErreur("Le prénom est obligatoire.");
    if (!emailValide(email)) return setErreur("Il faut un e-mail valide : c'est lui qui permettra d'activer le compte.");
    if (p.emailsExistants.includes(email.trim().toLowerCase())) return setErreur("Quelqu'un de l'équipe a déjà cet e-mail.");
    setEnvoi(true);
    const { error } = await getSupabaseClient()!
      .from("comptes")
      .insert({
        etablissement_id: p.etablissementId,
        prenom: prenom.trim(),
        nom: nom.trim() || null,
        email: email.trim().toLowerCase(),
        telephone: telephone.trim() || null,
        fonction: fonction || null,
        poste: poste || null,
        role,
        statut: "invite",
        nature_contrat: nature || null,
        type_contrat: type || null,
        heures_contrat: TYPES_CONTRAT[type]?.heures ?? null,
        date_embauche: embauche || null,
      });
    setEnvoi(false);
    if (error) return setErreur("Création refusée. Seuls les responsables peuvent ajouter des collaborateurs.");
    setCree(prenom.trim());
    p.onCree();
  }

  const lien = typeof window !== "undefined" ? `${window.location.origin}/activer` : "/activer";
  const message = `Bonjour ${cree ?? ""}, ton accès à Juliette (${p.nomEtablissement}) est prêt.\n\n1. Va sur ${lien}\n2. Code établissement : ${p.code}\n3. E-mail : ${email.trim().toLowerCase()}\n4. Choisis ton mot de passe.\n\nTu pourras ensuite voir ton planning, pointer et poser tes congés.`;

  if (cree) {
    return (
      <Modal
        titre={`${cree} est ajouté·e à l'équipe`}
        sousTitre="Il reste à lui transmettre son accès"
        onClose={p.onClose}
        pied={
          <>
            <button
              className="btn"
              onClick={() =>
                navigator.clipboard.writeText(message).then(
                  () => setCopie(true),
                  () => setCopie(false),
                )
              }
            >
              {copie ? "✓ Copié" : "Copier le message"}
            </button>
            <button className="btn btn-primary" onClick={p.onClose}>
              Terminé
            </button>
          </>
        }
      >
        <p className="hint" style={{ fontSize: 13 }}>
          Envoie-lui ce message (SMS, WhatsApp…). Son compte passera de « Invitation en attente » à « Actif » dès qu&apos;il l&apos;aura activé.
        </p>
        <pre className="invite-msg">{message}</pre>
      </Modal>
    );
  }

  return (
    <Modal
      titre="Nouveau collaborateur"
      sousTitre="Il recevra un accès personnel à Juliette"
      onClose={p.onClose}
      pied={
        <>
          <button className="btn" onClick={p.onClose} disabled={envoi}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={creer} disabled={envoi}>
            {envoi ? "Création…" : "Ajouter à l'équipe"}
          </button>
        </>
      }
    >
      <div className="form-2">
        <div className="field">
          <label htmlFor="n-prenom">Prénom *</label>
          <input id="n-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="n-nom">Nom</label>
          <input id="n-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="n-email">E-mail *</label>
        <input id="n-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sert à activer son compte" />
      </div>
      <div className="field">
        <label htmlFor="n-tel">Téléphone</label>
        <input id="n-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="n-fonction">Fonction</label>
          <select
            id="n-fonction"
            value={fonction}
            onChange={(e) => {
              setFonction(e.target.value);
              if (POSTE_DE_FONCTION[e.target.value]) setPoste(POSTE_DE_FONCTION[e.target.value]);
            }}
          >
            <option value="">—</option>
            {Object.entries(FONCTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="n-poste">Poste au planning</label>
          <select id="n-poste" value={poste} onChange={(e) => setPoste(e.target.value)}>
            <option value="">—</option>
            {ORDRE_POSTES.map((k) => (
              <option key={k} value={k}>
                {POSTES[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="n-nature">Contrat</label>
          <select id="n-nature" value={nature} onChange={(e) => setNature(e.target.value)}>
            {Object.entries(NATURES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="n-type">Durée hebdo</label>
          <select id="n-type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPES_CONTRAT).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="n-embauche">Date d&apos;embauche</label>
        <input id="n-embauche" type="date" value={embauche} onChange={(e) => setEmbauche(e.target.value)} />
      </div>
      {p.monRole === "directeur" && (
        <div className="field">
          <label>Niveau d&apos;accès</label>
          <div className="seg seg-2">
            {(["salarie", "responsable"] as const).map((r) => (
              <button key={r} className={role === r ? "on" : ""} onClick={() => setRole(r)}>
                {r === "salarie" ? "Salarié" : "Responsable"}
              </button>
            ))}
          </div>
          <p className="hint">
            {role === "responsable" ? "Peut modifier le planning, l'équipe, le stock et valider les congés." : "Voit son planning, pointe, pose ses congés."}
          </p>
        </div>
      )}
      {erreur && (
        <div className="error" role="alert">
          {erreur}
        </div>
      )}
    </Modal>
  );
}
