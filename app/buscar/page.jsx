"use client";
import { useEffect, useRef, useState } from "react";
import { useDomi } from "@/components/Shell";
import { PosterCard, Empty } from "@/components/bits";
import { tmdb } from "@/lib/tmdb";
import { STATUS_LABEL } from "@/lib/constants";

export default function Buscar() {
  const { byTmdb, byMovie } = useDomi();
  const [kind, setKind] = useState("tv");
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [trending, setTrending] = useState(null);
  const [err, setErr] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("q")) setQ(sp.get("q"));
    if (sp.get("tipo") === "filmes") setKind("movie");
  }, []);

  useEffect(() => {
    setTrending(null);
    tmdb(`trending/${kind}/week`).then((d) => setTrending(d.results || [])).catch(() => setTrending([]));
  }, [kind]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const [p1, p2] = await Promise.all([tmdb(`search/${kind}`, { query: term }), tmdb(`search/${kind}`, { query: term, page: "2" })]);
        if (my !== seq.current) return;
        const seen = new Set();
        setResults([...(p1.results || []), ...(p2.results || [])].filter((s) => !seen.has(s.id) && seen.add(s.id)));
        setErr("");
      } catch {
        if (my === seq.current) setErr("A busca não respondeu. Tente de novo em instantes.");
      }
    }, 320);
    return () => clearTimeout(t);
  }, [q, kind]);

  const list = results ?? trending ?? [];
  const movie = kind === "movie";
  const label = (s) => {
    if (movie) {
      const m = byMovie.get(s.id);
      return m ? `na coleção · ${m.status === "visto" ? "Visto" : "Quero ver"}` : (s.release_date || "").slice(0, 4);
    }
    const mine = byTmdb.get(s.id);
    return mine ? `na coleção · ${STATUS_LABEL[mine.status]}` : (s.first_air_date || "").slice(0, 4);
  };

  return (
    <section className="search-page">
      <h1 className="h-display">Buscar</h1>
      <div className="searchbox">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14z M20 20l-4-4" /></svg>
        <label htmlFor="busca" className="sr">{movie ? "Buscar filme" : "Buscar série"}</label>
        <input id="busca" type="search" autoFocus placeholder={movie ? "Simplesmente Acontece, Com Amor, Simon…" : "Atypical, Skins, Merlí…"} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="kind-toggle" role="group" aria-label="Tipo">
        <button type="button" className="chip" aria-pressed={!movie} onClick={() => { setKind("tv"); setResults(null); }}>Séries</button>
        <button type="button" className="chip" aria-pressed={movie} onClick={() => { setKind("movie"); setResults(null); }}>Filmes</button>
      </div>
      {err && <p className="err">{err}</p>}
      <p className="eyebrow">{results ? `${results.length} resultados` : "em alta essa semana"}</p>
      {results && !results.length ? (
        <Empty title="sinal fraco"><p>Não achei nada com &quot;{q}&quot;. Tente o nome original em inglês.</p></Empty>
      ) : (
        <div className="grid">
          {list.map((s) => (
            <PosterCard key={s.id} id={s.id} href={movie ? `/filme/${s.id}` : undefined} title={movie ? s.title : s.name} poster={s.poster_path} sub={label(s)} />
          ))}
        </div>
      )}
    </section>
  );
}
