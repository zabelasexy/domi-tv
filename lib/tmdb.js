"use client";
import { accessToken } from "./supabase";

const cache = new Map();
const TTL = 15 * 60 * 1000;

/** Chamada ao TMDB pelo nosso servidor, com cache na memória para voltar a uma tela sem esperar. */
export function tmdb(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const key = path + (qs ? "?" + qs : "");
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.promise;
  const promise = (async () => {
    const r = await fetch(`/api/tmdb/${key}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (!r.ok) throw new Error(`TMDB respondeu ${r.status}`);
    return r.json();
  })();
  cache.set(key, { promise, until: Date.now() + TTL });
  promise.catch(() => cache.delete(key));
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return promise;
}

/** Mesmos parâmetros que a página da série usa, para já chegar carregada. */
export const SHOW_PARAMS = { append_to_response: "watch/providers" };
export function prefetchShow(id) {
  if (!id) return;
  tmdb(`tv/${id}`, SHOW_PARAMS).catch(() => {});
}

export async function recs(ids) {
  const r = await fetch("/api/recs", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({ ids }),
  });
  if (!r.ok) throw new Error(`Sugestões falharam (${r.status})`);
  return r.json();
}

/** Pergunta ao servidor o que combina com a vibe do quiz. */
export async function quiz(answers, exclude, seeds) {
  const r = await fetch("/api/quiz", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({ answers, exclude, seeds }),
  });
  if (!r.ok) throw new Error(`Quiz falhou (${r.status})`);
  return r.json();
}

export const img =(path, size = "w342") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);

/** Converte o retorno de /tv/{id} nos campos guardados na tabela shows. */
export function showFields(d) {
  const runtimes = d.episode_run_time || [];
  return {
    tmdb_id: d.id,
    title: d.name,
    original_title: d.original_name || null,
    poster_path: d.poster_path || null,
    backdrop_path: d.backdrop_path || null,
    year: (d.first_air_date || "").slice(0, 4) || null,
    genres: (d.genres || []).map((g) => g.name),
    seasons_total: d.number_of_seasons ?? null,
    episodes_total: d.number_of_episodes ?? null,
    runtime: runtimes.length ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : null,
  };
}
