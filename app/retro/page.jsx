"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDomi } from "@/components/Shell";
import { sb } from "@/lib/supabase";
import { MONTHS } from "@/lib/constants";
import { W, H, storyData, storyImages, loadImages, buildScenes, drawAt, totalDuration, recordVideo, summaryImage, videoMime } from "@/lib/story";

function monthsBack(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push({ y: d.getFullYear(), m: d.getMonth() });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Toca as cenas no canvas: toque na direita avança, na esquerda volta, segurar pausa. */
function StoryPlayer({ scenes, paused = false }) {
  const canvas = useRef(null);
  const bars = useRef([]);
  const T = useRef(0);
  const playing = useRef(true);
  const held = useRef(false);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const starts = useMemo(() => { let a = 0; return scenes.map((s) => { const v = a; a += s.dur; return v; }); }, [scenes]);
  const total = useMemo(() => totalDuration(scenes), [scenes]);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext("2d");
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const px = Math.min(W, Math.round(r.width * Math.min(2, window.devicePixelRatio || 1)));
      if (cv.width !== px) { cv.width = px; cv.height = Math.round(px * (H / W)); }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    let raf = 0, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing.current && !held.current && !pausedRef.current && !document.hidden) T.current = Math.min(total, T.current + dt);
      ctx.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
      const i = drawAt(ctx, scenes, T.current);
      bars.current.forEach((b, k) => {
        if (!b) return;
        const p = k < i ? 1 : k > i ? 0 : (T.current - starts[k]) / scenes[k].dur;
        b.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
      });
      const isEnd = T.current >= total;
      if (isEnd !== endedRef.current) { endedRef.current = isEnd; setEnded(isEnd); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [scenes]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = () => { let i = 0; for (let k = 0; k < starts.length; k++) if (T.current >= starts[k]) i = k; return i; };
  const jump = (dir) => {
    const i = current();
    const t = T.current - starts[i];
    const to = dir > 0 ? Math.min(scenes.length - 1, i + 1) : t > 1 ? i : Math.max(0, i - 1);
    if (dir > 0 && i === scenes.length - 1) { T.current = total; return; }
    T.current = starts[to];
    playing.current = true;
  };

  const press = useRef({ t: 0, x: 0 });
  const down = (e) => { press.current = { t: performance.now(), x: e.clientX }; held.current = true; };
  const up = (e) => {
    held.current = false;
    if (performance.now() - press.current.t > 250) return; // foi uma pausa segurando
    const r = e.currentTarget.getBoundingClientRect();
    jump(e.clientX - r.left < r.width * 0.33 ? -1 : 1);
  };
  const key = (e) => {
    if (e.key === "ArrowRight") jump(1);
    if (e.key === "ArrowLeft") jump(-1);
    if (e.key === " ") { e.preventDefault(); playing.current = !playing.current; }
  };
  const replay = () => { T.current = 0; playing.current = true; };

  return (
    <div className="story2" tabIndex={0} onKeyDown={key} aria-label="Retrospectiva. Toque na direita para avançar, na esquerda para voltar, segure para pausar.">
      <canvas ref={canvas} className="story2-cv" />
      <div className="story2-bars" aria-hidden="true">
        {scenes.map((s, k) => <span key={s.k}><i ref={(el) => (bars.current[k] = el)} /></span>)}
      </div>
      <div className="story2-tap" onPointerDown={down} onPointerUp={up} onPointerCancel={() => (held.current = false)} onPointerLeave={() => (held.current = false)} onContextMenu={(e) => e.preventDefault()} />
      {ended && <button type="button" className="story2-replay" onClick={replay}>Ver de novo</button>}
    </div>
  );
}

export default function Retro() {
  const { shows, movies, profile, say } = useDomi();
  const options = useMemo(() => monthsBack(12), []);
  const [pick, setPick] = useState(() => (new Date().getDate() <= 7 ? 1 : 0)); // na primeira semana, mostra o mês que acabou
  const [eps, setEps] = useState(null);
  const [assets, setAssets] = useState(null);
  const [rec, setRec] = useState(null); // { p } enquanto grava
  const [file, setFile] = useState(null);
  const abort = useRef(null);

  const { y, m } = options[pick];
  const label = `${MONTHS[m]} de ${y}`;

  useEffect(() => {
    setEps(null); setAssets(null); setFile(null);
    const from = new Date(y, m, 1).toISOString();
    const to = new Date(y, m + 1, 1).toISOString();
    sb().from("episodes_watched").select("tmdb_show_id,runtime,watched_at").gte("watched_at", from).lt("watched_at", to).range(0, 9999)
      .then(({ data }) => setEps(data || []));
  }, [y, m]);

  const S = useMemo(() => {
    if (!eps || !shows || !movies) return undefined;
    const from = new Date(y, m, 1).getTime(), to = new Date(y, m + 1, 1).getTime();
    const first = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const finished = shows.filter((s) => s.finished_at && s.finished_at >= first && s.finished_at <= last);
    const monthMovies = movies.filter((mv) => mv.status === "visto" && mv.watched_at && Date.parse(mv.watched_at) >= from && Date.parse(mv.watched_at) < to);
    if (!eps.length && !finished.length && !monthMovies.length) return null;
    return storyData({ eps, shows, movies: monthMovies, finished, label, name: profile?.name });
  }, [eps, shows, movies, y, m, label, profile?.name]);

  useEffect(() => {
    if (!S) return;
    let alive = true;
    const fontsReady = document.fonts ? Promise.all([document.fonts.load(`800 100px Poppins`), document.fonts.load(`700 60px Poppins`), document.fonts.load(`500 40px Poppins`)]).catch(() => {}) : Promise.resolve();
    Promise.all([loadImages(storyImages(S)), fontsReady]).then(([map]) => { if (alive) setAssets(map); });
    return () => { alive = false; };
  }, [S]);

  const scenes = useMemo(() => (S && assets ? buildScenes(S, assets) : null), [S, assets]);
  const slug = `domi-tv-${MONTHS[m]}-${y}`;

  const deliver = async (blob, name) => {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: `Retrospectiva de ${label}` }); return; } catch (e) { if (e?.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const makeVideo = async () => {
    if (!scenes || rec) return;
    if (!videoMime()) return say("Esse navegador não grava vídeo. Tente no Chrome ou no Safari atualizado.");
    abort.current = new AbortController();
    setRec({ p: 0 });
    try {
      const blob = await recordVideo(scenes, (p) => setRec({ p }), abort.current.signal);
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      setFile({ blob, name: `${slug}.${ext}` });
    } catch (e) {
      if (e?.message !== "cancelado") say("Não consegui gravar o vídeo.");
    } finally {
      setRec(null);
    }
  };

  const makeImage = async () => {
    if (!scenes) return;
    const blob = await summaryImage(scenes);
    if (blob) deliver(blob, `${slug}.png`);
  };

  return (
    <section className="retro">
      <div className="retro-head">
        <h1 className="h-display">Retrospectiva</h1>
        <div className="chips scroll" role="group" aria-label="Escolher mês">
          {options.map((o, idx) => (
            <button key={idx} type="button" className="chip" aria-pressed={pick === idx} disabled={!!rec} onClick={() => setPick(idx)}>
              {MONTHS[o.m].slice(0, 3)} {String(o.y).slice(2)}
            </button>
          ))}
        </div>
      </div>

      {S === null && (
        <div className="empty"><p className="hand">nada gravado em {label}</p><p>Marque episódios e filmes e a retrospectiva desse mês aparece aqui.</p></div>
      )}
      {S !== null && !scenes && (
        <div className="story2 story2-loading" role="status"><div className="qz-reel" aria-hidden="true"><i /><i /><i /></div><p>rebobinando a fita…</p></div>
      )}
      {scenes && (
        <>
          <StoryPlayer key={`${y}-${m}`} scenes={scenes} paused={!!rec} />
          <div className="retro-actions">
            {file ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => deliver(file.blob, file.name)}>Compartilhar vídeo</button>
                <button type="button" className="btn btn-ghost" onClick={() => setFile(null)}>Gravar de novo</button>
              </>
            ) : rec ? (
              <div className="rec-box" role="status">
                <span className="rec-dot" aria-hidden="true" />
                <span>gravando… {Math.round(rec.p * 100)}%</span>
                <span className="rec-bar"><i style={{ transform: `scaleX(${rec.p})` }} /></span>
                <button type="button" className="btn btn-ghost" onClick={() => abort.current?.abort()}>Cancelar</button>
              </div>
            ) : (
              <>
                <button type="button" className="btn btn-primary" onClick={makeVideo}>Salvar vídeo pro story</button>
                <button type="button" className="btn btn-ghost" onClick={makeImage}>Salvar só o cartão</button>
              </>
            )}
          </div>
          {rec && <p className="muted retro-note">O vídeo grava em tempo real (uns {Math.round(totalDuration(scenes))} segundos). Deixe essa tela aberta até terminar.</p>}
        </>
      )}
    </section>
  );
}
