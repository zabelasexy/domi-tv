"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { Empty } from "@/components/bits";
import { tmdb, img } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";
import { MONTHS } from "@/lib/constants";

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

function Row({ title, eyebrow, href, children }) {
  return (
    <section className="hrow">
      <div className="hrow-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {href && <Link href={href} className="see-all">ver tudo</Link>}
      </div>
      <div className="hrow-track">{children}</div>
    </section>
  );
}

function PosterTile({ id, title, poster, label }) {
  return (
    <Link href={`/serie/${id}`} className="ptile">
      <div className="ptile-img">{poster ? <img src={img(poster)} alt="" loading="lazy" /> : <div className="noposter"><span>{title}</span></div>}</div>
      <span className="ptile-t">{title}</span>
      {label && <span className="ptile-l">{label}</span>}
    </Link>
  );
}

export default function Home() {
  const { shows, eps, byTmdb, epsChanged, saveShow, say, profile } = useDomi();
  const [hero, setHero] = useState(null);
  const [recs, setRecs] = useState(null);
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
  const heroShow = watching[0] || (shows || []).find((s) => s.favorite) || (shows || [])[0];

  useEffect(() => {
    if (!heroShow) return;
    let alive = true;
    tmdb(`tv/${heroShow.tmdb_id}`).then((d) => { if (alive) setHero(d); }).catch(() => {});
    return () => { alive = false; };
  }, [heroShow?.tmdb_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const seed = useMemo(() => {
    const loved = (shows || []).filter((s) => s.rating >= 4 || s.favorite);
    return loved.length ? loved[Math.floor(Math.random() * loved.length)] : null;
  }, [shows?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!seed) return;
    tmdb(`tv/${seed.tmdb_id}/recommendations`)
      .then((d) => setRecs((d.results || []).filter((r) => r.poster_path && !byTmdb.has(r.id)).slice(0, 14)))
      .catch(() => setRecs([]));
  }, [seed?.tmdb_id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const heroWatched = heroShow ? watchedBy.get(heroShow.tmdb_id) || [] : [];
  const next = hero ? nextEpisode(heroWatched, hero.seasons) : null;
  const total = heroShow?.episodes_total || hero?.number_of_episodes || 0;
  const pct = total ? Math.min(100, Math.round((heroWatched.length / total) * 100)) : 0;

  const markNext = async () => {
    if (!next || busy) return;
    setBusy(true);
    const row = { tmdb_show_id: heroShow.tmdb_id, season: next.season, episode: next.episode, runtime: heroShow.runtime || 45 };
    const { error } = await sb().from("episodes_watched").upsert(row, { onConflict: "user_id,tmdb_show_id,season,episode", ignoreDuplicates: true });
    setBusy(false);
    if (error) return say("Não consegui marcar.");
    epsChanged({ add: [row] });
    if (heroShow.status !== "assistindo") await saveShow({ tmdb_id: heroShow.tmdb_id, title: heroShow.title, status: "assistindo" });
    say(`T${next.season} · E${next.episode} marcado`);
  };

  const nowDay = new Date().getDate();
  const lastMonth = MONTHS[(new Date().getMonth() + 11) % 12];
  const favs = shows.filter((s) => s.favorite);
  const want = shows.filter((s) => s.status === "quero");
  const fridge = shows.filter((s) => s.status === "geladeira");
  const firstName = (profile.name || "").split(" ")[0];

  return (
    <div className="home">
      {heroShow && (
        <section className="hero2">
          <div className="hero2-bg">
            {(hero?.backdrop_path || heroShow.backdrop_path) && <img src={img(hero?.backdrop_path || heroShow.backdrop_path, "w1280")} alt="" />}
          </div>
          <div className="hero2-fade" />
          <div className="hero2-body">
            <p className="eyebrow">{heroShow.status === "assistindo" ? (firstName ? `${firstName}, continua de onde parou` : "assistindo agora") : "da sua coleção"}</p>
            <h1>{heroShow.title}</h1>
            <p className="hero2-meta">
              {next && <span className="mono-stamp">T{next.season} · E{next.episode}</span>}
              <span>{(heroShow.genres || []).slice(0, 2).join(" · ")}</span>
            </p>
            {total > 0 && <div className="hero2-bar"><span style={{ width: `${pct}%` }} /></div>}
            <div className="hero2-btns">
              {next ? (
                <button type="button" className="btn btn-primary btn-big" onClick={markNext} disabled={busy}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                  Vi o E{next.episode}
                </button>
              ) : (
                <Link className="btn btn-primary btn-big" href={`/serie/${heroShow.tmdb_id}`}>Abrir série</Link>
              )}
              <Link className="btn-round" href={`/serie/${heroShow.tmdb_id}`} aria-label="Detalhes da série">i</Link>
            </div>
          </div>
        </section>
      )}

      {nowDay <= 7 && (
        <Link href="/retro" className="retro-banner">
          <span className="eyebrow">saiu do forno</span>
          <b>Sua retrospectiva de {lastMonth}</b>
          <span className="arrow">→</span>
        </Link>
      )}

      {watching.length > 0 && (
        <Row title="Continuar assistindo" href="/colecao">
          {watching.slice(0, 14).map((s) => {
            const w = watchedBy.get(s.tmdb_id) || [];
            const last = w.reduce((a, e) => (!a || e.season > a.season || (e.season === a.season && e.episode > a.episode) ? e : a), null);
            const p = s.episodes_total ? Math.min(100, Math.round((w.length / s.episodes_total) * 100)) : 0;
            return (
              <Link key={s.tmdb_id} href={`/serie/${s.tmdb_id}`} className="ltile">
                <div className="ltile-img">
                  {s.backdrop_path ? <img src={img(s.backdrop_path, "w500")} alt="" loading="lazy" /> : <div className="noposter"><span>{s.title}</span></div>}
                  {last && <span className="ltile-ep">T{last.season}·E{last.episode + 1}</span>}
                </div>
                <div className="ltile-bar"><span style={{ width: `${p}%` }} /></div>
                <span className="ptile-t">{s.title}</span>
              </Link>
            );
          })}
        </Row>
      )}

      {seed && recs && recs.length > 0 && (
        <Row eyebrow="porque você amou" title={seed.title}>
          {recs.map((r) => <PosterTile key={r.id} id={r.id} title={r.name} poster={r.poster_path} label={(r.first_air_date || "").slice(0, 4)} />)}
        </Row>
      )}

      {favs.length > 0 && (
        <Row title="Favoritas" href="/perfil">
          {favs.map((s) => <PosterTile key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} />)}
        </Row>
      )}

      {want.length > 0 && (
        <Row title="Quero ver" href="/colecao">
          {want.slice(0, 20).map((s) => <PosterTile key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} />)}
        </Row>
      )}

      {fridge.length > 0 && (
        <Row eyebrow="volta pra mim?" title="Na geladeira" href="/colecao">
          {fridge.slice(0, 20).map((s) => <PosterTile key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} />)}
        </Row>
      )}

      <div className="home-foot">
        <Link className="btn btn-ghost" href="/colecao">Ver coleção completa · {shows.length} séries</Link>
      </div>
    </div>
  );
}
