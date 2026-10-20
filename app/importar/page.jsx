"use client";
import { useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { tmdb, showFields } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";
import { today } from "@/lib/constants";
import { analyzeTvtimeJson, isTvtimeSeries, isTvtimeLists } from "@/lib/tvtime";

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
  const { reload, reloadEps } = useDomi();
  const [found, setFound] = useState(null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");

  const onFiles = async (e) => {
    setErr(""); setFound(null); setDone(null); setLog([]);
    try {
      const { tables, jsons } = await readFiles([...e.target.files]);
      const series = jsons.filter((j) => isTvtimeSeries(j.data)).flatMap((j) => j.data);
      const lists = jsons.filter((j) => isTvtimeLists(j.data)).flatMap((j) => j.data);
      if (!tables.length && !series.length) return setErr("Não achei as séries nesse arquivo. Envie o tvtime-series.json (e, se quiser, o tvtime-lists.json), o .zip do TV Time ou os .csv dele.");
      const list = [...analyzeTvtimeJson(series, lists), ...analyze(tables)];
      if (!list.length) return setErr("Achei os arquivos, mas não reconheci as colunas de série. Me mande o arquivo que eu ajusto o importador.");
      setFound(list);
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
    const uid = (await sb().auth.getUser()).data.user.id;
    const missing = [];
    let ok = 0, epsTotal = 0;
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
          await sb().from("shows").upsert({
            ...f, user_id: uid, status,
            favorite: !!item.favorite,
            tags: item.tags || [],
            started_at: dates[0]?.slice(0, 10) || null,
            finished_at: status === "finalizada" ? (dates[dates.length - 1]?.slice(0, 10) || today()) : null,
          }, { onConflict: "user_id,tmdb_id", ignoreDuplicates: true });
          const rows = eps.map((x) => ({ user_id: uid, tmdb_show_id: id, season: x.season, episode: x.episode, runtime: f.runtime || 45, ...(x.watched_at ? { watched_at: x.watched_at } : {}) }));
          for (let i = 0; i < rows.length; i += 500) {
            await sb().from("episodes_watched").upsert(rows.slice(i, i + 500), { onConflict: "user_id,tmdb_show_id,season,episode", ignoreDuplicates: true });
          }
          ok++; epsTotal += rows.length;
          setLog((l) => [...l.slice(-6), `✓ ${d.name}${rows.length ? ` · ${rows.length} eps` : ""}`]);
        } catch {
          missing.push(item.name);
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await Promise.all([reload(), reloadEps()]);
    setBusy(false);
    setDone({ ok, eps: epsTotal, missing });
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
          <p><b>{found.length}</b> séries encontradas, com <b>{found.reduce((a, s) => a + s.episodes.size, 0)}</b> episódios marcados.</p>
          <ul className="import-peek">{found.slice(0, 8).map((s) => <li key={s.name}>{s.name}<span>{s.episodes.size} eps</span></li>)}</ul>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={run}>{busy ? "Importando…" : "Importar tudo"}</button>
          {busy && <ul className="import-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </div>
      )}

      {done && (
        <div className="import-box">
          <p className="hand-ok">{done.ok} séries e {done.eps} episódios no canal 🎉</p>
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
