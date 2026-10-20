import { isAuthed, tmdbFetch } from "@/lib/server";

export const runtime = "nodejs";

/**
 * Recebe as séries que ela mais gostou e devolve sugestões ordenadas:
 * quanto mais séries dela "puxam" a mesma recomendação, mais alto ela sobe.
 */
export async function POST(req) {
  if (!(await isAuthed(req))) return Response.json({ error: "faça login" }, { status: 401 });
  let ids = [];
  try {
    ids = ((await req.json()).ids || []).map(Number).filter(Number.isInteger).slice(0, 10);
  } catch {}

  const score = new Map();
  const add = (s, because, weight) => {
    if (!s.poster_path) return;
    const cur = score.get(s.id) || { show: s, score: 0, because: [] };
    cur.score += weight + (s.vote_average || 0) / 20;
    if (because && !cur.because.includes(because)) cur.because.push(because);
    score.set(s.id, cur);
  };

  await Promise.all(
    ids.map(async (id) => {
      const [base, rec] = await Promise.all([tmdbFetch(`tv/${id}`), tmdbFetch(`tv/${id}/recommendations`)]);
      if (!base.ok || !rec.ok) return;
      const name = (await base.json()).name;
      for (const s of (await rec.json()).results || []) add(s, name, 1);
    })
  );

  for (const page of ["1", "2"]) {
    const t = await tmdbFetch("trending/tv/week", { page });
    if (t.ok) for (const s of (await t.json()).results || []) add(s, null, 0.15);
  }

  const out = [...score.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 80)
    .map(({ show, because }) => ({
      id: show.id,
      name: show.name,
      poster_path: show.poster_path,
      backdrop_path: show.backdrop_path,
      overview: show.overview,
      year: (show.first_air_date || "").slice(0, 4),
      genre_ids: show.genre_ids || [],
      vote: show.vote_average,
      because,
    }));
  return Response.json({ results: out }, { headers: { "cache-control": "private, no-store" } });
}
