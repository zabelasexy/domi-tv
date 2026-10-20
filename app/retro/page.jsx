"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDomi } from "@/components/Shell";
import Wordmark from "@/components/Wordmark";
import { img } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";
import { MONTHS, WEEKDAYS } from "@/lib/constants";

const SLIDE_MS = 6000;

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

function buildSlides(eps, shows, finished, label) {
  if (!eps.length && !finished.length) return null;
  const byId = new Map(shows.map((s) => [s.tmdb_id, s]));
  const minutes = eps.reduce((a, e) => a + (e.runtime || 0), 0);

  const perShow = new Map();
  eps.forEach((e) => perShow.set(e.tmdb_show_id, (perShow.get(e.tmdb_show_id) || 0) + 1));
  const ranking = [...perShow.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ show: byId.get(id), n })).filter((r) => r.show);

  const genres = new Map();
  ranking.forEach(({ show, n }) => (show.genres || []).forEach((g) => genres.set(g, (genres.get(g) || 0) + n)));
  const topGenre = [...genres.entries()].sort((a, b) => b[1] - a[1])[0];

  const perWeekday = Array(7).fill(0);
  const perDay = new Map();
  eps.forEach((e) => {
    const d = new Date(e.watched_at);
    perWeekday[d.getDay()]++;
    const key = d.toLocaleDateString("pt-BR");
    perDay.set(key, (perDay.get(key) || 0) + 1);
  });
  const bestWeekday = perWeekday.indexOf(Math.max(...perWeekday));
  const bigDay = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];

  const slides = [{ k: "cover" }];
  if (eps.length) slides.push({ k: "numbers", eps: eps.length, hours: Math.round(minutes / 60), minutes });
  if (ranking[0]) slides.push({ k: "top", ...ranking[0], rest: ranking.slice(1, 5) });
  if (topGenre) slides.push({ k: "genre", genre: topGenre[0], n: topGenre[1] });
  if (eps.length) slides.push({ k: "days", weekday: WEEKDAYS[bestWeekday], bigDay });
  if (finished.length) slides.push({ k: "finished", list: finished });
  const ship = ranking.find((r) => r.show.ship)?.show;
  if (ship) slides.push({ k: "ship", show: ship });
  slides.push({ k: "end", eps: eps.length, shows: ranking.length, finished: finished.length, hours: Math.round(minutes / 60), top: ranking[0]?.show, genre: topGenre?.[0] });
  return slides.map((s) => ({ ...s, label }));
}

function Slide({ s }) {
  switch (s.k) {
    case "cover":
      return (<div className="sl sl-cover"><Wordmark animated className="sl-logo" /><p className="eyebrow">sua retrospectiva de</p><h2>{s.label}</h2><p className="muted">toque para continuar</p></div>);
    case "numbers":
      return (<div className="sl sl-numbers"><p className="eyebrow">nesse mês você assistiu</p><p className="mega">{s.eps}</p><p className="big">episódios</p><p className="sub">dá <b>{s.hours}h</b> de tela. {s.hours >= 24 ? "Mais de um dia inteiro sem piscar." : s.hours >= 10 ? "Um bom punhado de maratonas." : "No ritmo certinho."}</p></div>);
    case "top":
      return (
        <div className="sl sl-top">
          <div className="sl-glow" style={{ backgroundImage: `url(${img(s.show.poster_path, "w185")})` }} />
          <p className="eyebrow">a série do mês</p>
          {s.show.poster_path && <img className="sl-poster" src={img(s.show.poster_path, "w500")} alt="" />}
          <h2>{s.show.title}</h2>
          <p className="sub">{s.n} episódios só dela</p>
          {s.rest.length > 0 && <ol className="sl-rank">{s.rest.map((r, i) => <li key={r.show.tmdb_id}><b>{i + 2}</b>{r.show.title}<span>{r.n} eps</span></li>)}</ol>}
        </div>
      );
    case "genre":
      return (<div className="sl sl-genre"><p className="eyebrow">seu gênero do mês</p><h2 className="mega-word">{s.genre}</h2><p className="sub">{s.n} episódios nessa vibe</p></div>);
    case "days":
      return (<div className="sl sl-days"><p className="eyebrow">dia preferido de maratona</p><h2 className="mega-word">{s.weekday}</h2>{s.bigDay && <p className="sub">e em <b>{s.bigDay[0]}</b> você viu <b>{s.bigDay[1]}</b> episódios num dia só.</p>}</div>);
    case "finished":
      return (<div className="sl sl-fin"><p className="eyebrow">você terminou</p><p className="mega">{s.list.length}</p><p className="big">{s.list.length > 1 ? "séries" : "série"}</p><div className="sl-strip">{s.list.slice(0, 6).map((x) => x.poster_path ? <img key={x.tmdb_id} src={img(x.poster_path, "w185")} alt={x.title} /> : null)}</div></div>);
    case "ship":
      return (<div className="sl sl-ship"><p className="eyebrow">o shipp do mês</p><h2 className="mega-word">{s.show.ship}</h2><p className="sub">direto de {s.show.title}</p></div>);
    case "end":
      return (
        <div className="sl sl-end">
          <p className="eyebrow">{s.label} em uma tela</p>
          <div className="sl-card">
            <Wordmark className="sl-card-logo" />
            <dl>
              <div><dt>episódios</dt><dd>{s.eps}</dd></div>
              <div><dt>horas</dt><dd>{s.hours}</dd></div>
              <div><dt>séries</dt><dd>{s.shows}</dd></div>
              <div><dt>finalizadas</dt><dd>{s.finished}</dd></div>
            </dl>
            {s.top && <p>série do mês: <b>{s.top.title}</b></p>}
            {s.genre && <p>gênero: <b>{s.genre}</b></p>}
          </div>
          <p className="muted">até o mês que vem 📺</p>
        </div>
      );
    default:
      return null;
  }
}

