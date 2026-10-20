"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { Stars } from "@/components/bits";
import { tmdb, img, movieFields, MOVIE_PARAMS } from "@/lib/tmdb";
import { today } from "@/lib/constants";
import { usePosterColor, accentVars } from "@/lib/color";
import Soundtrack from "@/components/Soundtrack";

const hm = (min) => (min ? `${Math.floor(min / 60) ? `${Math.floor(min / 60)}h` : ""}${min % 60 ? ` ${min % 60}min` : ""}`.trim() : null);
const dateInput = (iso) => (iso ? iso.slice(0, 10) : "");

export default function Filme() {
  const { id } = useParams();
  const tmdbId = Number(id);
  const router = useRouter();
  const { byMovie, saveMovie, removeMovie, say, moviesMissing } = useDomi();
  const mine = byMovie.get(tmdbId);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [similar, setSimilar] = useState([]);

  useEffect(() => {
    setD(null);
    tmdb(`movie/${tmdbId}`, MOVIE_PARAMS)
      .then(async (data) => {
        if (!data.overview) {
          try { data.overview = (await tmdb(`movie/${tmdbId}`, { language: "en-US" })).overview; } catch {}
        }
        setD(data);
      })
      .catch(() => setErr("Não consegui abrir esse filme agora."));
    tmdb(`movie/${tmdbId}/recommendations`).then((r) => setSimilar((r.results || []).filter((x) => x.poster_path).slice(0, 12))).catch(() => {});
  }, [tmdbId]);

  useEffect(() => {
    if (mine) setForm({ notes: mine.notes || "", watched_at: dateInput(mine.watched_at) });
  }, [mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = useMemo(() => (d ? movieFields(d) : null), [d]);
  const rgb = usePosterColor(d?.poster_path ? img(d.poster_path, "w92") : null);

  const save = async (patch) => {
    if (!fields) return null;
    try { return await saveMovie({ ...fields, ...(mine ? { status: mine.status } : {}), ...patch }); } catch { return null; }
  };

  const markSeen = async () => {
    await save({ status: "visto", watched_at: mine?.watched_at || new Date().toISOString() });
    say("Marcado como visto. Que tal uma nota?");
  };
  const rewatch = async () => {
    await save({ status: "visto", rewatch_count: (mine?.rewatch_count || 0) + 1, watched_at: new Date().toISOString() });
    say("Revisto! Contei mais uma vez.");
  };

  const saveForm = async () => {
    if (!mine || !form) return;
    await save({ notes: form.notes.trim(), watched_at: form.watched_at ? new Date(form.watched_at + "T20:00:00").toISOString() : mine.watched_at });
    say("Salvo");
  };

  if (err) return <p className="err">{err}</p>;
  if (!d) {
    return (
      <article className="detail">
        <div className="hero">
          {mine?.backdrop_path && <img className="hero-bg" src={img(mine.backdrop_path, "w1280")} alt="" />}
          <div className="hero-fade" />
          <div className="hero-body">
            <div className="hero-poster">{mine?.poster_path ? <img src={img(mine.poster_path, "w500")} alt="" /> : <div className="sk" style={{ height: "100%" }} />}</div>
            <div className="hero-txt">{mine ? <h1>{mine.title}</h1> : <div className="sk" style={{ height: 48, width: 220 }} />}</div>
          </div>
        </div>
        <div className="sk sk-row" />
      </article>
    );
  }

  const providers = d["watch/providers"]?.results?.BR?.flatrate || [];
  const seen = mine?.status === "visto";

  return (
    <article className="detail tinted" style={accentVars(rgb)}>
      <div className="detail-glow" aria-hidden="true" />
      <div className="hero">
        {d.backdrop_path && <img className="hero-bg" src={img(d.backdrop_path, "w1280")} alt="" />}
        <div className="hero-fade" />
        <div className="hero-body">
          <div className="hero-poster">{d.poster_path ? <img src={img(d.poster_path, "w500")} alt={`Pôster de ${d.title}`} /> : <div className="noposter"><span>{d.title}</span></div>}</div>
          <div className="hero-txt">
            <p className="eyebrow">{["filme", fields.year].filter(Boolean).join(" · ")}</p>
            <h1>{d.title}</h1>
            {d.original_title && d.original_title !== d.title && <p className="orig">{d.original_title}</p>}
            <p className="meta">{[fields.genres.slice(0, 3).join(", "), hm(fields.runtime)].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {moviesMissing && <p className="err">Os filmes ainda não estão ligados no banco. Rode a atualização 4 no Supabase (SQL Editor) e recarregue.</p>}
          {!mine ? (
            <div className="addbox">
              <p className="eyebrow">adicionar à coleção</p>
              <div className="row-btns">
                <button className="btn btn-primary" type="button" onClick={markSeen}>Já vi</button>
                <button className="btn btn-ghost" type="button" onClick={async () => { await save({ status: "quero" }); say("Guardado na lista de quero ver"); }}>Quero ver</button>
              </div>
            </div>
          ) : (
            <div className="mybox">
              <div className="seg" role="group" aria-label="Status">
                <button type="button" aria-pressed={seen} className="st-finalizada" onClick={markSeen}>Visto</button>
                <button type="button" aria-pressed={!seen} className="st-quero" onClick={() => save({ status: "quero" })}>Quero ver</button>
              </div>
              {seen && (
                <div className="rate-row">
                  <span className="eyebrow">sua nota</span>
                  <Stars size="lg" value={mine.rating} onChange={(v) => save({ rating: v })} />
                  <button type="button" className={`fav ${mine.favorite ? "on" : ""}`} onClick={() => save({ favorite: !mine.favorite })} aria-pressed={mine.favorite} aria-label="Favorito">
                    <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
                  </button>
                </div>
              )}
              {seen && (
                <div className="rewatch-row">
                  <span className="muted">{mine.rewatch_count ? `visto ${mine.rewatch_count + 1} vezes` : "visto 1 vez"}</span>
                  <button type="button" className="btn btn-ghost" onClick={rewatch}>Vi de novo</button>
                </div>
              )}
            </div>
          )}

          {d.tagline && <p className="tagline-quote">“{d.tagline}”</p>}
          {d.overview && <p className="overview">{d.overview}</p>}

          {providers.length > 0 && (
            <div className="providers">
              <span className="eyebrow">onde assistir</span>
              <div>{providers.map((p) => <img key={p.provider_id} src={img(p.logo_path, "w92")} alt={p.provider_name} title={p.provider_name} />)}</div>
            </div>
          )}

          <Soundtrack title={d.title} originalTitle={d.original_title} />

          {similar.length > 0 && (
            <section className="hrow">
              <div className="hrow-head"><div><p className="eyebrow">na mesma vibe</p><h2>Filmes parecidos</h2></div></div>
              <div className="hrow-track">
                {similar.map((m) => (
                  <Link key={m.id} href={`/filme/${m.id}`} className="ptile">
                    <div className="ptile-img"><img src={img(m.poster_path)} alt="" loading="lazy" /></div>
                    <span className="ptile-t">{m.title}</span>
                    <span className="ptile-l">{(m.release_date || "").slice(0, 4)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {mine && form && (
          <aside className="detail-side">
            <h2>Caderninho</h2>
            {seen && <label className="field">Vi em<input className="input" type="date" max={today()} value={form.watched_at} onChange={(e) => setForm({ ...form, watched_at: e.target.value })} onBlur={saveForm} /></label>}
            <label className="field">Anotações<textarea className="input" rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} onBlur={saveForm} placeholder="o que ficou comigo…" /></label>
            <button type="button" className="btn btn-danger" onClick={async () => {
              if (!confirmDel) return setConfirmDel(true);
              if (await removeMovie(tmdbId)) { say("Removido da coleção"); router.push("/colecao?tipo=filmes"); }
            }}>{confirmDel ? "Confirmar: remover filme" : "Remover da coleção"}</button>
          </aside>
        )}
      </div>
    </article>
  );
}
