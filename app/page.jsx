"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { Empty } from "@/components/bits";
import { tmdb, img } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";
import { MONTHS, GENRES } from "@/lib/constants";

const SLIDE_MS = 8000;

/** Próximo episódio a partir do último marcado e da lista de temporadas do TMDB. */
function nextEpisode(watchedOfShow, seasons) {
  const real = (seasons || []).filter((s) => s.season_number > 0 && s.episode_count > 0);
  if (!real.length) return null;
  if (!watchedOfShow.length) return { season: real[0].season_number, episode: 1 };
  const last = watchedOfShow.reduce((a, e) => (e.season > a.season || (e.season === a.season && e.episode > a.episode) ? e : a));
  const cur = real.find((s) => s.season_number === last.season);
  if (cur && last.episode < cur.episode_count) return { season: last.season, episode: last.episode + 1 };
  const nxt = real.find((s) => s.season_number > last.season);
  return nxt ? { season: nxt.season_number, episode: 1 } : null;
}

function pickLogo(images) {
  const logos = images?.logos || [];
  return (logos.find((l) => l.iso_639_1 === "pt") || logos.find((l) => l.iso_639_1 === "en") || logos.find((l) => !l.iso_639_1) || logos[0])?.file_path || null;
}

function Row({ title, eyebrow, href, children, className = "" }) {
  const track = useRef(null);
  const scroll = (dir) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className={`hrow ${className}`}>
      <div className="hrow-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        <div className="hrow-tools">
          {href && <Link href={href} className="see-all">ver tudo</Link>}
          <button type="button" className="hrow-arrow" onClick={() => scroll(-1)} aria-label="Voltar fileira">‹</button>
          <button type="button" className="hrow-arrow" onClick={() => scroll(1)} aria-label="Avançar fileira">›</button>
        </div>
      </div>
      <div className="hrow-track" ref={track}>{children}</div>
    </section>
  );
}

function PosterTile({ id, title, poster, label, mine }) {
  return (
    <Link href={`/serie/${id}`} className="ptile">
      <div className="ptile-img">
        {poster ? <img src={img(poster)} alt="" loading="lazy" /> : <div className="noposter"><span>{title}</span></div>}
        {mine && <span className="ptile-badge">na coleção</span>}
      </div>
      <span className="ptile-t">{title}</span>
      {label && <span className="ptile-l">{label}</span>}
    </Link>
  );
}

