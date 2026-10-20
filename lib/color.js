"use client";
import { useEffect, useState } from "react";

const cache = new Map();

/** Cor marcante do pôster (a mais saturada e viva), para tingir a página da série. */
export function usePosterColor(url) {
  const [rgb, setRgb] = useState(() => (url ? cache.get(url) || null : null));
  useEffect(() => {
    if (!url) return;
    if (cache.has(url)) { setRgb(cache.get(url)); return; }
    let alive = true;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 24; c.height = 36;
        const x = c.getContext("2d");
        x.drawImage(im, 0, 0, 24, 36);
        const d = x.getImageData(0, 0, 24, 36).data;
        let best = null, bestScore = -1, sr = 0, sg = 0, sb = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max ? (max - min) / max : 0;
          const light = (max + min) / 510;
          const score = sat * (1 - Math.abs(light - 0.55) * 1.6);
          sr += r; sg += g; sb += b; n++;
          if (score > bestScore) { bestScore = score; best = [r, g, b]; }
        }
        let out = bestScore > 0.25 ? best : [sr / n, sg / n, sb / n];
        // garante brilho suficiente para ler texto escuro/claro por cima
        const lum = (0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]) / 255;
        if (lum < 0.35) { const k = 0.35 / Math.max(lum, 0.05); out = out.map((v) => Math.min(255, v * k)); }
        out = out.map(Math.round);
        cache.set(url, out);
        if (alive) setRgb(out);
      } catch {
        cache.set(url, null);
      }
    };
    im.src = url;
    return () => { alive = false; };
  }, [url]);
  return rgb;
}

export function accentVars(rgb) {
  if (!rgb) return undefined;
  const [r, g, b] = rgb;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return {
    "--accent": `rgb(${r}, ${g}, ${b})`,
    "--accent-soft": `rgba(${r}, ${g}, ${b}, .16)`,
    "--accent-glow": `rgba(${r}, ${g}, ${b}, .45)`,
    "--on-accent": lum > 0.6 ? "#08102B" : "#fff",
  };
}
