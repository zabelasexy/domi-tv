"use client";
import { useEffect, useState } from "react";
import { accessToken } from "@/lib/supabase";

/** Trilha sonora da série: player do Spotify quando dá para achar; senão, botão que abre a busca no Spotify. */
export default function Soundtrack({ title, originalTitle }) {
  const [item, setItem] = useState(undefined);
  const q = originalTitle || title;
  const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(`${q} soundtrack`)}`;

  useEffect(() => {
    if (!q) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/spotify?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
        const d = r.ok ? await r.json() : { item: null };
        if (alive) setItem(d.item || null);
      } catch {
        if (alive) setItem(null);
      }
    })();
    return () => { alive = false; };
  }, [q]);

  return (
    <section className="ost" aria-label="Trilha sonora">
      <div className="ost-head">
        <span className="ost-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0z" /></svg>
        </span>
        <div>
          <p className="eyebrow">trilha sonora</p>
          <h2>{item?.name || `As músicas de ${title}`}</h2>
        </div>
      </div>
      {item ? (
        <iframe
          title={`Trilha sonora de ${title} no Spotify`}
          src={`https://open.spotify.com/embed/${item.type}/${item.id}?utm_source=generator&theme=0`}
          width="100%"
          height="352"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="ost-player"
        />
      ) : (
        <a className="btn btn-spotify" href={searchUrl} target="_blank" rel="noopener noreferrer">
          Ouvir a trilha no Spotify
        </a>
      )}
    </section>
  );
}
