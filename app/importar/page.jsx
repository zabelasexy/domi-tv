"use client";
import { useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { tmdb, showFields, movieFields } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";
import { today } from "@/lib/constants";
import { analyzeTvtimeJson, isTvtimeSeries, isTvtimeLists, isTvtimeMovies, analyzeTvtimeMovies } from "@/lib/tvtime";

const pick = (cols, patterns) => cols.find((c) => patterns.some((p) => p.test(c)));

/** Lê os CSVs do export do TV Time e agrupa por série, sem depender de nomes exatos de coluna. */
function analyze(tables) {
  const shows = new Map();
  const key = (name, tvdb) => (tvdb ? `tvdb:${tvdb}` : `name:${String(name).trim().toLowerCase()}`);
  for (const { rows } of tables) {
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const nameCol = pick(cols, [/^tv_show_name$/i, /show_name/i, /series_name/i, /^series$/i, /^show$/i, /^title$/i, /^name$/i]);
    if (!nameCol) continue;
    const idCol = pick(cols, [/tvdb/i, /^tv_show_id$/i, /^series_id$/i, /^show_id$/i]);
    const seasonCol = pick(cols, [/season_number/i, /^season$/i, /episode_season/i]);
    const epCol = pick(cols, [/^episode_number$/i, /^number$/i, /^episode$/i, /episode_num/i]);
    const dateCol = pick(cols, [/watched_at/i, /seen_at/i, /^created_at$/i, /^updated_at$/i, /date/i]);
    for (const r of rows) {
      const name = r[nameCol];
      if (!name) continue;
      const tvdb = idCol && /^\d+$/.test(String(r[idCol] || "").trim()) ? String(r[idCol]).trim() : null;
      const k = key(name, tvdb);
      const cur = shows.get(k) || { name: String(name).trim(), tvdb, episodes: new Map() };
      if (seasonCol && epCol) {
        const s = parseInt(r[seasonCol], 10), e = parseInt(r[epCol], 10);
        if (Number.isInteger(s) && Number.isInteger(e)) {
          const when = dateCol && r[dateCol] && !isNaN(Date.parse(r[dateCol])) ? new Date(r[dateCol]).toISOString() : null;
          cur.episodes.set(`${s}x${e}`, { season: s, episode: e, watched_at: when });
        }
      }
      shows.set(k, cur);
    }
  }
  return [...shows.values()];
}

async function readFiles(files) {
  const Papa = (await import("papaparse")).default;
  const tables = [];
  const jsons = [];
  const parse = (name, text) => tables.push({ name, rows: Papa.parse(text, { header: true, skipEmptyLines: true }).data });
  const parseJson = (name, text) => { try { jsons.push({ name, data: JSON.parse(text) }); } catch {} };
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        if (/\.csv$/i.test(entry.name)) parse(entry.name, await entry.async("string"));
        else if (/\.json$/i.test(entry.name)) parseJson(entry.name, await entry.async("string"));
      }
    } else if (/\.csv$/i.test(f.name)) {
      parse(f.name, await f.text());
    } else if (/\.json$/i.test(f.name)) {
      parseJson(f.name, await f.text());
    }
  }
  return { tables, jsons };
}

