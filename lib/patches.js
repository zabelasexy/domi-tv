/** Patches (medalhas) calculados a partir da coleção, dos episódios e do Match. */

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const FILLED = new Set(["play", "moon", "bolt", "heart", "star", "fire", "flag"]);

export const ICONS = {
  play: "M8 5l11 7l-11 7z",
  moon: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z",
  bolt: "M13 2L5 14h6l-1 8l8-12h-6z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  snow: "M12 2v20M4 6l16 12M20 6L4 18",
  flag: "M5 21V4h11l-2 4l2 4H5",
  star: "M12 3l2.7 5.6l6.1.9l-4.4 4.3l1 6.1L12 17l-5.4 2.9l1-6.1L3.2 9.5l6.1-.9z",
  stack: "M4 7l8-4l8 4l-8 4zM4 12l8 4l8-4M4 17l8 4l8-4",
  pen: "M4 20h4L19 9l-4-4L4 16z",
  fire: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4c0 2 1 3 2 3c0-4-1-6 1-9z",
  mask: "M4 6c3 2 13 2 16 0v6a8 8 0 0 1-16 0zM8 11h2M14 11h2M9 15c2 1.5 4 1.5 6 0",
  smile: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM8 14c2 2.5 6 2.5 8 0M9 9h.01M15 9h.01",
  clock: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5l3 3",
  film: "M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4",
  check: "M5 12l5 5L20 7",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
};

function facts({ shows = [], eps = [], swipes = [] }) {
  const perDay = new Map();
  const perShowDay = new Map();
  const nightOwl = { hit: false, nightCount: new Map() };
  const byShow = new Map();
  for (const e of eps) {
    if (!e.watched_at) continue;
    const k = dayKey(e.watched_at);
    perDay.set(k, (perDay.get(k) || 0) + 1);
    const sk = `${e.tmdb_show_id}|${k}`;
    perShowDay.set(sk, (perShowDay.get(sk) || 0) + 1);
    const h = new Date(e.watched_at).getHours();
    if (h >= 2 && h < 5) nightOwl.hit = true;
    if (h >= 0 && h < 4) {
      const nk = dayKey(e.watched_at);
      nightOwl.nightCount.set(nk, (nightOwl.nightCount.get(nk) || 0) + 1);
    }
    const arr = byShow.get(e.tmdb_show_id) || [];
    arr.push(Date.parse(e.watched_at));
    byShow.set(e.tmdb_show_id, arr);
  }
  let comeback = false;
  for (const arr of byShow.values()) {
    arr.sort((a, b) => a - b);
    for (let i = 1; i < arr.length; i++) if (arr[i] - arr[i - 1] > 180 * DAY) { comeback = true; break; }
    if (comeback) break;
  }
  const days = [...perDay.keys()].map((k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m, d).getTime(); }).sort((a, b) => a - b);
  let streak = days.length ? 1 : 0, best = streak;
  for (let i = 1; i < days.length; i++) {
    streak = Math.round((days[i] - days[i - 1]) / DAY) === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
  }
  const loved = new Set(swipes.filter((s) => s.decision === "quero").map((s) => s.tmdb_id));
  return {
    eps: eps.length,
    maxDay: Math.max(0, ...perDay.values()),
    maxShowDay: Math.max(0, ...perShowDay.values()),
    owl: nightOwl.hit,
    allNighter: Math.max(0, ...nightOwl.nightCount.values()),
    comeback,
    bestStreak: best,
    shows: shows.length,
    finished: shows.filter((s) => s.status === "finalizada").length,
    rated: shows.filter((s) => s.rating > 0).length,
    favs: shows.filter((s) => s.favorite).length,
    ships: shows.filter((s) => (s.ship || "").trim()).length,
    longHaul: shows.some((s) => s.status === "finalizada" && (s.seasons_total || 0) >= 7),
    vintage: shows.some((s) => s.year && Number(s.year) < 2000 && s.status !== "quero"),
    drama: shows.filter((s) => (s.genres || []).includes("Drama") && s.status !== "quero").length,
    comedy: shows.filter((s) => (s.genres || []).includes("Comédia") && s.status !== "quero").length,
    perfectMatch: shows.some((s) => s.rating === 5 && loved.has(s.tmdb_id)),
  };
}

