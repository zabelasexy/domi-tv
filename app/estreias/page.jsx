"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { Empty } from "@/components/bits";
import { tmdb, img } from "@/lib/tmdb";
import { WEEKDAYS, MONTHS } from "@/lib/constants";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function when(dateStr, todayStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const diff = Math.round((dt - new Date(todayStr + "T00:00:00")) / 86400000);
  if (diff === 0) return "HOJE";
  if (diff === 1) return "AMANHÃ";
  if (diff < 7) return `${WEEKDAYS[dt.getDay()].slice(0, 3).toUpperCase()} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1].slice(0, 3).toUpperCase()}`;
}

export default function Estreias() {
  const { shows } = useDomi();
  const [items, setItems] = useState(null);
  const [returning, setReturning] = useState([]);
  const [day, setDay] = useState(null);
  const todayStr = iso(new Date());

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);

  useEffect(() => {
    if (!shows) return;
    const pool = shows
      .filter((s) => s.status === "assistindo" || s.status === "geladeira" || s.favorite || (s.status === "finalizada" && Number(s.year) >= 2012))
      .sort((a, b) => (a.status === "assistindo" ? -1 : 0) - (b.status === "assistindo" ? -1 : 0))
      .slice(0, 80);
    let alive = true;
    (async () => {
      const found = [], back = [];
      const queue = [...pool];
      const worker = async () => {
        while (queue.length) {
          const s = queue.shift();
          try {
            const d = await tmdb(`tv/${s.tmdb_id}`);
            const n = d.next_episode_to_air;
            if (n?.air_date && n.air_date >= todayStr) {
              found.push({ id: s.tmdb_id, title: s.title, poster: s.poster_path, date: n.air_date, season: n.season_number, episode: n.episode_number, name: n.name, premiere: n.episode_number === 1 });
            } else if (d.status === "Returning Series" || d.in_production) {
              back.push({ id: s.tmdb_id, title: s.title, poster: s.poster_path });
            }
          } catch {}
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      if (!alive) return;
      found.sort((a, b) => a.date.localeCompare(b.date));
      setItems(found);
      setReturning(back.slice(0, 18));
    })();
    return () => { alive = false; };
  }, [shows?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const m = new Map();
    (items || []).forEach((it) => m.set(it.date, (m.get(it.date) || 0) + 1));
    return m;
  }, [items]);

  const list = (items || []).filter((it) => !day || it.date === day);

  return (
    <div className="estreias">
      <h1 className="h-display">Estreias</h1>
      <div className="week" role="group" aria-label="Filtrar por dia">
        {week.map((d) => {
          const k = iso(d);
          const on = day === k;
          return (
            <button key={k} type="button" className={`wday ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setDay(on ? null : k)}>
              <span>{WEEKDAYS[d.getDay()].slice(0, 3)}</span>
              <b>{d.getDate()}</b>
              <i className={counts.get(k) ? "has" : ""} />
            </button>
          );
        })}
      </div>

      {!items ? (
        <div className="skeleton-home"><div className="sk sk-row" /><div className="sk sk-row" /></div>
      ) : list.length ? (
        <ol className="ep-list">
          {list.map((it) => (
            <li key={`${it.id}-${it.date}`}>
              <Link href={`/serie/${it.id}`} className="ep-card">
                <span className="ep-card-img">{it.poster ? <img src={img(it.poster, "w154")} alt="" /> : null}</span>
                <span className="ep-card-txt">
                  <span className="mono-stamp">{when(it.date, todayStr)}</span>
                  <b>{it.title}</b>
                  <span className="muted">T{it.season} · E{it.episode}{it.premiere ? " · estreia da temporada" : it.name && !/^Episódio \d+$/i.test(it.name) ? ` · ${it.name}` : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title={day ? "nada nesse dia" : "nenhuma estreia marcada"}>
          <p>{day ? "Escolha outro dia ou toque de novo para ver todos." : "Quando alguma série que você acompanha ganhar data de episódio novo, ela aparece aqui."}</p>
        </Empty>
      )}

      {returning.length > 0 && !day && (
        <section className="hrow">
          <div className="hrow-head"><div><p className="eyebrow">renovadas, sem data ainda</p><h2>Vão voltar</h2></div></div>
          <div className="hrow-track">
            {returning.map((s) => (
              <Link key={s.id} href={`/serie/${s.id}`} className="ptile">
                <div className="ptile-img">{s.poster ? <img src={img(s.poster)} alt="" loading="lazy" /> : <div className="noposter"><span>{s.title}</span></div>}</div>
                <span className="ptile-t">{s.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
