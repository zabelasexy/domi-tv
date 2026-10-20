"use client";
import { img } from "./tmdb";

function load(src) {
  return new Promise((resolve) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

function roundRect(x, X, Y, W, H, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
}

/** Desenha o logo (d ▶ m i) no canvas. */
function drawWordmark(x, cx, y, size) {
  x.font = `700 ${size}px Poppins, system-ui, sans-serif`;
  const wd = x.measureText("d").width, wmi = x.measureText("mi").width, o = size * 0.64, gap = size * 0.03;
  const total = wd + o + wmi + gap * 2;
  let X = cx - total / 2;
  x.fillStyle = "#fff";
  x.textBaseline = "alphabetic";
  x.fillText("d", X, y);
  X += wd + gap;
  const oy = y - size * 0.34;
  const g = x.createRadialGradient(X + o * 0.35, oy - o * 0.2, 2, X + o / 2, oy, o / 2);
  g.addColorStop(0, "#7FA8FF"); g.addColorStop(1, "#2357C6");
  x.fillStyle = g;
  x.beginPath(); x.arc(X + o / 2, oy, o / 2, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#fff";
  x.beginPath(); x.moveTo(X + o * 0.4, oy - o * 0.2); x.lineTo(X + o * 0.68, oy); x.lineTo(X + o * 0.4, oy + o * 0.2); x.closePath(); x.fill();
  X += o + gap;
  x.fillText("mi", X, y);
}

/** Gera o card 9:16 do perfil para stories. Compartilha quando o aparelho deixa; senão baixa. */
export async function shareCard({ name, stats, top4, genres, patchCount }) {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  await document.fonts?.ready;

  const bg = x.createRadialGradient(W / 2, 380, 50, W / 2, 700, 1300);
  bg.addColorStop(0, "#2357C6"); bg.addColorStop(0.45, "#10235C"); bg.addColorStop(1, "#04091C");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);

  drawWordmark(x, W / 2, 230, 110);
  x.textAlign = "center";
  x.fillStyle = "#9CC2FF"; x.font = "600 30px Poppins, sans-serif";
  x.fillText("M E U   C A N A L   D E   S É R I E S", W / 2, 300);

  x.fillStyle = "#fff"; x.font = "800 96px Poppins, sans-serif";
  x.fillText(name, W / 2, 470);

  const posters = await Promise.all(top4.slice(0, 4).map((s) => (s.poster_path ? load(img(s.poster_path, "w342")) : null)));
  const pw = 210, ph = 315, gap = 26, total = posters.length * pw + (posters.length - 1) * gap;
  posters.forEach((p, i) => {
    const X = W / 2 - total / 2 + i * (pw + gap), Y = 560;
    x.save(); roundRect(x, X, Y, pw, ph, 22); x.clip();
    if (p) x.drawImage(p, X, Y, pw, ph); else { x.fillStyle = "#13224A"; x.fillRect(X, Y, pw, ph); }
    x.restore();
  });

  const items = [[stats.series, "séries"], [stats.eps, "episódios"], [stats.hours, "horas"], [patchCount, "patches"]];
  items.forEach(([v, l], i) => {
    const X = 150 + (i % 2) * 420 + 120, Y = 1060 + Math.floor(i / 2) * 230;
    x.fillStyle = "#fff"; x.font = "800 110px Poppins, sans-serif";
    x.fillText(Number(v).toLocaleString("pt-BR"), X, Y);
    x.fillStyle = "#8C9BC8"; x.font = "600 34px Poppins, sans-serif";
    x.fillText(l.toUpperCase(), X, Y + 52);
  });

  if (genres[0]) {
    x.fillStyle = "#FF9A3C"; x.font = "600 40px 'Share Tech Mono', monospace";
    x.fillText(`gênero do coração: ${genres[0].n.toLowerCase()}`, W / 2, 1600);
  }
  x.fillStyle = "#8C9BC8"; x.font = "500 30px Poppins, sans-serif";
  x.fillText("domi tv", W / 2, 1800);

  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "domi-tv.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Domi TV" }); return "shared"; } catch { return "cancelled"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "domi-tv.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}
