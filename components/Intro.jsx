"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Wordmark from "./Wordmark";

const FILLS = [
  "linear-gradient(160deg,#3F7BFF,#0D1938)", "linear-gradient(200deg,#9CC2FF,#2357C6 70%)",
  "linear-gradient(170deg,#F4F1EA,#C9D3E6)", "linear-gradient(150deg,#FF9A3C,#B33A2A)",
  "linear-gradient(190deg,#1A3F93,#07102A)", "linear-gradient(160deg,#A9D6C2,#2E6B5A)",
];
const TAGS = ["gravando tudo que eu assisto", "só mais um episódio", "volto pra você, prometo", "eu sabia desde o ep 1", "dormir é para os fracos"];

export function Grain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let img, raf, frame = 0;
    const size = () => {
      canvas.width = Math.ceil(innerWidth / 3);
      canvas.height = Math.ceil(innerHeight / 3);
      img = ctx.createImageData(canvas.width, canvas.height);
    };
    size();
    addEventListener("resize", size);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      if (frame++ % 2 === 0) {
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        ctx.putImageData(img, 0, 0);
      }
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, []);
  return <canvas ref={ref} className="grain" aria-hidden="true" />;
}

/** Parede inclinada de pôsteres: os dela; se ainda tiver poucos, os em alta da semana. */
function PosterWall({ posters }) {
  const [trend, setTrend] = useState([]);
  useEffect(() => {
    if (posters.length >= 12) return;
    fetch("/api/wall").then((r) => (r.ok ? r.json() : { posters: [] })).then((d) => setTrend(d.posters || [])).catch(() => {});
  }, [posters.length]);

  const list = useMemo(() => {
    const mine = posters || [];
    return mine.length >= 12 ? mine : [...mine, ...trend];
  }, [posters, trend]);

  const cols = useMemo(() => {
    const out = [];
    for (let c = 0; c < 10; c++) {
      const tiles = [];
      for (let r = 0; r < 6; r++) {
        const i = c * 6 + r;
        tiles.push(list.length ? { src: list[i % list.length] } : { fill: FILLS[(c * 3 + r) % FILLS.length] });
      }
      out.push(tiles);
    }
    return out;
  }, [list]);

  return (
    <div className="wall" aria-hidden="true">
      {cols.map((tiles, c) => (
        <div key={c} className={`col ${c % 2 ? "down" : "up"}`} style={{ animationDuration: `${34 + ((c * 7) % 14)}s` }}>
          {[...tiles, ...tiles].map((t, i) => (
            <div key={i} className="tile" style={t.fill ? { background: t.fill } : undefined}>
              {t.src && <img src={t.src} alt="" loading="lazy" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Timecode() {
  const [t, setT] = useState("00:00:00:00");
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => {
      const ms = performance.now() - t0;
      const s = Math.floor(ms / 1000);
      const f = Math.floor(((ms % 1000) / 1000) * 24);
      setT(`00:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(f).padStart(2, "0")}`);
    }, 42);
    return () => clearInterval(id);
  }, []);
  return <div className="hud tc">{t}</div>;
}

/** Abertura: câmera gravando. O visor foca na parede de pôsteres, REC, carimbo de data e o logo. */
export default function Intro({ posters = [], onEnter, children, enterLabel = "Entrar" }) {
  const [ready, setReady] = useState(false);
  const [tag, setTag] = useState(0);
  useEffect(() => { const t = setTimeout(() => setReady(true), 3800); return () => clearTimeout(t); }, []);
  const date = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).replace(/\./g, "").replace(/ de /g, " ").toUpperCase(),
    []
  );

  return (
    <div className="intro play">
      <PosterWall posters={posters} />
      <div className="vignette" />
      <div className="vf" aria-hidden="true">
        <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
        <div className="hud rec"><i />REC</div>
        <div className="hud bat">▮▮▮▯</div>
        <div className="hud date">{date}</div>
        <Timecode />
      </div>
      <div className="intro-center">
        <button type="button" className="intro-logo" onClick={() => setTag((t) => (t + 1) % TAGS.length)} aria-label="Domi TV">
          <Wordmark animated />
        </button>
        <p className="intro-tag">{TAGS[tag]}</p>
        <div className="intro-actions">
          {children}
          {onEnter && (
            <button className={`btn btn-primary intro-enter ${ready ? "on" : ""}`} onClick={onEnter} type="button">{enterLabel}</button>
          )}
        </div>
      </div>
      <Grain />
    </div>
  );
}