const P = (id, name, desc, color, icon, test, secret = false) => ({ id, name, desc, color, icon, test, secret });
const count = (n, goal) => ({ done: n >= goal, have: Math.min(n, goal), goal });
const flag = (b) => ({ done: !!b, have: b ? 1 : 0, goal: 1 });

export const PATCHES = [
  P("primeiro", "Primeiro play", "Marcou o primeiro episódio", "#3F7BFF", "play", (f) => flag(f.eps >= 1)),
  P("ep100", "100 episódios", "100 episódios marcados", "#2357C6", "film", (f) => count(f.eps, 100)),
  P("ep1000", "Mil episódios", "1.000 episódios marcados", "#5B4BC4", "film", (f) => count(f.eps, 1000)),
  P("ep5000", "Lenda do sofá", "5.000 episódios marcados", "#C8662E", "film", (f) => count(f.eps, 5000)),
  P("ep10000", "Dez mil", "10.000 episódios marcados", "#B03A48", "film", (f) => count(f.eps, 10000)),
  P("maratona", "Maratonista", "10 episódios num dia só", "#FF9A3C", "bolt", (f) => count(f.maxDay, 10)),
  P("temporada", "Temporada num dia", "8 episódios da mesma série num dia", "#E86A8E", "stack", (f) => count(f.maxShowDay, 8)),
  P("corujona", "Corujona", "Assistiu algo depois das 2h da manhã", "#173C8C", "moon", (f) => flag(f.owl)),
  P("sequencia", "Sete dias seguidos", "Assistiu algo 7 dias em sequência", "#FF5A36", "fire", (f) => count(f.bestStreak, 7)),
  P("geladeira", "Saiu da geladeira", "Voltou a uma série depois de 6 meses parada", "#4F9BB0", "snow", (f) => flag(f.comeback)),
  P("fimdeumaera", "Fim de uma era", "Terminou uma série com 7+ temporadas", "#5B4BC4", "flag", (f) => flag(f.longHaul)),
  P("primeirafim", "Créditos finais", "Terminou a primeira série", "#2E6B5A", "check", (f) => count(f.finished, 1)),
  P("cinquenta", "Cinquentona", "50 séries finalizadas", "#557A5B", "check", (f) => count(f.finished, 50)),
  P("colecao", "Colecionadora", "100 séries na coleção", "#2357C6", "stack", (f) => count(f.shows, 100)),
  P("critica", "Crítica", "Deu nota para 25 séries", "#FF9A3C", "star", (f) => count(f.rated, 25)),
  P("coracao", "Coração mole", "10 séries favoritas", "#E86A8E", "heart", (f) => count(f.favs, 10)),
  P("shipper", "Shipper oficial", "Anotou o shipp de 10 séries", "#E86A8E", "heart", (f) => count(f.ships, 10)),
  P("match", "Match perfeito", "Deu ♥ no Match e depois nota 5", "#C8662E", "heart", (f) => flag(f.perfectMatch)),
  P("drama", "Rainha do drama", "30 séries de drama", "#7A2E4A", "mask", (f) => count(f.drama, 30)),
  P("comedia", "Rindo à toa", "20 comédias", "#E0A526", "smile", (f) => count(f.comedy, 20)),
  P("vintage", "Vintage", "Assistiu uma série de antes dos anos 2000", "#9A5B36", "clock", (f) => flag(f.vintage)),
  P("acordada", "Acordada a noite toda", "Cinco episódios entre meia-noite e 4h, na mesma noite", "#3B2A6B", "mic", (f) => count(f.allNighter, 5), true),
];

export function computePatches(data) {
  const f = facts(data);
  return PATCHES.map((p) => ({ ...p, ...p.test(f) }));
}
