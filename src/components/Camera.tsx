"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icone from "@/components/Icone";

type Props = {
  onCapture: (photo: File) => void;
  onClose?: () => void;
  /** Dans la page (traçabilité) plutôt qu'en plein écran. */
  inline?: boolean;
  titre?: string;
};

// Caméra intégrée : viseur en direct (caméra arrière par défaut), déclencheur, bascule avant/arrière.
// Sans caméra ou sans autorisation, on retombe sur le sélecteur de photo du téléphone.
export default function Camera({ onCapture, onClose, inline, titre }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const secours = useRef<HTMLInputElement>(null);
  const [face, setFace] = useState<"environment" | "user">("environment");
  const [etat, setEtat] = useState<"demarrage" | "pret" | "indisponible">("demarrage");
  const [plusieurs, setPlusieurs] = useState(false);
  const [flash, setFlash] = useState(false);

  const arreter = useCallback(() => {
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
  }, []);

  useEffect(() => {
    let vivant = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => vivant && setEtat("indisponible"));
      return;
    }
    // Autorisation jamais donnée ni refusée (fenêtre ignorée) : on propose le choix de photo.
    const delai = setTimeout(() => vivant && setEtat((e) => (e === "demarrage" ? "indisponible" : e)), 10000);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: face }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (s) => {
        if (!vivant) return s.getTracks().forEach((t) => t.stop());
        arreter();
        flux.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setEtat("pret");
        const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (vivant) setPlusieurs(cameras.length > 1);
      })
      .catch(() => vivant && setEtat("indisponible"));
    return () => {
      vivant = false;
      clearTimeout(delai);
    };
  }, [face, arreter]);

  useEffect(() => arreter, [arreter]);

  function declencher() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    c.toBlob(
      (b) => {
        if (!b) return;
        arreter();
        onCapture(new File([b], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  const corps = (
    <div className={`camera${inline ? " camera-inline" : ""}`}>
      {titre && !inline && <div className="camera-titre">{titre}</div>}
      <div className="camera-viseur">
        <video ref={video} playsInline muted autoPlay className={face === "user" ? "miroir" : ""} />
        {flash && <div className="camera-flash" />}
        {etat === "demarrage" && <div className="camera-info">Ouverture de la caméra…</div>}
        {etat === "indisponible" && (
          <div className="camera-info">
            <p>Caméra indisponible (autorisation refusée ou appareil sans caméra).</p>
            <button className="btn btn-primary" onClick={() => secours.current?.click()}>
              <Icone nom="dossier" /> Choisir une photo
            </button>
          </div>
        )}
        {etat === "pret" && <div className="camera-cadre" aria-hidden />}
      </div>
      <div className="camera-commandes">
        {onClose ? (
          <button
            className="camera-rond petit"
            onClick={() => {
              arreter();
              onClose();
            }}
            aria-label="Fermer la caméra"
          >
            ✕
          </button>
        ) : (
          <span className="camera-rond petit vide" />
        )}
        <button className="camera-declencheur" onClick={declencher} disabled={etat !== "pret"} aria-label="Prendre la photo" />
        {plusieurs ? (
          <button className="camera-rond petit" onClick={() => setFace((f) => (f === "environment" ? "user" : "environment"))} aria-label="Changer de caméra">
            ⟳
          </button>
        ) : (
          <button className="camera-rond petit" onClick={() => secours.current?.click()} aria-label="Choisir une photo existante">
            <Icone nom="dossier" taille={20} />
          </button>
        )}
      </div>
      <input
        ref={secours}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            arreter();
            onCapture(f);
          }
        }}
      />
    </div>
  );

  if (inline) return corps;
  return (
    <div className="camera-scrim" role="dialog" aria-modal="true" aria-label={titre ?? "Caméra"}>
      {corps}
    </div>
  );
}
