"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDomi } from "@/components/Shell";
import { Stitches } from "@/components/bits";
import { tmdb, img, showFields } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";
import { STATUS, today } from "@/lib/constants";

const SHOW_STATUS = { "Returning Series": "Em exibição", Ended: "Encerrada", Canceled: "Cancelada", "In Production": "Em produção" };

function Season({ s, showId, watched, onToggle, onSeason, fallbackRuntime }) {
  const [open, setOpen] = useState(false);
  const [eps, setEps] = useState(null);
  const seen = watched.filter((w) => w.season === s.season_number).length;
  const total = s.episode_count || 0;

  const load = useCallback(async () => {
    if (eps) return eps;
    const d = await tmdb(`tv/${showId}/season/${s.season_number}`);
    const list = (d.episodes || []).filter((e) => !e.air_date || e.air_date <= today());
    setEps(list);
    return list;
  }, [eps, showId, s.season_number]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const all = total > 0 && seen >= total;
  return (
    <div className={`season ${open ? "open" : ""}`}>
      <div className="season-head">
        <button type="button" className="season-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="season-name">{s.name}</span>
          <span className="season-count">{seen}/{total}</span>
          <span className="season-bar"><span style={{ width: `${total ? Math.min(100, (seen / total) * 100) : 0}%` }} /></span>
        </button>
        <button type="button" className={`check ${all ? "on" : ""}`} aria-label={all ? "Desmarcar temporada" : "Marcar temporada inteira"}
          onClick={async () => onSeason(s.season_number, await load(), !all)}>✓</button>
      </div>
      {open && (
        <ol className="eps">
          {!eps && <li className="muted">carregando episódios…</li>}
          {eps?.map((e) => {
            const on = watched.some((w) => w.season === e.season_number && w.episode === e.episode_number);
            return (
              <li key={e.id}>
                <button type="button" className={`ep ${on ? "on" : ""}`} onClick={() => onToggle(e, !on)} aria-pressed={on}>
                  <span className="ep-n">{e.episode_number}</span>
                  <span className="ep-t">{e.name}<small>{[e.air_date?.split("-").reverse().join("/"), (e.runtime || fallbackRuntime) && `${e.runtime || fallbackRuntime} min`].filter(Boolean).join(" · ")}</small></span>
                  <span className={`check ${on ? "on" : ""}`} aria-hidden="true">✓</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function Serie() {
  const { id } = useParams();
  const tmdbId = Number(id);
  const router = useRouter();
  const { byTmdb, saveShow, removeShow, say } = useDomi();
  const mine = byTmdb.get(tmdbId);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [watched, setWatched] = useState([]);
  const [form, setForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    setD(null);
    tmdb(`tv/${tmdbId}`, { append_to_response: "watch/providers" })
      .then(async (data) => {
        if (!data.overview) {
          try { data.overview = (await tmdb(`tv/${tmdbId}`, { language: "en-US" })).overview; } catch {}
        }
        setD(data);
      })
      .catch(() => setErr("Não consegui abrir essa série agora."));
    sb().from("episodes_watched").select("season,episode,watched_at").eq("tmdb_show_id", tmdbId).then(({ data }) => setWatched(data || []));
  }, [tmdbId]);

  useEffect(() => {
    if (mine) setForm({ ship: mine.ship || "", tags: (mine.tags || []).join(", "), notes: mine.notes || "", started_at: mine.started_at || "", finished_at: mine.finished_at || "" });
  }, [mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = useMemo(() => (d ? showFields(d) : null), [d]);
  const runtime = fields?.runtime || 45;
  const airedTotal = useMemo(() => (d?.seasons || []).filter((s) => s.season_number > 0).reduce((a, s) => a + (s.episode_count || 0), 0), [d]);

  const save = async (patch) => {
    if (!fields) return null;
    const row = await saveShow({ ...fields, ...(mine ? { status: mine.status } : {}), ...patch });
    return row;
  };

  const add = async (status) => {
    const patch = { status };
    if (status === "finalizada") patch.finished_at = today();
    if (status === "assistindo") patch.started_at = today();
    await save(patch);
    say(status === "quero" ? "Guardada na lista de quero ver" : "Adicionada à coleção");
  };

  const autoStatus = async (count) => {
    const ended = d?.status === "Ended" || d?.status === "Canceled";
    if (ended && airedTotal && count >= airedTotal && mine?.status !== "finalizada") {
      await save({ status: "finalizada", finished_at: mine?.finished_at || today() });
      say("Série finalizada! Que tal dar uma nota?");
    } else if (!mine || mine.status === "quero" || mine.status === "geladeira") {
      if (count > 0) await save({ status: "assistindo", started_at: mine?.started_at || today() });
    }
  };

  const toggleEp = async (e, on) => {
    if (on) {
      const row = { tmdb_show_id: tmdbId, season: e.season_number, episode: e.episode_number, runtime: e.runtime || runtime };
      const { error } = await sb().from("episodes_watched").upsert(row, { onConflict: "user_id,tmdb_show_id,season,episode", ignoreDuplicates: true });
      if (error) return say("Não consegui marcar.");
      const next = [...watched, { ...row, watched_at: new Date().toISOString() }];
      setWatched(next);
      autoStatus(next.length);
    } else {
      const { error } = await sb().from("episodes_watched").delete().eq("tmdb_show_id", tmdbId).eq("season", e.season_number).eq("episode", e.episode_number);
      if (error) return say("Não consegui desmarcar.");
      setWatched((w) => w.filter((x) => !(x.season === e.season_number && x.episode === e.episode_number)));
    }
  };

  const toggleSeason = async (season, eps, on) => {
    if (on) {
      const rows = eps.map((e) => ({ tmdb_show_id: tmdbId, season, episode: e.episode_number, runtime: e.runtime || runtime }));
      const { error } = await sb().from("episodes_watched").upsert(rows, { onConflict: "user_id,tmdb_show_id,season,episode", ignoreDuplicates: true });
      if (error) return say("Não consegui marcar a temporada.");
      const now = new Date().toISOString();
      const next = [...watched.filter((w) => w.season !== season), ...rows.map((r) => ({ ...r, watched_at: now }))];
      setWatched(next);
      say(`Temporada ${season} marcada`);
      autoStatus(next.length);
    } else {
      const { error } = await sb().from("episodes_watched").delete().eq("tmdb_show_id", tmdbId).eq("season", season);
      if (error) return say("Não consegui desmarcar.");
      setWatched((w) => w.filter((x) => x.season !== season));
    }
  };

  const saveForm = async () => {
    if (!mine || !form) return;
    await save({
      ship: form.ship.trim(),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: form.notes.trim(),
      started_at: form.started_at || null,
      finished_at: form.finished_at || null,
    });
    say("Salvo");
  };

  if (err) return <p className="err">{err}</p>;
  if (!d) return <div className="loading">sintonizando…</div>;

  const providers = d["watch/providers"]?.results?.BR?.flatrate || [];
  const seasons = [...(d.seasons || []).filter((s) => s.season_number > 0), ...(d.seasons || []).filter((s) => s.season_number === 0)];

  return (
    <article className="detail">
      <div className="hero">
        {d.backdrop_path && <img className="hero-bg" src={img(d.backdrop_path, "w1280")} alt="" />}
        <div className="hero-fade" />
        <div className="hero-body">
          <div className="hero-poster">{d.poster_path ? <img src={img(d.poster_path, "w500")} alt={`Pôster de ${d.name}`} /> : <div className="noposter"><span>{d.name}</span></div>}</div>
          <div className="hero-txt">
            <p className="eyebrow">{[fields.year, SHOW_STATUS[d.status] || d.status].filter(Boolean).join(" · ")}</p>
            <h1>{d.name}</h1>
            {d.original_name && d.original_name !== d.name && <p className="orig">{d.original_name}</p>}
            <p className="meta">{[fields.genres.slice(0, 3).join(", "), `${d.number_of_seasons} temporada${d.number_of_seasons > 1 ? "s" : ""}`, fields.runtime && `${fields.runtime} min/ep`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {!mine ? (
            <div className="addbox">
              <p className="eyebrow">adicionar à coleção</p>
              <div className="row-btns">
                <button className="btn btn-primary" type="button" onClick={() => add("finalizada")}>Já vi tudo</button>
                <button className="btn btn-ghost" type="button" onClick={() => add("assistindo")}>Estou assistindo</button>
                <button className="btn btn-ghost" type="button" onClick={() => add("quero")}>Quero ver</button>
              </div>
            </div>
          ) : (
            <div className="mybox">
              <div className="seg" role="group" aria-label="Status">
                {STATUS.map((s) => (
                  <button key={s.k} type="button" aria-pressed={mine.status === s.k} className={`st-${s.k}`}
                    onClick={() => save({ status: s.k, ...(s.k === "finalizada" && !mine.finished_at ? { finished_at: today() } : {}) })}>{s.label}</button>
                ))}
              </div>
              <div className="rate-row">
                <span className="eyebrow">sua nota</span>
                <Stitches size="lg" value={mine.rating} onChange={(v) => save({ rating: v })} />
                <button type="button" className={`fav ${mine.favorite ? "on" : ""}`} onClick={() => save({ favorite: !mine.favorite })} aria-pressed={mine.favorite} aria-label="Favorita">
                  <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
                </button>
              </div>
            </div>
          )}

          {d.overview && <p className="overview">{d.overview}</p>}

          {providers.length > 0 && (
            <div className="providers">
              <span className="eyebrow">onde assistir</span>
              <div>{providers.map((p) => <img key={p.provider_id} src={img(p.logo_path, "w92")} alt={p.provider_name} title={p.provider_name} />)}</div>
            </div>
          )}

          <section className="seasons" aria-label="Temporadas">
            <div className="seasons-head">
              <h2>Episódios</h2>
              <span className="muted">{watched.length} de {airedTotal} vistos</span>
            </div>
            {seasons.map((s) => (
              <Season key={s.id} s={s} showId={tmdbId} watched={watched} onToggle={toggleEp} onSeason={toggleSeason} fallbackRuntime={fields.runtime} />
            ))}
          </section>
        </div>

        {mine && form && (
          <aside className="detail-side">
            <h2>Caderninho</h2>
            <label className="field">Shipp favorito<input className="input" value={form.ship} onChange={(e) => setForm({ ...form, ship: e.target.value })} onBlur={saveForm} placeholder="ex.: Nick e Charlie" /></label>
            <label className="field">Tags<input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} onBlur={saveForm} placeholder="slow burn, found family, chorei" /></label>
            {mine.tags?.length > 0 && <div className="tagline">{mine.tags.map((t) => <span key={t}>{t}</span>)}</div>}
            <div className="two">
              <label className="field">Comecei<input className="input" type="date" value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} onBlur={saveForm} /></label>
              <label className="field">Terminei<input className="input" type="date" value={form.finished_at} onChange={(e) => setForm({ ...form, finished_at: e.target.value })} onBlur={saveForm} /></label>
            </div>
            <label className="field">Anotações<textarea className="input" rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} onBlur={saveForm} placeholder="o que ficou comigo…" /></label>
            <button type="button" className="btn btn-danger" onClick={async () => {
              if (!confirmDel) return setConfirmDel(true);
              if (await removeShow(tmdbId)) { say("Removida da coleção"); router.push("/"); }
            }}>{confirmDel ? "Confirmar: remover e apagar episódios" : "Remover da coleção"}</button>
          </aside>
        )}
      </div>
    </article>
  );
}
