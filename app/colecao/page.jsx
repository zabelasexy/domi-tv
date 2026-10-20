"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { PosterCard, Stitches, Empty } from "@/components/bits";
import { STATUS } from "@/lib/constants";
import { img } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";

export default function Colecao() {
  const { shows } = useDomi();
  const [filter, setFilter] = useState("todas");
  const [sort, setSort] = useState("recent");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tag");
    if (t) setQ(t);
  }, []);

  useEffect(() => {
    sb().rpc("my_stats").then(({ data }) => { if (data?.[0]) setStats(data[0]); });
  }, [shows]);

  const counts = useMemo(() => {
    const c = { todas: shows?.length || 0 };
    STATUS.forEach((s) => (c[s.k] = (shows || []).filter((x) => x.status === s.k).length));
    return c;
  }, [shows]);

  const list = useMemo(() => {
    let l = (shows || []).filter((s) => filter === "todas" || s.status === filter);
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((s) => [s.title, s.ship, ...(s.tags || [])].join(" ").toLowerCase().includes(t));
    const by = {
      recent: (a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""),
      az: (a, b) => a.title.localeCompare(b.title, "pt"),
      rating: (a, b) => b.rating - a.rating,
      year: (a, b) => (b.year || "").localeCompare(a.year || ""),
    }[sort];
    return [...l].sort(by);
  }, [shows, filter, sort, q]);

  if (!shows) return <div className="loading">abrindo o canal…</div>;

  if (!shows.length) {
    return (
      <Empty title="o canal está fora do ar">
        <p>Ainda não tem nenhuma série aqui. Traga o histórico do TV Time ou comece pela última série que você terminou.</p>
        <div className="row-btns">
          <Link className="btn btn-primary" href="/buscar">Buscar série</Link>
          <Link className="btn btn-ghost" href="/importar">Importar do TV Time</Link>
        </div>
      </Empty>
    );
  }

  const hours = stats ? Math.round(stats.minutes / 60) : null;
  const rated = shows.filter((s) => s.rating > 0);

  return (
    <>
      <section className="stats" aria-label="Resumo">
        <div><b>{shows.length}</b><span>séries</span></div>
        <div><b>{counts.finalizada}</b><span>finalizadas</span></div>
        <div><b>{stats ? stats.episodes.toLocaleString("pt-BR") : "–"}</b><span>episódios</span></div>
        <div><b>{hours !== null ? hours.toLocaleString("pt-BR") : "–"}</b><span>horas de tela</span></div>
        {rated.length > 0 && (
          <div className="stats-avg">
            <b>{(rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(1).replace(".", ",")}</b>
            <span>nota média</span>
          </div>
        )}
      </section>

      <section className="lib">
        <div className="lib-head">
          <h1 className="h-display">Coleção</h1>
          <div className="lib-tools">
            <label htmlFor="lib-q" className="sr">Filtrar coleção</label>
            <input id="lib-q" className="input" type="search" placeholder="título, tag ou shipp" value={q} onChange={(e) => setQ(e.target.value)} />
            <label htmlFor="lib-sort" className="sr">Ordenar</label>
            <select id="lib-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Recentes</option>
              <option value="az">A–Z</option>
              <option value="rating">Nota</option>
              <option value="year">Ano</option>
            </select>
          </div>
        </div>
        <div className="chips" role="group" aria-label="Filtrar por status">
          {[{ k: "todas", label: "Todas" }, ...STATUS].map((s) => (
            <button key={s.k} type="button" className="chip" aria-pressed={filter === s.k} onClick={() => setFilter(s.k)}>
              {s.label} <small>{counts[s.k]}</small>
            </button>
          ))}
        </div>
        {list.length ? (
          <div className="grid">
            {list.map((s) => (
              <PosterCard key={s.tmdb_id} id={s.tmdb_id} title={s.title} poster={s.poster_path} year={s.year} status={filter === "todas" ? s.status : null} rating={s.rating} />
            ))}
          </div>
        ) : (
          <Empty title="nada nesse canal"><p>Nenhuma série com esse filtro.</p></Empty>
        )}
      </section>
    </>
  );
}
