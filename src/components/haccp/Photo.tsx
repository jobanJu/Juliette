"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { nouvelId, reduirePhoto } from "@/lib/haccp";

// Photos HACCP : bucket privé « haccp », rangées sous <etablissement_id>/<rubrique>/<jour>/…
// L'affichage passe par une URL signée courte, mise en cache le temps de la page.
const cache = new Map<string, Promise<string | null>>();

function urlSignee(chemin: string) {
  if (!cache.has(chemin)) {
    cache.set(
      chemin,
      getSupabaseClient()!
        .storage.from("haccp")
        .createSignedUrl(chemin, 3600)
        .then(({ data }) => data?.signedUrl ?? null),
    );
  }
  return cache.get(chemin)!;
}

export async function envoyerPhoto(etablissementId: string, rubrique: string, fichier: File) {
  const blob = await reduirePhoto(fichier);
  const jour = new Date().toISOString().slice(0, 10);
  const chemin = `${etablissementId}/${rubrique}/${jour}/${Date.now()}-${nouvelId()}.jpg`;
  const { error } = await getSupabaseClient()!.storage.from("haccp").upload(chemin, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return chemin;
}

export default function PhotoHaccp({ chemin, alt = "", className }: { chemin: string; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    urlSignee(chemin).then((u) => vivant && setUrl(u));
    return () => {
      vivant = false;
    };
  }, [chemin]);
  if (!url) return <span className={`haccp-photo-vide ${className ?? ""}`} aria-hidden />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={className} title="Ouvrir la photo">
      <img src={url} alt={alt} loading="lazy" />
    </a>
  );
}
