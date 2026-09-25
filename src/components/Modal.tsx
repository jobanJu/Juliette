"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

export default function Modal({ titre, sousTitre, onClose, children, pied }: { titre: string; sousTitre?: string; onClose: () => void; children: ReactNode; pied?: ReactNode }) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [onClose]);

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titre}>
        <div className="modal-head">
          <div>
            <h2>{titre}</h2>
            {sousTitre && <p>{sousTitre}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {pied && <div className="modal-foot">{pied}</div>}
      </div>
    </div>
  );
}
