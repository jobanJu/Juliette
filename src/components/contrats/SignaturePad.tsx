"use client";

import { useEffect, useRef, useState } from "react";

// Pavé de signature : tracé au doigt, au stylet ou à la souris, exporté en PNG.
export default function SignaturePad({ onValider, onAnnuler, envoi }: { onValider: (png: string) => void; onAnnuler: () => void; envoi?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dessine = useRef(false);
  const [vide, setVide] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c1a2b";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvas}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dessine.current = true;
          const ctx = canvas.current!.getContext("2d")!;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.1, y + 0.1);
          ctx.stroke();
          setVide(false);
        }}
        onPointerMove={(e) => {
          if (!dessine.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          const [x, y] = point(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => (dessine.current = false)}
        onPointerCancel={() => (dessine.current = false)}
        aria-label="Zone de signature"
      />
      <span className="signature-ligne" aria-hidden>
        Signez ici
      </span>
      <div className="signature-actions">
        <button className="btn" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </button>
        <button
          className="btn"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setVide(true);
          }}
          disabled={envoi || vide}
        >
          Effacer
        </button>
        <button className="btn btn-primary" onClick={() => onValider(canvas.current!.toDataURL("image/png"))} disabled={envoi || vide}>
          {envoi ? "Signature…" : "Valider ma signature"}
        </button>
      </div>
    </div>
  );
}