export default function Home() {
  const { shows, eps, byTmdb, epsChanged, saveShow, say, profile } = useDomi();
  const [slides, setSlides] = useState([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [recs, setRecs] = useState(null);
  const [trending, setTrending] = useState(null);
  const [busy, setBusy] = useState(false);

  const watchedBy = useMemo(() => {
    const m = new Map();
    for (const e of eps || []) {
      const a = m.get(e.tmdb_show_id) || [];
      a.push(e);
      m.set(e.tmdb_show_id, a);
    }
    return m;
  }, [eps]);
  const lastWatch = (id) => (watchedBy.get(id) || []).reduce((a, e) => (e.watched_at > a ? e.watched_at : a), "");

  const watching = useMemo(
    () => (shows || []).filter((s) => s.status === "assistindo").sort((a, b) => (lastWatch(b.tmdb_id) || b.updated_at).localeCompare(lastWatch(a.tmdb_id) || a.updated_at)),
    [shows, watchedBy] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // billboard: as que ela está vendo + favoritas + as mais bem avaliadas
  const heroPool = useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (s) => { if (s && !seen.has(s.tmdb_id)) { seen.add(s.tmdb_id); out.push(s); } };
    watching.slice(0, 3).forEach(add);
    (shows || []).filter((s) => s.favorite).sort(() => Math.random() - 0.5).slice(0, 2).forEach(add);
    (shows || []).filter((s) => s.rating >= 5).sort(() => Math.random() - 0.5).slice(0, 2).forEach(add);
    if (!out.length) (shows || []).slice(0, 3).forEach(add);
    return out.slice(0, 5);
  }, [shows?.length, watching[0]?.tmdb_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!heroPool.length) return;
    let alive = true;
    Promise.all(heroPool.map((s) =>
      tmdb(`tv/${s.tmdb_id}`, { append_to_response: "images", include_image_language: "pt,en,null" })
        .then((d) => ({ show: s, d, logo: pickLogo(d.images), backdrop: d.backdrop_path || d.images?.backdrops?.[0]?.file_path || s.backdrop_path }))
        .catch(() => ({ show: s, d: null, logo: null, backdrop: s.backdrop_path }))
    )).then((list) => { if (alive) setSlides(list); });
    return () => { alive = false; };
  }, [heroPool]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused, slides.length]);

  const seed = useMemo(() => {
    const loved = (shows || []).filter((s) => s.rating >= 4 || s.favorite);
    return loved.length ? loved[Math.floor(Math.random() * loved.length)] : null;
  }, [shows?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!seed) return;
    tmdb(`tv/${seed.tmdb_id}/recommendations`)
      .then((d) => setRecs((d.results || []).filter((r) => r.poster_path && !byTmdb.has(r.id)).slice(0, 16)))
      .catch(() => setRecs([]));
  }, [seed?.tmdb_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    tmdb("trending/tv/week").then((d) => setTrending((d.results || []).filter((r) => r.poster_path).slice(0, 18))).catch(() => setTrending([]));
  }, []);

  if (!shows || !eps) return <div className="skeleton-home"><div className="sk sk-hero" /><div className="sk sk-row" /><div className="sk sk-row" /></div>;

  if (!shows.length) {
    return (
      <Empty title="o canal está fora do ar">
        <p>Ainda não tem nenhuma série aqui. Traga o histórico do TV Time ou comece pela última série que você terminou.</p>
        <div className="row-btns center">
          <Link className="btn btn-primary" href="/importar">Importar do TV Time</Link>
          <Link className="btn btn-ghost" href="/buscar">Buscar série</Link>
        </div>
      </Empty>
    );
  }

  const cur = slides[active] || null;
  const curShow = cur?.show;
  const curWatched = curShow ? watchedBy.get(curShow.tmdb_id) || [] : [];
  const next = cur?.d && curShow?.status === "assistindo" ? nextEpisode(curWatched, cur.d.seasons) : null;
  const total = curShow?.episodes_total || cur?.d?.number_of_episodes || 0;
  const pct = total ? Math.min(100, Math.round((curWatched.length / total) * 100)) : 0;

  const markNext = async () => {
    if (!next || busy) return;
    setBusy(true);
    const row = { tmdb_show_id: curShow.tmdb_id, season: next.season, episode: next.episode, runtime: curShow.runtime || 45 };
    const { error } = await sb().from("episodes_watched").upsert(row, { onConflict: "user_id,tmdb_show_id,season,episode", ignoreDuplicates: true });
    setBusy(false);
    if (error) return say("Não consegui marcar.");
    epsChanged({ add: [row] });
    say(`T${next.season} · E${next.episode} marcado`);
  };

  const nowDay = new Date().getDate();
  const lastMonth = MONTHS[(new Date().getMonth() + 11) % 12];
  const top10 = [...shows].filter((s) => s.rating > 0 && s.poster_path).sort((a, b) => b.rating - a.rating || (lastWatch(b.tmdb_id) || "").localeCompare(lastWatch(a.tmdb_id) || "")).slice(0, 10);
  const favs = shows.filter((s) => s.favorite);
  const want = shows.filter((s) => s.status === "quero");
  const fridge = shows.filter((s) => s.status === "geladeira");
  const comfort = shows.filter((s) => s.status === "finalizada" && (s.rating >= 4 || s.favorite)).sort(() => Math.random() - 0.5).slice(0, 16);
  const firstName = (profile.name || "").split(" ")[0];
  const curLabel = curShow?.status === "assistindo" ? (firstName ? `${firstName}, continua de onde parou` : "continua de onde parou") : curShow?.favorite ? "uma das favoritas" : "nota máxima";

  return (
    <div className="home">
      <section className="bb" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carrossel" aria-label="Destaques">
        <div className="bb-bgs" aria-hidden="true">
          {slides.map((s, i) => (
            <div key={s.show.tmdb_id} className={`bb-bg ${i === active ? "on" : ""}`}>
              {s.backdrop && <img src={img(s.backdrop, "original")} alt="" />}
            </div>
          ))}
        </div>
        <div className="bb-fade" />
        {curShow ? (
          <div className="bb-body" key={curShow.tmdb_id}>
            <p className="eyebrow bb-eyebrow">{curLabel}</p>
            {cur.logo ? (
              <h1 className="bb-logo"><img src={img(cur.logo, "w500")} alt={curShow.title} /></h1>
            ) : (
              <h1 className="bb-title">{curShow.title}</h1>
            )}
            <p className="bb-meta">
              {next && <span className="mono-stamp">T{next.season} · E{next.episode}</span>}
              {curShow.year && <span>{curShow.year}</span>}
              {(curShow.genres || []).slice(0, 2).map((g) => <span key={g}>{g}</span>)}
              {curShow.rating > 0 && <span className="bb-rate" aria-label={`nota ${curShow.rating}`}>{"✕".repeat(curShow.rating)}</span>}
            </p>
            {cur.d?.overview && <p className="bb-over">{cur.d.overview}</p>}
            {next && total > 0 && <div className="bb-bar"><span style={{ width: `${pct}%` }} /></div>}
            <div className="bb-btns">
              {next ? (
                <button type="button" className="btn btn-light btn-big" onClick={markNext} disabled={busy}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                  Vi o E{next.episode}
                </button>
              ) : (
                <Link className="btn btn-light btn-big" href={`/serie/${curShow.tmdb_id}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7l-11 7z" /></svg>
                  Abrir série
                </Link>
              )}
              <Link className="btn btn-glass btn-big" href={`/serie/${curShow.tmdb_id}`}>Detalhes</Link>
            </div>
          </div>
        ) : <div className="bb-body"><div className="sk" style={{ height: 120, width: 280 }} /></div>}
        {slides.length > 1 && (
          <div className="bb-dots" role="tablist" aria-label="Escolher destaque">
            {slides.map((s, i) => (
              <button key={s.show.tmdb_id} type="button" role="tab" aria-selected={i === active} aria-label={s.show.title} className={i === active ? "on" : ""} onClick={() => setActive(i)}>
                <i style={i === active && !paused ? { animationDuration: `${SLIDE_MS}ms` } : undefined} key={`${i}-${active}-${paused}`} />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="home-rows">
        {nowDay <= 7 && (
          <Link href="/retro" className="retro-banner">
            <span className="eyebrow">saiu do forno</span>
            <b>Sua retrospectiva de {lastMonth}</b>
            <span className="arrow">→</span>
          </Link>
        )}

        {watching.length > 0 && (
          <Row title="Continuar assistindo" href="/colecao">
            {watching.slice(0, 16).map((s) => {
              const w = watchedBy.get(s.tmdb_id) || [];
              const last = w.reduce((a, e) => (!a || e.season > a.season || (e.season === a.season && e.episode > a.episode) ? e : a), null);
              const p = s.episodes_total ? Math.min(100, Math.round((w.length / s.episodes_total) * 100)) : 0;
              return (
                <Link key={s.tmdb_id} href={`/serie/${s.tmdb_id}`} className="ltile">
                  <div className="ltile-img">
                    {s.backdrop_path ? <img src={img(s.backdrop_path, "w780")} alt="" loading="lazy" /> : <div className="noposter"><span>{s.title}</span></div>}
                    <span className="ltile-shade" />
                    <span className="ltile-name">{s.title}</span>
                    {last && <span className="ltile-ep">T{last.season}·E{last.episode + 1}</span>}
                    <span className="ltile-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l11 7l-11 7z" /></svg></span>
                  </div>
                  <div className="ltile-bar"><span style={{ width: `${p}%` }} /></div>
                </Link>
              );
            })}
          </Row>
        )}

        {top10.length >= 3 && (
          <Row title={`Top 10 ${firstName ? `da ${firstName}` : "da casa"}`} eyebrow="as mais bem avaliadas" className="top10-row">
            {top10.map((s, i) => (
              <Link key={s.tmdb_id} href={`/serie/${s.tmdb_id}`} className="t10">
                <span className="t10-n" aria-hidden="true">{i + 1}</span>
                <span className="t10-img"><img src={img(s.poster_path)} alt={s.title} loading="lazy" /></span>
              </Link>
            ))}
          </Row>
        )}

        {seed && recs && recs.length > 0 && (
          <Row eyebrow="porque você amou" title={seed.title}>
            {recs.map((r) => <PosterTile key={r.id} id={r.id} title={r.name} poster={r.poster_path} label={(r.first_air_date || "").slice(0, 4)} />)}
          </Row>
        )}

        {trending && trending.length > 0 && (
          <Row eyebrow="o que todo mundo está vendo" title="Em alta essa semana">
            {trending.map((r) => <PosterTile key={r.id} id={r.id} title={r.name} poster={r.poster_path} label={GENRES[r.genre_ids?.[0]]} mine={byTmdb.has(r.id)} />)}
          </Row>
        )}

        {favs.length > 0 && (
          <Row title="Favoritas" href="/perfil">
            {favs.map((s) => <PosterTile key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} />)}
          </Row>
        )}

        {want.length > 0 && (
          <Row title="Quero ver" href="/colecao">
            {want.slice(0, 24).map((s) => <PosterTile key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} />)}
          </Row>
        )}

        {comfort.length > 0 && (
          <Row eyebrow="pra rever num domingo" title="Comfort shows">
            {comfort.map((s) => <PosterTile key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} />)}
          </Row>
        )}

        {fridge.length > 0 && (
          <Row eyebrow="volta pra mim?" title="Na geladeira" href="/colecao">
            {fridge.slice(0, 24).map((s) => <PosterTile key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} />)}
          </Row>
        )}

        <div className="home-foot">
          <Link className="btn btn-ghost" href="/colecao">Ver coleção completa · {shows.length} séries</Link>
        </div>
      </div>
    </div>
  );
}