export default function Importar() {
  const { reload, reloadEps, reloadMovies, moviesMissing } = useDomi();
  const [found, setFound] = useState(null);
  const [foundMovies, setFoundMovies] = useState([]);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");

  const onFiles = async (e) => {
    setErr(""); setFound(null); setFoundMovies([]); setDone(null); setLog([]);
    try {
      const { tables, jsons } = await readFiles([...e.target.files]);
      const series = jsons.filter((j) => isTvtimeSeries(j.data)).flatMap((j) => j.data);
      const lists = jsons.filter((j) => isTvtimeLists(j.data)).flatMap((j) => j.data);
      const movieArr = jsons.filter((j) => isTvtimeMovies(j.data)).flatMap((j) => j.data);
      if (!tables.length && !series.length && !movieArr.length) return setErr("Não achei séries nem filmes nesse arquivo. Envie o tvtime-series.json e o tvtime-movies.json (e, se quiser, o tvtime-lists.json), o .zip do TV Time ou os .csv dele.");
      const list = [...analyzeTvtimeJson(series, lists), ...analyze(tables)];
      const mlist = analyzeTvtimeMovies(movieArr);
      if (!list.length && !mlist.length) return setErr("Achei os arquivos, mas não reconheci as colunas. Me mande o arquivo que eu ajusto o importador.");
      setFound(list);
      setFoundMovies(mlist);
    } catch {
      setErr("Não consegui abrir esse arquivo.");
    }
  };

  const resolve = async (item) => {
    if (item.tvdb) {
      try {
        const f = await tmdb(`find/${item.tvdb}`, { external_source: "tvdb_id" });
        if (f.tv_results?.[0]) return f.tv_results[0].id;
      } catch {}
    }
    const s = await tmdb("search/tv", { query: item.name });
    return s.results?.[0]?.id || null;
  };

  const run = async () => {
    setBusy(true);
    try { await runImport(); } catch (e) {
      setDone({ ok: 0, eps: 0, missing: [], err: e?.message || String(e) });
    }
    setBusy(false);
  };

  const runImport = async () => {
    const uid = (await sb().auth.getUser()).data.user.id;
    const missing = [];
    let ok = 0, epsTotal = 0, firstErr = "";
    const queue = [...found];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        try {
          const id = await resolve(item);
          if (!id) { missing.push(item.name); continue; }
          const d = await tmdb(`tv/${id}`);
          const f = showFields(d);
          const eps = [...item.episodes.values()];
          const dates = eps.map((x) => x.watched_at).filter(Boolean).sort();
          const ended = d.status === "Ended" || d.status === "Canceled";
          const lastSeen = dates[dates.length - 1];
          const stale = lastSeen && Date.now() - Date.parse(lastSeen) > 1000 * 60 * 60 * 24 * 180;
          let status = "quero";
          if (item.hint === "em_dia") status = ended ? "finalizada" : stale ? "geladeira" : "assistindo";
          else if (item.hint === "assistindo") status = stale ? "geladeira" : "assistindo";
          else if (item.hint === "abandonada" || item.hint === "quero") status = item.hint;
          else if (eps.length) {
            if (f.episodes_total && eps.length >= f.episodes_total * 0.95 && ended) status = "finalizada";
            else status = stale ? "geladeira" : "assistindo";
          }
          const up = await sb().from("shows").upsert({
            ...f, user_id: uid, status,
            favorite: !!item.favorite,
            tags: item.tags || [],
            started_at: dates[0]?.slice(0, 10) || null,
            finished_at: status === "finalizada" ? (dates[dates.length - 1]?.slice(0, 10) || today()) : null,
          }, { onConflict: "user_id,tmdb_id", ignoreDuplicates: true });
          if (up.error) throw new Error(`Série: ${up.error.message}`);
          const rows = eps.map((x) => ({ user_id: uid, tmdb_show_id: id, season: x.season, episode: x.episode, runtime: f.runtime || 45, ...(x.watched_at ? { watched_at: x.watched_at } : {}) }));
          for (let i = 0; i < rows.length; i += 500) {
            const er = await sb().from("episodes_watched").upsert(rows.slice(i, i + 500), { onConflict: "user_id,tmdb_show_id,season,episode", ignoreDuplicates: true });
            if (er.error) throw new Error(`Episódios: ${er.error.message}`);
          }
          ok++; epsTotal += rows.length;
          setLog((l) => [...l.slice(-6), `✓ ${ok}/${found.length} · ${d.name}${rows.length ? ` · ${rows.length} eps` : ""}`]);
        } catch (err) {
          missing.push(item.name);
          if (!firstErr) firstErr = err?.message || String(err);
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    // Filmes
    let okMovies = 0;
    const mqueue = [...foundMovies];
    const mworker = async () => {
      while (mqueue.length) {
        const m = mqueue.shift();
        try {
          let id = null;
          if (m.imdb) {
            try { id = (await tmdb(`find/${m.imdb}`, { external_source: "imdb_id" })).movie_results?.[0]?.id || null; } catch {}
          }
          if (!id) {
            const r = await tmdb("search/movie", m.year ? { query: m.name, year: m.year } : { query: m.name });
            id = r.results?.[0]?.id || null;
          }
          if (!id) { missing.push(`${m.name} (filme)`); continue; }
          const d = await tmdb(`movie/${id}`);
          const up = await sb().from("movies").upsert({
            ...movieFields(d), user_id: uid,
            status: m.watched ? "visto" : "quero",
            favorite: m.favorite,
            rewatch_count: m.rewatch_count,
            watched_at: m.watched_at,
          }, { onConflict: "user_id,tmdb_id", ignoreDuplicates: true });
          if (up.error) throw new Error(`Filme: ${up.error.message}`);
          okMovies++;
          setLog((l) => [...l.slice(-6), `✓ filme ${okMovies}/${foundMovies.length} · ${d.title}`]);
        } catch (err) {
          missing.push(`${m.name} (filme)`);
          if (!firstErr) firstErr = err?.message || String(err);
        }
      }
    };
    if (foundMovies.length) await Promise.all([mworker(), mworker(), mworker(), mworker()]);

    await Promise.all([reload(), reloadEps(), reloadMovies()]);
    setDone({ ok, eps: epsTotal, movies: okMovies, missing, err: firstErr });
  };

  return (
    <section className="import">
      <h1 className="h-display">Importar do TV Time</h1>
      <p className="muted">Envie os arquivos que o TV Time gerou no export: o <b>tvtime-series.json</b> e, se quiser levar as listas como tags, o <b>tvtime-lists.json</b> (pode escolher os dois juntos). O .zip ou os .csv também funcionam. Cada série é procurada no catálogo e entra com os episódios e as datas que você já tinha marcado. Pode importar de novo sem medo: nada fica duplicado.</p>

      {!done && (
        <label className="drop">
          <input type="file" accept=".zip,.csv,.json" multiple onChange={onFiles} disabled={busy} />
          <span>{found ? "Trocar arquivo" : "Escolher arquivo do TV Time"}</span>
        </label>
      )}
      {err && <p className="err">{err}</p>}

      {found && !done && (
        <div className="import-box">
          {found.length > 0 && <p><b>{found.length}</b> séries encontradas, com <b>{found.reduce((a, s) => a + s.episodes.size, 0)}</b> episódios marcados.</p>}
          {foundMovies.length > 0 && <p><b>{foundMovies.length}</b> filmes encontrados ({foundMovies.filter((m) => m.watched).length} vistos).</p>}
          {foundMovies.length > 0 && moviesMissing && <p className="err">Antes, rode a atualização 4 no Supabase para ligar os filmes. Senão eles não entram.</p>}
          <ul className="import-peek">{found.slice(0, 6).map((s) => <li key={s.name}>{s.name}<span>{s.episodes.size} eps</span></li>)}{foundMovies.slice(0, 3).map((m) => <li key={`m-${m.name}`}>{m.name}<span>filme</span></li>)}</ul>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={run}>{busy ? "Importando…" : "Importar tudo"}</button>
          {busy && <ul className="import-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </div>
      )}

      {done && (
        <div className="import-box">
          <p className="hand-ok">{done.ok} séries, {done.eps} episódios{done.movies ? ` e ${done.movies} filmes` : ""} no canal{done.ok || done.movies ? " 🎉" : ""}</p>
          {done.err && <p className="err">Erro: {done.err}</p>}
          {done.missing.length > 0 && (
            <>
              <p className="muted">Essas eu não achei sozinha. Procure pelo nome na busca:</p>
              <ul className="import-peek">{done.missing.map((n) => <li key={n}><Link href={`/buscar?q=${encodeURIComponent(n)}`}>{n}</Link></li>)}</ul>
            </>
          )}
          <Link className="btn btn-primary" href="/">Ver coleção</Link>
        </div>
      )}
    </section>
  );
}
