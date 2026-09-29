"use client";

// Préférences d'affichage propres à chaque appareil (paramètres individuels). Gardées dans le
// navigateur : elles n'ont pas à suivre la personne d'un appareil à l'autre.
import { useCallback, useSyncExternalStore } from "react";

export type DispositionMenu = "laterale" | "horizontale";
const CLE = "juliette:menu";
const abonnes = new Set<() => void>();

function lire(): DispositionMenu {
  try {
    return localStorage.getItem(CLE) === "horizontale" ? "horizontale" : "laterale";
  } catch {
    return "laterale";
  }
}

function abonner(f: () => void) {
  abonnes.add(f);
  window.addEventListener("storage", f);
  return () => {
    abonnes.delete(f);
    window.removeEventListener("storage", f);
  };
}

export function useDispositionMenu() {
  const valeur = useSyncExternalStore(abonner, lire, () => "laterale" as DispositionMenu);
  const changer = useCallback((v: DispositionMenu) => {
    try {
      localStorage.setItem(CLE, v);
    } catch {}
    abonnes.forEach((f) => f());
  }, []);
  return [valeur, changer] as const;
}
