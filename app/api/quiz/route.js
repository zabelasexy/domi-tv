import { isAuthed, tmdbFetch } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Palavras-chave do TMDB resolvidas pelo nome (o id delas não muda, então fica guardado). */
const kwCache = new Map();
async function keyword(name) {
  if (kwCache.has(name)) return kwCache.get(name);
  let id = null;
  try {
    const r = await tmdbFetch("search/keyword", { query: name });
    if (r.ok) id = ((await r.json()).results || []).find((k) => k.name.toLowerCase() === name)?.id ?? null;
  } catch {}
  kwCache.set(name, id);
  return id;
}

const CLIMA = {
  rir: { genres: "35", without: ["80"] },
  chorar: { genres: "18", without: ["35"], kw: ["tearjerker", "grief"] },
  frio: { genres: "18|35", kw: ["romance"], kwRequired: true },
  tensao: { genres: "80|9648" },
  outro: { genres: "10765" },
  conforto: { genres: "35|10751", without: ["80", "9648"], kw: ["sitcom", "friendship"] },
};
const ORIGEM = { us: "US", gb: "GB", kr: "KR", br: "BR", es: "ES|MX|AR|CO", jp: "JP" };
const ALWAYS_WITHOUT = ["10762", "10763", "10764", "10767"];

const isoMonthsAgo = (m) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().slice(0, 10); };

/** Monta os filtros do discover a partir das respostas, do mais exato ao mais solto. */
async function attempts(a) {
  const c = CLIMA[a.clima] || {};
  const without = [...ALWAYS_WITHOUT, ...(c.without || [])];
  if (a.cabeca === "desligar") without.push("99", "10768");
  const base = { include_adult: "false", "without_genres": [...new Set(without)].join(",") };
  if (c.genres) base.with_genres = c.genres;

  if (a.epoca === "novinha") Object.assign(base, { sort_by: "popularity.desc", "first_air_date.gte": isoMonthsAgo(20), "vote_count.gte": "15" });
  else if (a.epoca === "joia") Object.assign(base, { sort_by: "vote_average.desc", "vote_average.gte": "7.4", "vote_count.gte": "40", "vote_count.lte": "700" });
  else if (a.epoca === "classico") Object.assign(base, { sort_by: "vote_average.desc", "first_air_date.lte": isoMonthsAgo(120), "vote_count.gte": "700" });
  else Object.assign(base, { sort_by: "popularity.desc", "vote_count.gte": "120", "vote_average.gte": "6.8" });

  const runtime = a.tempo === "curto" ? { "with_runtime.lte": "35" } : a.tempo === "medio" ? { "with_runtime.gte": "35", "with_runtime.lte": "70" } : {};
  const status = a.tempo === "maratona" ? { with_status: "3" } : {};
  const origin = ORIGEM[a.origem] ? { with_origin_country: ORIGEM[a.origem] } : {};

  const kwIds = (await Promise.all((c.kw || []).map(keyword))).filter(Boolean);
  const kw = kwIds.length ? { with_keywords: kwIds.join("|") } : {};

  const out = [
    { ...base, ...kw, ...runtime, ...status, ...origin },
    { ...base, ...(c.kwRequired ? kw : {}), ...runtime, ...origin },
    { ...base, ...(c.kwRequired ? kw : {}), ...origin },
    { ...base, ...origin },
    { ...base },
  ];
  // Sem repetir tentativas iguais.
  const seen = new Set();
  return out.filter((p) => { const k = JSON.stringify(p); if (seen.has(k)) return false; seen.add(k); return true; });
}

async function discover(params) {
  const pages = await Promise.all(["1", "2", "3"].map(async (page) => {
    try {
      const r = await tmdbFetch("discover/tv", { ...params, page });
      return r.ok ? (await r.json()).results || [] : [];
    } catch { return []; }
  }));
  return pages.flat();
}

export async function POST(req) {
  if (!(await isAuthed(req))) return Response.json({ error: "faça login" }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch {}
  const pick = (v, ok) => (ok.includes(v) ? v : "tanto");
  const a = {
    clima: pick(body.answers?.clima, Object.keys(CLIMA)),
    tempo: pick(body.answers?.tempo, ["curto", "medio", "maratona"]),
    epoca: pick(body.answers?.epoca, ["novinha", "joia", "classico"]),
    origem: pick(body.answers?.origem, Object.keys(ORIGEM)),
    cabeca: pick(body.answers?.cabeca, ["desligar", "atencao"]),
  };
  const exclude = new Set((body.exclude || []).map(Number).filter(Number.isInteger).slice(0, 5000));
  const seeds = (body.seeds || []).map(Number).filter(Number.isInteger).slice(0, 5);

  // Séries parecidas com as favoritas dela ganham um empurrão (e um "porque você amou…").
  const loved = new Map();
  await Promise.all(seeds.map(async (id) => {
    try {
      const [b, r] = await Promise.all([tmdbFetch(`tv/${id}`), tmdbFetch(`tv/${id}/recommendations`)]);
      if (!b.ok || !r.ok) return;
      const name = (await b.json()).name;
      for (const s of (await r.json()).results || []) if (!loved.has(s.id)) loved.set(s.id, name);
    } catch {}
  }));

  const pool = new Map();
  let relaxed = 0;
  const tries = await attempts(a);
  for (let i = 0; i < tries.length && pool.size < 18; i++) {
    for (const s of await discover(tries[i])) {
      if (!s.poster_path || exclude.has(s.id) || pool.has(s.id)) continue;
      pool.set(s.id, { s, level: i });
    }
    relaxed = i;
  }

  const genreBoost = a.cabeca === "desligar" ? ["35", "10751", "16"] : a.cabeca === "atencao" ? ["18", "9648", "10765", "80"] : [];
  const scored = [...pool.values()].map(({ s, level }) => {
    let score = (s.vote_average || 0) + Math.log10((s.vote_count || 0) + 1) * 0.5 - level * 0.8 + Math.random() * 1.6;
    if (loved.has(s.id)) score += 2.2;
    if ((s.genre_ids || []).some((g) => genreBoost.includes(String(g)))) score += 0.6;
    return { s, score };
  }).sort((x, y) => y.score - x.score).slice(0, 30);

  const results = scored.map(({ s }) => ({
    id: s.id,
    name: s.name,
    poster_path: s.poster_path,
    backdrop_path: s.backdrop_path,
    overview: s.overview,
    year: (s.first_air_date || "").slice(0, 4),
    genre_ids: s.genre_ids || [],
    vote: s.vote_average,
    because: loved.get(s.id) || null,
  }));
  return Response.json({ results, relaxed }, { headers: { "cache-control": "private, no-store" } });
}