export default function Retro() {
  const { shows } = useDomi();
  const options = useMemo(() => monthsBack(12), []);
  const [pick, setPick] = useState(() => {
    const d = new Date();
    return d.getDate() <= 7 ? 1 : 0; // na primeira semana, mostra o mês que acabou
  });
  const [data, setData] = useState(null);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  const { y, m } = options[pick];
  const label = `${MONTHS[m]} de ${y}`;

  useEffect(() => {
    setData(null);
    const from = new Date(y, m, 1).toISOString();
    const to = new Date(y, m + 1, 1).toISOString();
    sb().from("episodes_watched").select("tmdb_show_id,runtime,watched_at").gte("watched_at", from).lt("watched_at", to).range(0, 9999)
      .then(({ data: eps }) => setData(eps || []));
  }, [y, m]);

  const slides = useMemo(() => {
    if (!data || !shows) return undefined;
    const first = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const finished = shows.filter((s) => s.finished_at && s.finished_at >= first && s.finished_at <= last);
    return buildSlides(data, shows, finished, label);
  }, [data, shows, y, m, label]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!playing || !slides) return;
    timer.current = setTimeout(() => {
      if (i < slides.length - 1) setI(i + 1);
      else setPlaying(false);
    }, SLIDE_MS);
    return () => clearTimeout(timer.current);
  }, [i, playing, slides]);

  const go = (dir) => {
    if (!slides) return;
    setPlaying(true);
    setI((v) => Math.max(0, Math.min(slides.length - 1, v + dir)));
  };

  return (
    <section className="retro">
      <div className="retro-head">
        <h1 className="h-display">Retrospectiva</h1>
        <div className="chips scroll" role="group" aria-label="Escolher mês">
          {options.map((o, idx) => (
            <button key={idx} type="button" className="chip" aria-pressed={pick === idx} onClick={() => { setPick(idx); setI(0); setPlaying(false); }}>
              {MONTHS[o.m].slice(0, 3)} {String(o.y).slice(2)}
            </button>
          ))}
        </div>
      </div>

      {slides === undefined && <div className="loading">rebobinando a fita…</div>}
      {slides === null && (
        <div className="empty"><p className="hand">nada gravado em {label}</p><p>Marque episódios nas séries e a retrospectiva desse mês aparece aqui.</p></div>
      )}
      {slides && (
        <div className={`story s-${slides[i].k}`}>
          <div className="story-bars">
            {slides.map((_, idx) => (
              <span key={idx} className={idx < i ? "done" : idx === i ? (playing ? "run" : "cur") : ""}>
                <i style={idx === i && playing ? { animationDuration: `${SLIDE_MS}ms` } : undefined} key={`${idx}-${i}-${playing}`} />
              </span>
            ))}
          </div>
          <Slide s={slides[i]} />
          <button type="button" className="tap left" aria-label="Anterior" onClick={() => go(-1)} />
          <button type="button" className="tap right" aria-label="Próximo" onClick={() => go(1)} />
        </div>
      )}
    </section>
  );
}
