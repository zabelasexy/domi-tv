"use client";
/**
 * Retrospectiva em stories: cada cena é desenhada num canvas 1080×1920 a partir do tempo t (segundos).
 * O mesmo desenho serve para tocar na tela e para gravar o vídeo vertical.
 */
import { img } from "./tmdb";
import { WEEKDAYS } from "./constants";

export const W = 1080;
export const H = 1920;

const C = {
  night: "#05070F", deep: "#0C1121", azul: "#2357C6", azulClaro: "#6EA8FF", stamp: "#FF9A3C",
  papel: "#F3EEE4", tinta: "#EAF0FF", muted: "#8C9BC8", pink: "#FF7AA8", roxo: "#7B4FE0", teal: "#4FD1C5", ink: "#0B1024",
};
const FONT = "Poppins, system-ui, sans-serif";

/* ---------- utilidades de desenho ---------- */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
const lerp = (a, b, t) => a + (b - a) * t;

function setFont(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}
function txt(ctx, s, x, y, { size = 60, weight = 700, color = C.tinta, align = "left", alpha = 1, base = "alphabetic", track = 0 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  setFont(ctx, size, weight);
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${track}px`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  ctx.restore();
}
function wrap(ctx, s, maxW, size, weight = 700) {
  setFont(ctx, size, weight);
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
/** Texto grande que encolhe até caber em maxLines linhas. */
function fitLines(ctx, s, maxW, size, maxLines = 2, weight = 800) {
  let sz = size;
  let lines = wrap(ctx, s, maxW, sz, weight);
  while ((lines.length > maxLines || lines.some((l) => { setFont(ctx, sz, weight); return ctx.measureText(l).width > maxW; })) && sz > 40) {
    sz -= 6;
    lines = wrap(ctx, s, maxW, sz, weight);
  }
  return { lines, size: sz };
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
/** Imagem cobrindo a caixa (como object-fit: cover), com cantos arredondados. */
function cover(ctx, im, x, y, w, h, r = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (r) { rr(ctx, x, y, w, h, r); ctx.clip(); }
  if (im && im.complete && im.naturalWidth) {
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const iw = im.naturalWidth * s, ih = im.naturalHeight * s;
    ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#22305A"); g.addColorStop(1, "#111A33");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
function poster(ctx, im, x, y, w, { r = 22, rot = 0, alpha = 1, shadow = true, scale = 1 } = {}) {
  const h = w * 1.5;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= clamp(alpha);
  if (shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    rr(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fill();
    ctx.restore();
  }
  cover(ctx, im, -w / 2, -h / 2, w, h, r);
  ctx.restore();
}
function bg(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}
/** Granulado leve, igual em todas as cenas (dá textura de filme). */
let grainTile = null;
function grain(ctx, t, amount = 0.07) {
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext("2d");
    const d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = "overlay";
  const ox = Math.floor((t * 97) % 256), oy = Math.floor((t * 61) % 256);
  ctx.translate(-ox, -oy);
  ctx.fillStyle = ctx.createPattern(grainTile, "repeat");
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}
function blob(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
/** Logo "d ▶ m i TV" desenhado. */
function wordmark(ctx, cx, cy, size, alpha = 1, t = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  setFont(ctx, size, 800);
  const d = ctx.measureText("d").width, m = ctx.measureText("mi").width;
  const o = size * 0.56;
  const total = d + o + size * 0.06 + m + size * 0.18 + size * 0.62;
  let x = cx - total / 2;
  txt(ctx, "d", x, cy, { size, weight: 800 });
  x += d + size * 0.03;
  const ocx = x + o / 2, ocy = cy - size * 0.24;
  const g = ctx.createRadialGradient(ocx - o * 0.15, ocy - o * 0.2, o * 0.05, ocx, ocy, o * 0.6);
  g.addColorStop(0, "#6EA8FF"); g.addColorStop(1, C.azul);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(ocx, ocy, (o / 2) * E.back(clamp(t)), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(ocx - o * 0.12, ocy - o * 0.17); ctx.lineTo(ocx + o * 0.19, ocy); ctx.lineTo(ocx - o * 0.12, ocy + o * 0.17); ctx.closePath(); ctx.fill();
  x += o + size * 0.03;
  txt(ctx, "mi", x, cy, { size, weight: 800 });
  x += m + size * 0.18;
  rr(ctx, x, cy - size * 0.62, size * 0.62, size * 0.5, size * 0.1);
  ctx.fillStyle = C.stamp; ctx.fill();
  txt(ctx, "TV", x + size * 0.31, cy - size * 0.24, { size: size * 0.28, weight: 800, color: C.ink, align: "center", base: "middle" });
  ctx.restore();
}
function eyebrow(ctx, s, x, y, alpha, color = C.azulClaro, align = "left") {
  txt(ctx, s.toUpperCase(), x, y, { size: 34, weight: 700, color, alpha, align, track: 6 });
}
function countUp(n, t) {
  return Math.round(n * E.out(clamp(t)));
}
const fmt = (n) => Number(n).toLocaleString("pt-BR");
const slideIn = (t, a, d = 0.6) => E.out(seg(t, a, a + d));

/* ---------- dados do mês ---------- */

/** Monta os números da retrospectiva a partir dos episódios e filmes do mês. */
export function storyData({ eps, shows, movies, finished, label, name }) {
  const byId = new Map(shows.map((s) => [s.tmdb_id, s]));
  const epMin = eps.reduce((a, e) => a + (e.runtime || 0), 0);
  const movieMin = movies.reduce((a, m) => a + (m.runtime || 0), 0);
  const minutes = epMin + movieMin;

  const perShow = new Map();
  eps.forEach((e) => perShow.set(e.tmdb_show_id, (perShow.get(e.tmdb_show_id) || 0) + 1));
  const ranking = [...perShow.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ show: byId.get(id), n })).filter((r) => r.show);

  const genres = new Map();
  ranking.forEach(({ show, n }) => (show.genres || []).forEach((g) => genres.set(g, (genres.get(g) || 0) + n)));
  movies.forEach((m) => (m.genres || []).forEach((g) => genres.set(g, (genres.get(g) || 0) + 2)));
  const genreTotal = [...genres.values()].reduce((a, b) => a + b, 0) || 1;
  const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, n]) => ({ g, pct: Math.round((n / genreTotal) * 100) }));

  const perWeekday = Array(7).fill(0);
  const perDay = new Map();
  let night = 0;
  eps.forEach((e) => {
    const d = new Date(e.watched_at);
    perWeekday[d.getDay()]++;
    const h = d.getHours();
    if (h >= 22 || h < 5) night++;
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    perDay.set(key, (perDay.get(key) || 0) + 1);
  });
  movies.forEach((m) => { if (m.watched_at) perWeekday[new Date(m.watched_at).getDay()] += 2; });
  const bestWeekday = perWeekday.indexOf(Math.max(...perWeekday));
  const bigDay = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  const hours = minutes / 60;
  const topShare = ranking[0] && eps.length ? ranking[0].n / eps.length : 0;
  let persona;
  if (hours >= 40) persona = { t: "Maratonista sem freio", d: "Dormir? Só depois do próximo episódio. Esse mês foi de fôlego olímpico." };
  else if (eps.length >= 10 && night / eps.length > 0.45) persona = { t: "Coruja das séries", d: "Quase metade dos episódios foi depois das 22h. A melhor parte do dia começa quando o resto dorme." };
  else if (movies.length >= 4 && movies.length * 6 >= eps.length) persona = { t: "Cinéfila de sofá", d: "Pipoca, coberta e um filme atrás do outro. A sala virou cinema." };
  else if (topShare > 0.6 && ranking[0]?.n >= 6) persona = { t: "Monogâmica de série", d: `Uma série de cada vez, e esse mês ela se chamou ${ranking[0].show.title}.` };
  else if (ranking.length >= 6) persona = { t: "Zapeadora oficial", d: `${ranking.length} séries diferentes no mesmo mês. Curiosidade não falta.` };
  else if (topGenres[0]?.g === "Comédia") persona = { t: "Rainha do comfort", d: "Riso garantido e coração quentinho. Série boa é série que abraça." };
  else persona = { t: "No ritmo certinho", d: "Nem pouco, nem demais. Do jeitinho que dá pra aproveitar cada episódio." };

  const posters = [...ranking.map((r) => r.show.poster_path), ...movies.map((m) => m.poster_path), ...finished.map((f) => f.poster_path)].filter(Boolean);
  const topMovie = [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null;

  return {
    label, name: (name || "").split(" ")[0],
    eps: eps.length, minutes, hours, movies, topMovie, ranking, topGenres,
    perWeekday, bestWeekday, bigDay, finished, persona,
    posters: [...new Set(posters)],
  };
}

/** Lista de imagens que precisam estar carregadas antes de tocar. */
export function storyImages(S) {
  const out = new Set();
  S.posters.slice(0, 30).forEach((p) => out.add(img(p, "w342")));
  const top = S.ranking[0]?.show;
  if (top?.backdrop_path) out.add(img(top.backdrop_path, "w1280"));
  if (top?.poster_path) out.add(img(top.poster_path, "w500"));
  S.ranking.slice(0, 5).forEach((r) => r.show.poster_path && out.add(img(r.show.poster_path, "w342")));
  S.movies.slice(0, 8).forEach((m) => m.poster_path && out.add(img(m.poster_path, "w342")));
  S.finished.slice(0, 8).forEach((f) => f.poster_path && out.add(img(f.poster_path, "w342")));
  return [...out];
}

export function loadImages(urls) {
  const map = new Map();
  return Promise.all(urls.map((u) => new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => { map.set(u, im); res(); };
    im.onerror = () => res();
    im.src = u;
  }))).then(() => map);
}

/** Cor média viva de uma imagem já carregada (para tingir a cena da série do mês). */
function vivid(im) {
  try {
    const c = document.createElement("canvas");
    c.width = 16; c.height = 24;
    const x = c.getContext("2d");
    x.drawImage(im, 0, 0, 16, 24);
    const d = x.getImageData(0, 0, 16, 24).data;
    let best = [35, 87, 198], score = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const s = mx ? (mx - mn) / mx : 0;
      const sc = s * (1 - Math.abs((mx + mn) / 510 - 0.5) * 1.5);
      if (sc > score) { score = sc; best = [r, g, b]; }
    }
    return best;
  } catch { return [35, 87, 198]; }
}

/* ---------- cenas ---------- */

export function buildScenes(S, A) {
  const P = (path, size = "w342") => A.get(img(path, size));
  const scenes = [];
  const wallPosters = S.posters.slice(0, 30).map((p) => P(p));

  // 1. Capa: parede de pôsteres girando + logo
  scenes.push({
    k: "capa", dur: 5,
    draw(ctx, t) {
      bg(ctx, C.night);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.22);
      const cols = 5, pw = 300, gap = 26;
      for (let c = 0; c < cols; c++) {
        const speed = (c % 2 ? 1 : -1) * (60 + c * 12);
        const x = (c - cols / 2) * (pw + gap);
        for (let r = -4; r < 5; r++) {
          const i = (c * 7 + r + 40) % Math.max(1, wallPosters.length);
          const y = r * (pw * 1.5 + gap) + ((t * speed) % (pw * 1.5 + gap));
          const a = seg(t, 0.05 * (c + r + 4), 0.05 * (c + r + 4) + 0.6);
          poster(ctx, wallPosters[i], x, y, pw, { r: 18, alpha: 0.55 * a, shadow: false });
        }
      }
      ctx.restore();
      const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100);
      g.addColorStop(0, "rgba(5,7,15,.55)"); g.addColorStop(1, "rgba(5,7,15,.95)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      blob(ctx, W / 2, H / 2 - 120, 620 + Math.sin(t * 2) * 30, "rgba(35,87,198,.55)", seg(t, 0.4, 1.4));
      const a = slideIn(t, 0.6, 0.9);
      wordmark(ctx, W / 2, H / 2 - 80 + (1 - a) * 60, 190, a, seg(t, 0.6, 1.4));
      eyebrow(ctx, S.name ? `${S.name}, sua retrospectiva de` : "sua retrospectiva de", W / 2, H / 2 + 110, slideIn(t, 1.3), C.azulClaro, "center");
      const b = slideIn(t, 1.6, 0.8);
      txt(ctx, S.label, W / 2, H / 2 + 230 + (1 - b) * 40, { size: 96, weight: 800, align: "center", alpha: b });
      grain(ctx, t);
    },
  });

  // 2. Horas de tela
  if (S.minutes > 0) {
    const useHours = S.hours >= 2;
    const big = useHours ? Math.round(S.hours) : S.minutes;
    scenes.push({
      k: "horas", dur: 5.5,
      draw(ctx, t) {
        bg(ctx, C.azul);
        blob(ctx, 200 + Math.sin(t) * 80, 400, 700, "rgba(110,168,255,.55)");
        blob(ctx, 900, 1500 + Math.cos(t * 0.8) * 90, 800, "rgba(255,154,60,.35)");
        // anel de relógio enchendo
        const p = E.inOut(seg(t, 0.3, 2.4));
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineWidth = 36;
        ctx.strokeStyle = "rgba(255,255,255,.14)";
        ctx.beginPath(); ctx.arc(W / 2, 860, 380, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = C.stamp;
        ctx.beginPath(); ctx.arc(W / 2, 860, 380, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
        ctx.restore();
        eyebrow(ctx, "nesse mês foram", W / 2, 330, slideIn(t, 0.1), "#D7E5FF", "center");
        const n = countUp(big, seg(t, 0.3, 2.4));
        const pop = 1 + (seg(t, 2.4, 2.55) - seg(t, 2.55, 2.8)) * 0.08;
        ctx.save(); ctx.translate(W / 2, 900); ctx.scale(pop, pop);
        txt(ctx, fmt(n), 0, 0, { size: big >= 1000 ? 210 : 280, weight: 800, align: "center", base: "middle" });
        ctx.restore();
        txt(ctx, useHours ? "horas de tela" : "minutos de tela", W / 2, 1110, { size: 64, weight: 700, align: "center", alpha: slideIn(t, 1.2) });
        const parts = [];
        if (S.eps) parts.push(`${fmt(S.eps)} episódio${S.eps > 1 ? "s" : ""}`);
        if (S.movies.length) parts.push(`${S.movies.length} filme${S.movies.length > 1 ? "s" : ""}`);
        const b = slideIn(t, 2.6);
        txt(ctx, parts.join("  +  "), W / 2, 1420 + (1 - b) * 30, { size: 56, weight: 700, align: "center", alpha: b });
        const line = S.hours >= 24 ? "Mais de um dia inteiro sem piscar." : S.hours >= 10 ? "Um bom punhado de maratonas." : "Do jeitinho certo.";
        txt(ctx, line, W / 2, 1510, { size: 44, weight: 500, color: "#D7E5FF", align: "center", alpha: slideIn(t, 3.1) });
        grain(ctx, t);
      },
    });
  }

  // 3. Parede: tudo que passou pela tela
  if (S.posters.length >= 3) {
    const list = S.posters.slice(0, 12).map((p) => P(p));
    const n = list.length;
    const cols = n <= 4 ? 2 : 3;
    const pw = cols === 2 ? 360 : 270, gap = 34;
    const rows = Math.ceil(n / cols);
    const gw = cols * pw + (cols - 1) * gap, gh = rows * pw * 1.5 + (rows - 1) * gap;
    const x0 = (W - gw) / 2, y0 = Math.max(560, 1180 - gh / 2);
    const total = S.ranking.length, mv = S.movies.length;
    scenes.push({
      k: "parede", dur: 5.5,
      draw(ctx, t) {
        bg(ctx, C.night);
        blob(ctx, W / 2, 1200, 900, "rgba(35,87,198,.35)");
        eyebrow(ctx, "passaram pela sua tela", 90, 250, slideIn(t, 0.1));
        const head = [total ? `${total} série${total > 1 ? "s" : ""}` : null, mv ? `${mv} filme${mv > 1 ? "s" : ""}` : null].filter(Boolean).join(" e ");
        txt(ctx, head, 90, 360, { size: 84, weight: 800, alpha: slideIn(t, 0.25) });
        list.forEach((im, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const start = 0.5 + i * 0.12;
          const p = seg(t, start, start + 0.7);
          const y = y0 + r * (pw * 1.5 + gap);
          const fall = (1 - E.back(p)) * -900;
          const rot = (1 - E.out(p)) * ((i % 2 ? 1 : -1) * 0.5) + Math.sin(t * 1.2 + i) * 0.015;
          poster(ctx, im, x0 + c * (pw + gap), y + fall, pw, { rot, alpha: clamp(p * 3), r: 20 });
        });
        grain(ctx, t);
      },
    });
  }

  // 4. Série do mês: fundo do backdrop com zoom lento, cor do pôster
  const top = S.ranking[0];
  if (top) {
    const bd = top.show.backdrop_path ? A.get(img(top.show.backdrop_path, "w1280")) : null;
    const pi = top.show.poster_path ? A.get(img(top.show.poster_path, "w500")) : null;
    const [r, g, b] = pi ? vivid(pi) : [35, 87, 198];
    const tint = `rgb(${r},${g},${b})`;
    scenes.push({
      k: "top", dur: 6,
      draw(ctx, t) {
        bg(ctx, C.night);
        const z = 1.12 + t * 0.025;
        ctx.save();
        ctx.translate(W / 2, 700);
        ctx.scale(z, z);
        cover(ctx, bd || pi, -W / 2, -700, W, 1400, 0, 0.75 * seg(t, 0, 0.8));
        ctx.restore();
        const gr = ctx.createLinearGradient(0, 300, 0, H);
        gr.addColorStop(0, "rgba(5,7,15,0)"); gr.addColorStop(0.45, `rgba(${r * 0.2 | 0},${g * 0.2 | 0},${b * 0.2 | 0},.92)`); gr.addColorStop(1, C.night);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        blob(ctx, W / 2, 1150, 700, `rgba(${r},${g},${b},.45)`, seg(t, 0.5, 1.5));
        eyebrow(ctx, "a série do mês", W / 2, 220, slideIn(t, 0.2), "#fff", "center");
        const pp = seg(t, 0.6, 1.4);
        poster(ctx, pi, W / 2 - 230, 330, 460, { scale: lerp(0.6, 1, E.back(pp)), alpha: pp, rot: Math.sin(t * 0.9) * 0.02, r: 28 });
        const { lines, size } = fitLines(ctx, top.show.title, W - 160, 104, 2);
        lines.forEach((l, i) => {
          const a = slideIn(t, 1.4 + i * 0.12);
          txt(ctx, l, W / 2, 1180 + i * size * 1.05 + (1 - a) * 40, { size, weight: 800, align: "center", alpha: a });
        });
        const y2 = 1180 + lines.length * size * 1.05 + 40;
        const a2 = slideIn(t, 2);
        rr(ctx, W / 2 - 260, y2 - 62, 520, 96, 48);
        ctx.save(); ctx.globalAlpha = a2; ctx.fillStyle = tint; ctx.fill(); ctx.restore();
        txt(ctx, `${top.n} episódio${top.n > 1 ? "s" : ""}`, W / 2, y2, { size: 52, weight: 800, align: "center", alpha: a2, color: (r * 0.3 + g * 0.6 + b * 0.1) > 150 ? C.ink : "#fff", base: "middle" });
        const share = S.eps ? Math.round((top.n / S.eps) * 100) : 0;
        if (share >= 30) txt(ctx, `${share}% de tudo que você viu no mês`, W / 2, y2 + 120, { size: 42, weight: 500, align: "center", alpha: slideIn(t, 2.6), color: "#D7E5FF" });
        grain(ctx, t);
      },
    });
  }

  // 5. Top 5
  if (S.ranking.length >= 3) {
    const list = S.ranking.slice(0, 5);
    const max = list[0].n;
    scenes.push({
      k: "top5", dur: 6,
      draw(ctx, t) {
        bg(ctx, C.papel);
        blob(ctx, 950, 260, 520, "rgba(255,122,168,.35)");
        blob(ctx, 120, 1700, 620, "rgba(110,168,255,.35)");
        eyebrow(ctx, "as mais assistidas", 90, 250, slideIn(t, 0.1), C.azul);
        txt(ctx, "Top 5 do mês", 90, 360, { size: 96, weight: 800, color: C.ink, alpha: slideIn(t, 0.2) });
        list.forEach((it, i) => {
          const y = 470 + i * 270;
          const s = 0.5 + i * 0.35;
          const a = slideIn(t, s, 0.55);
          const x = 90 + (1 - a) * 300;
          ctx.save(); ctx.globalAlpha = a;
          txt(ctx, String(i + 1), x + 40, y + 160, { size: 150, weight: 800, color: i === 0 ? C.stamp : C.azul, align: "center" });
          cover(ctx, P(it.show.poster_path), x + 120, y, 150, 225, 16);
          const { lines, size } = fitLines(ctx, it.show.title, 600, 54, 2, 700);
          lines.forEach((l, j) => txt(ctx, l, x + 310, y + 70 + j * size * 1.1, { size, weight: 700, color: C.ink }));
          const bw = 440 * (it.n / max) * E.out(seg(t, s + 0.3, s + 1.1));
          rr(ctx, x + 310, y + 160, Math.max(bw, 12), 24, 12); ctx.fillStyle = i === 0 ? C.stamp : C.azul; ctx.fill();
          txt(ctx, `${it.n} eps`, x + 310 + Math.max(bw, 12) + 18, y + 182, { size: 34, weight: 700, color: "#4A5375" });
          ctx.restore();
        });
        grain(ctx, t, 0.05);
      },
    });
  }

  // 6. Gênero
  if (S.topGenres.length) {
    const g0 = S.topGenres[0];
    scenes.push({
      k: "genero", dur: 5.5,
      draw(ctx, t) {
        bg(ctx, "#2A1660");
        blob(ctx, 300 + Math.sin(t * 0.9) * 160, 600 + Math.cos(t * 0.7) * 120, 650, "rgba(255,122,168,.6)");
        blob(ctx, 800 + Math.cos(t * 0.8) * 150, 1100 + Math.sin(t * 1.1) * 140, 700, "rgba(123,79,224,.8)");
        blob(ctx, 500 + Math.sin(t * 1.3) * 120, 1500, 600, "rgba(79,209,197,.45)");
        eyebrow(ctx, "o gênero do mês", W / 2, 420, slideIn(t, 0.1), "#FFD6E2", "center");
        const { lines, size } = fitLines(ctx, g0.g, W - 140, 190, 2);
        lines.forEach((l, i) => {
          const a = E.elastic(seg(t, 0.4 + i * 0.15, 1.6 + i * 0.15));
          ctx.save(); ctx.translate(W / 2, 700 + i * size); ctx.scale(a, a);
          txt(ctx, l, 0, 0, { size, weight: 800, align: "center", base: "middle" });
          ctx.restore();
        });
        const y0 = 700 + lines.length * size + 120;
        S.topGenres.forEach((g, i) => {
          const s = 1.8 + i * 0.3;
          const a = slideIn(t, s);
          const bw = 780 * (g.pct / 100) * E.out(seg(t, s, s + 1));
          const y = y0 + i * 150;
          txt(ctx, g.g, 150, y, { size: 44, weight: 700, alpha: a });
          txt(ctx, `${g.pct}%`, W - 150, y, { size: 44, weight: 800, alpha: a, align: "right" });
          ctx.save(); ctx.globalAlpha = a;
          rr(ctx, 150, y + 26, 780, 22, 11); ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fill();
          rr(ctx, 150, y + 26, Math.max(bw, 22), 22, 11); ctx.fillStyle = i === 0 ? "#FFD6E2" : "rgba(255,255,255,.7)"; ctx.fill();
          ctx.restore();
        });
        grain(ctx, t);
      },
    });
  }

  // 7. Dias da semana
  if (S.eps >= 3) {
    const max = Math.max(...S.perWeekday, 1);
    scenes.push({
      k: "dias", dur: 5.5,
      draw(ctx, t) {
        bg(ctx, C.stamp);
        blob(ctx, 900, 300, 600, "rgba(255,214,168,.7)");
        eyebrow(ctx, "dia preferido de maratona", 90, 250, slideIn(t, 0.1), C.ink);
        const { lines, size } = fitLines(ctx, WEEKDAYS[S.bestWeekday], W - 180, 170, 1);
        txt(ctx, lines[0], 90, 420, { size, weight: 800, color: C.ink, alpha: slideIn(t, 0.25) });
        const bx = 90, bw = (W - 180) / 7, base = 1450, hMax = 760;
        S.perWeekday.forEach((v, i) => {
          const p = E.back(seg(t, 0.6 + i * 0.09, 1.4 + i * 0.09));
          const h = Math.max(16, (v / max) * hMax * p);
          const best = i === S.bestWeekday;
          rr(ctx, bx + i * bw + 14, base - h, bw - 28, h, 22);
          ctx.fillStyle = best ? C.ink : "rgba(11,16,36,.25)"; ctx.fill();
          txt(ctx, WEEKDAYS[i].slice(0, 3), bx + i * bw + bw / 2, base + 70, { size: 38, weight: 700, color: C.ink, align: "center" });
          if (best) txt(ctx, String(v), bx + i * bw + bw / 2, base - h - 30, { size: 46, weight: 800, color: C.ink, align: "center", alpha: seg(t, 1.6, 2) });
        });
        if (S.bigDay && S.bigDay[1] >= 3) {
          const a = slideIn(t, 2.4);
          txt(ctx, `maior maratona: ${S.bigDay[0]}`, 90, 1700, { size: 46, weight: 600, color: C.ink, alpha: a });
          txt(ctx, `${S.bigDay[1]} episódios num dia só`, 90, 1770, { size: 46, weight: 800, color: C.ink, alpha: a });
        }
        grain(ctx, t, 0.05);
      },
    });
  }

  // 8. Filmes
  if (S.movies.length) {
    const list = S.movies.slice(0, 7);
    scenes.push({
      k: "filmes", dur: 5.5,
      draw(ctx, t) {
        bg(ctx, "#120A1E");
        blob(ctx, W / 2, 900, 800, "rgba(255,154,60,.28)");
        // feixe de projetor
        ctx.save();
        ctx.globalAlpha = 0.18 * seg(t, 0, 1);
        const beam = ctx.createLinearGradient(W / 2, 0, W / 2, 1200);
        beam.addColorStop(0, "rgba(255,240,210,1)"); beam.addColorStop(1, "rgba(255,240,210,0)");
        ctx.fillStyle = beam;
        ctx.beginPath(); ctx.moveTo(W / 2 - 40, 0); ctx.lineTo(W / 2 + 40, 0); ctx.lineTo(W + 200, 1300); ctx.lineTo(-200, 1300); ctx.closePath(); ctx.fill();
        ctx.restore();
        eyebrow(ctx, "e na sessão de cinema", W / 2, 250, slideIn(t, 0.1), "#FFD6A8", "center");
        txt(ctx, `${S.movies.length} filme${S.movies.length > 1 ? "s" : ""}`, W / 2, 380, { size: 110, weight: 800, align: "center", alpha: slideIn(t, 0.25) });
        const n = list.length;
        list.forEach((m, i) => {
          const p = E.back(seg(t, 0.6 + i * 0.12, 1.4 + i * 0.12));
          const k = n > 1 ? i / (n - 1) - 0.5 : 0;
          const ang = k * Math.min(0.9, n * 0.18) * p;
          const spread = Math.min(620, n * 170);
          const cx = W / 2 + k * spread * p, cy = 1050 + Math.abs(k) * 160 * p;
          poster(ctx, P(m.poster_path), cx - 170, cy - 255, 340, { rot: ang, alpha: clamp(p * 2), r: 20 });
        });
        if (S.topMovie && S.topMovie.rating > 0) {
          const a = slideIn(t, 2.4);
          eyebrow(ctx, "o favorito", W / 2, 1560, a, "#FFD6A8", "center");
          const { lines, size } = fitLines(ctx, S.topMovie.title, W - 160, 70, 1);
          txt(ctx, lines[0], W / 2, 1660, { size, weight: 800, align: "center", alpha: a });
          txt(ctx, "★".repeat(Math.floor(S.topMovie.rating)) + (S.topMovie.rating % 1 ? "½" : ""), W / 2, 1750, { size: 56, weight: 700, color: "#FFD27A", align: "center", alpha: a });
        }
        grain(ctx, t);
      },
    });
  }

  // 9. Finalizadas
  if (S.finished.length) {
    const list = S.finished.slice(0, 6);
    scenes.push({
      k: "fim", dur: 5,
      draw(ctx, t) {
        bg(ctx, "#0E3B3A");
        blob(ctx, 200, 400, 700, "rgba(79,209,197,.45)");
        eyebrow(ctx, "você chegou ao fim de", W / 2, 300, slideIn(t, 0.1), "#BFF3EC", "center");
        txt(ctx, String(countUp(S.finished.length, seg(t, 0.3, 1))), W / 2, 560, { size: 260, weight: 800, align: "center" });
        txt(ctx, S.finished.length > 1 ? "séries" : "série", W / 2, 680, { size: 70, weight: 700, align: "center", alpha: slideIn(t, 0.6) });
        const pw = list.length > 3 ? 280 : 320, gap = 30;
        const cols = Math.min(3, list.length);
        const gw = cols * pw + (cols - 1) * gap;
        list.forEach((f, i) => {
          const c = i % 3, r = Math.floor(i / 3);
          const x = (W - gw) / 2 + c * (pw + gap), y = 800 + r * (pw * 1.5 + gap);
          const p = seg(t, 0.8 + i * 0.15, 1.3 + i * 0.15);
          poster(ctx, P(f.poster_path), x, y, pw, { alpha: p, r: 18 });
          // carimbo
          const sp = seg(t, 1.5 + i * 0.15, 1.8 + i * 0.15);
          if (sp > 0) {
            ctx.save();
            ctx.translate(x + pw / 2, y + pw * 0.75);
            ctx.rotate(-0.25);
            const sc = lerp(2.2, 1, E.out(sp));
            ctx.scale(sc, sc);
            ctx.globalAlpha = sp;
            ctx.strokeStyle = C.stamp; ctx.lineWidth = 7;
            rr(ctx, -125, -38, 250, 76, 10); ctx.stroke();
            txt(ctx, "FINALIZADA", 0, 2, { size: 38, weight: 800, color: C.stamp, align: "center", base: "middle", track: 2 });
            ctx.restore();
          }
        });
        grain(ctx, t);
      },
    });
  }

  // 10. Tipo de espectadora
  scenes.push({
    k: "persona", dur: 5.5,
    draw(ctx, t) {
      bg(ctx, C.pink);
      blob(ctx, W / 2, 760, 700, "rgba(255,214,226,.9)", 0.8);
      // estrela/selo girando
      ctx.save();
      ctx.translate(W / 2, 760);
      ctx.rotate(t * 0.35);
      const s = E.elastic(seg(t, 0.3, 1.5));
      ctx.scale(s, s);
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, rad = i % 2 ? 250 : 300;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
      ctx.rotate(-t * 0.35);
      wordmark(ctx, 0, 40, 110, 1, 1);
      ctx.restore();
      eyebrow(ctx, "seu tipo de espectadora", W / 2, 300, slideIn(t, 0.1), C.ink, "center");
      const { lines, size } = fitLines(ctx, S.persona.t, W - 140, 120, 2);
      lines.forEach((l, i) => {
        const a = slideIn(t, 1.4 + i * 0.15);
        txt(ctx, l, W / 2, 1200 + i * size * 1.05 + (1 - a) * 50, { size, weight: 800, color: C.ink, align: "center", alpha: a });
      });
      const d = wrap(ctx, S.persona.d, W - 220, 46, 500);
      d.forEach((l, i) => txt(ctx, l, W / 2, 1220 + lines.length * size * 1.05 + 40 + i * 64, { size: 46, weight: 500, color: "#3A1830", align: "center", alpha: slideIn(t, 2.1 + i * 0.1) }));
      grain(ctx, t, 0.05);
    },
  });

  // 11. Resumo em um cartão
  scenes.push({
    k: "resumo", dur: 8,
    draw(ctx, t) {
      bg(ctx, C.night);
      blob(ctx, 250, 300, 700, "rgba(35,87,198,.6)");
      blob(ctx, 900, 1700, 700, "rgba(255,122,168,.35)");
      const a = slideIn(t, 0.1, 0.8);
      ctx.save();
      ctx.translate(0, (1 - a) * 80);
      ctx.globalAlpha = a;
      rr(ctx, 70, 170, W - 140, 1560, 56);
      const g = ctx.createLinearGradient(0, 170, 0, 1730);
      g.addColorStop(0, "#16255A"); g.addColorStop(1, "#0C1121");
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 3; ctx.stroke();
      wordmark(ctx, W / 2, 330, 110, 1, 1);
      txt(ctx, S.label, W / 2, 420, { size: 44, weight: 600, align: "center", color: C.azulClaro });
      const tp = S.ranking[0]?.show;
      if (tp) {
        poster(ctx, P(tp.poster_path), 140, 500, 330, { r: 24, rot: -0.03 });
        eyebrow(ctx, "série do mês", 520, 560, 1, C.azulClaro);
        const { lines, size } = fitLines(ctx, tp.title, 420, 62, 3);
        lines.forEach((l, i) => txt(ctx, l, 520, 650 + i * size * 1.08, { size, weight: 800 }));
        if (S.topGenres[0]) {
          eyebrow(ctx, "gênero", 520, 650 + lines.length * size * 1.08 + 50, 1, C.azulClaro);
          txt(ctx, S.topGenres[0].g, 520, 650 + lines.length * size * 1.08 + 120, { size: 50, weight: 700 });
        }
      }
      const stats = [
        ["horas", fmt(Math.round(S.hours))],
        ["episódios", fmt(S.eps)],
        ["séries", fmt(S.ranking.length)],
        ["filmes", fmt(S.movies.length)],
      ];
      stats.forEach(([k, v], i) => {
        const c = i % 2, r = Math.floor(i / 2);
        const x = 160 + c * 420, y = 1100 + r * 210;
        const p = seg(t, 0.6 + i * 0.15, 1.2 + i * 0.15);
        txt(ctx, v, x, y, { size: 110, weight: 800, alpha: p, color: i === 0 ? C.stamp : C.tinta });
        txt(ctx, k, x, y + 60, { size: 40, weight: 600, alpha: p, color: C.muted });
      });
      ctx.restore();
      const b = slideIn(t, 1.4);
      rr(ctx, W / 2 - 330, 1590 - (1 - b) * 20, 660, 96, 48);
      ctx.save(); ctx.globalAlpha = b; ctx.fillStyle = C.pink; ctx.fill(); ctx.restore();
      txt(ctx, S.persona.t, W / 2, 1640 - (1 - b) * 20, { size: 44, weight: 800, color: C.ink, align: "center", base: "middle", alpha: b });
      txt(ctx, "domi tv · até o mês que vem", W / 2, 1830, { size: 34, weight: 600, color: C.muted, align: "center", alpha: slideIn(t, 2) });
      grain(ctx, t);
    },
  });

  return scenes;
}

export function totalDuration(scenes) {
  return scenes.reduce((a, s) => a + s.dur, 0);
}

/** Desenha o instante global T (segundos desde o início) com um corte rápido entre cenas. */
export function drawAt(ctx, scenes, T) {
  let acc = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (T < acc + s.dur || i === scenes.length - 1) {
      const t = Math.min(T - acc, s.dur);
      s.draw(ctx, t);
      // flash curtinho na troca de cena
      if (i > 0 && t < 0.18) { ctx.save(); ctx.globalAlpha = 1 - t / 0.18; ctx.fillStyle = "#fff"; ctx.globalCompositeOperation = "overlay"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      return i;
    }
    acc += s.dur;
  }
  return scenes.length - 1;
}

/** Escolhe o formato de vídeo: mp4 quando o navegador grava (Chrome novo, Safari), senão webm. */
export function videoMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return null;
}

/** Grava todas as cenas em tempo real num canvas fora da tela e devolve o arquivo de vídeo. */
export function recordVideo(scenes, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const mime = videoMime();
    if (!mime) return reject(new Error("Esse navegador não grava vídeo."));
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    cv.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    drawAt(ctx, scenes, 0);
    const stream = cv.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const total = totalDuration(scenes);
    let raf = 0, t0 = 0, stopped = false;
    const cleanup = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((tr) => tr.stop()); cv.remove(); };
    rec.onstop = () => {
      cleanup();
      if (signal?.aborted) return reject(new Error("cancelado"));
      const type = mime.split(";")[0];
      resolve(new Blob(chunks, { type }));
    };
    rec.onerror = (e) => { cleanup(); reject(e.error || new Error("Falha ao gravar")); };
    const stop = () => { if (!stopped) { stopped = true; try { rec.stop(); } catch {} } };
    signal?.addEventListener("abort", stop);
    const frame = (now) => {
      if (!t0) t0 = now;
      const T = (now - t0) / 1000;
      drawAt(ctx, scenes, Math.min(T, total));
      onProgress?.(Math.min(1, T / total));
      if (T >= total + 0.3) return stop();
      raf = requestAnimationFrame(frame);
    };
    rec.start(250);
    raf = requestAnimationFrame(frame);
  });
}

/** Foto do cartão final (para quem preferir imagem). */
export function summaryImage(scenes) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const last = scenes[scenes.length - 1];
  last.draw(cv.getContext("2d"), last.dur);
  return new Promise((res) => cv.toBlob(res, "image/png"));
}
