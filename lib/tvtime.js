/** Leitura do export do TV Time no formato JSON (tvtime-series / tvtime-lists). */

const STATUS_MAP = {
  up_to_date: "em_dia",
  continuing: "assistindo",
  stopped: "abandonada",
  not_started_yet: "quero",
  watch_later: "quero",
};

/** "2022-06-07 23:12:07" (sem fuso) vira ISO em UTC; o Safari não entende o formato com espaço. */
export function tvtimeDate(s) {
  if (!s) return null;
  const iso = /T/.test(s) ? s : String(s).trim().replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? "" : "Z");
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function isTvtimeSeries(data) {
  return Array.isArray(data) && data.length > 0 && data[0] && "seasons" in data[0] && data[0].id && "tvdb" in data[0].id;
}
export function isTvtimeLists(data) {
  return Array.isArray(data) && data.length > 0 && data[0] && Array.isArray(data[0].items) && "name" in data[0];
}

/**
 * Junta séries + listas no formato que o importador usa:
 * { name, tvdb, episodes: Map, hint, favorite, tags }
 */
export function analyzeTvtimeJson(seriesArr = [], listsArr = []) {
  const listTags = new Map();
  for (const list of listsArr) {
    for (const it of list.items || []) {
      if (it.type !== "series" || !it.tvdb_id) continue;
      const k = String(it.tvdb_id);
      listTags.set(k, [...(listTags.get(k) || []), String(list.name).trim()].filter(Boolean));
    }
  }

  return seriesArr
    .filter((s) => s && s.title)
    .map((s) => {
      const tvdb = s.id?.tvdb ? String(s.id.tvdb) : null;
      const episodes = new Map();
      for (const season of s.seasons || []) {
        if (season.is_specials || !Number.isInteger(season.number) || season.number < 1) continue;
        for (const e of season.episodes || []) {
          if (!e.is_watched || e.special || !Number.isInteger(e.number)) continue;
          episodes.set(`${season.number}x${e.number}`, { season: season.number, episode: e.number, watched_at: tvtimeDate(e.watched_at) });
        }
      }
      return {
        name: String(s.title).replace(/\s+\(\d{4}\)$/, "").trim(),
        tvdb,
        episodes,
        hint: STATUS_MAP[s.status] || null,
        favorite: !!s.is_favorite,
        tags: tvdb ? listTags.get(tvdb) || [] : [],
        added_at: tvtimeDate(s.created_at),
      };
    });
}
