"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { Empty } from "@/components/bits";
import { recs, img, tmdb, showFields } from "@/lib/tmdb";
import { sb } from "@/lib/supabase";
import { GENRES, today } from "@/lib/constants";

export default function Match() {
  const { shows, byTmdb, saveShow, say, reloadSwipes, profile } = useDomi();
  const [matches, setMatches] = useState([]);
  const [partner, setPartner] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [deck, setDeck] = useState(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState(null);
  const start = useRef(null);

  useEffect(() => {
    if (!shows) return;
    (async () => {
      try {
        const loved = shows.filter((s) => s.rating >= 4 || s.favorite);
        const pool = (loved.length ? loved : shows.filter((s) => s.status === "finalizada" || s.status === "assistindo"));
        const seeds = pool.sort(() => Math.random() - 0.5).slice(0, 10).map((s) => s.tmdb_id);
        const [{ results }, { data: swiped }] = await Promise.all([recs(seeds), sb().from("swipes").select("tmdb_id")]);
        const skip = new Set((swiped || []).map((s) => s.tmdb_id));
        let list = results.filter((r) => !byTmdb.has(r.id) && !skip.has(r.id));
        // modo casal: mistura no baralho as séries que a outra pessoa curtiu
        const pend = await sb().rpc("couple_pending");
        if (!pend.error && pend.data?.length) {
          const extra = (await Promise.all(pend.data.slice(0, 12).map(async ({ tmdb_id }) => {
            if (list.some((r) => r.id === tmdb_id) || byTmdb.has(tmdb_id)) return null;
            try {
              const d = await tmdb(`tv/${tmdb_id}`);
              return d.poster_path ? { id: d.id, name: d.name, poster_path: d.poster_path, overview: d.overview, year: (d.first_air_date || "").slice(0, 4), genre_ids: (d.genres || []).map((g) => g.id), because: [] } : null;
            } catch { return null; }
          }))).filter(Boolean);
          extra.forEach((c, i) => list.splice(Math.min(list.length, 1 + i * 3 + Math.floor(Math.random() * 2)), 0, c));
        }
        setDeck(list);
      } catch {
        setErr("As sugestões não carregaram. Tente de novo daqui a pouco.");
      }
    })();
  }, [shows === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sb().rpc("couple_matches").then(({ data, error }) => { if (!error) setMatches(data || []); });
    sb().rpc("couple_partner").then(({ data, error }) => { if (!error && data?.[0]) setPartner(data[0].name); });
  }, []);

  const top = deck?.[0];

  const decide = async (decision) => {
    if (!top || leaving) return;
    setLeaving(decision);
    const card = top;
    setTimeout(() => { setDeck((d) => d.slice(1)); setLeaving(null); setDrag({ x: 0, y: 0, active: false }); }, 280);
    try {
      await sb().from("swipes").upsert({ tmdb_id: card.id, decision }, { onConflict: "user_id,tmdb_id" });
      if (decision !== "nao") {
        const full = await tmdb(`tv/${card.id}`);
        await saveShow({ ...showFields(full), status: decision === "quero" ? "quero" : "finalizada", ...(decision === "vi" ? { finished_at: today() } : {}) });
        if (decision === "quero") {
          const m = await sb().rpc("couple_matches");
          if (!m.error) {
            setMatches(m.data || []);
            if ((m.data || []).some((x) => x.tmdb_id === card.id)) setCelebrate(card);
            else say(`${card.name} foi para quero ver`);
          } else say(`${card.name} foi para quero ver`);
        } else say(`${card.name} entrou na coleção`);
      }
      reloadSwipes();
    } catch {
      say("Não consegui guardar essa escolha.");
    }
  };

  const onDown = (e) => { start.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ x: 0, y: 0, active: true }); };
  const onMove = (e) => { if (!start.current) return; setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true }); };
  const onUp = () => {
    if (!start.current) return;
    start.current = null;
    if (drag.x > 110) decide("quero");
    else if (drag.x < -110) decide("nao");
    else if (drag.y < -130) decide("vi");
    else setDrag({ x: 0, y: 0, active: false });
  };

  if (err) return <p className="err">{err}</p>;
  if (!deck) return <div className="loading">procurando séries com a sua cara…</div>;

  const fly = leaving === "quero" ? { x: 600, y: drag.y } : leaving === "nao" ? { x: -600, y: drag.y } : leaving === "vi" ? { x: 0, y: -800 } : drag;
  const intent = leaving || (drag.x > 50 ? "quero" : drag.x < -50 ? "nao" : drag.y < -70 ? "vi" : null);

  return (
    <section className="match">
      <div className="match-head">
        <h1 className="h-display">Match</h1>
        <p className="muted">Arraste para a direita se quer ver, para a esquerda se não curtiu, para cima se já viu.</p>
      </div>

      {matches.length > 0 && (
        <section className="together">
          <div className="hrow-head"><div><p className="eyebrow">vocês duas deram ♥</p><h2>Pra ver juntas</h2></div><span className="mono-stamp">{matches.length}</span></div>
          <div className="hrow-track">
            {matches.map((m) => {
              const s = byTmdb.get(m.tmdb_id);
              return (
                <Link key={m.tmdb_id} href={`/serie/${m.tmdb_id}`} className="ptile">
                  <div className="ptile-img">{s?.poster_path ? <img src={img(s.poster_path)} alt="" loading="lazy" /> : <div className="noposter"><span>{s?.title || "Série"}</span></div>}</div>
                  <span className="ptile-t">{s?.title || "Série"}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {celebrate && (
        <div className="unlock" role="dialog" aria-modal="true" aria-label="Deu match">
          <div className="unlock-card couple">
            <p className="eyebrow">vocês duas deram ♥</p>
            <h2 className="match-title">Deu match!</h2>
            <div className="couple-stage">
              <img src={img(celebrate.poster_path, "w342")} alt={`Pôster de ${celebrate.name}`} />
              <span className="avatar md left" style={{ background: profile.color || undefined }}>{(profile.name || "D").charAt(0).toUpperCase()}</span>
              <span className="avatar md right pink">{(partner || "R").charAt(0).toUpperCase()}</span>
              <span className="couple-heart" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg></span>
            </div>
            <p>{celebrate.name} entrou na lista <b>pra ver juntas</b>{partner ? ` com ${partner}` : ""}.</p>
            <div className="row-btns center">
              <Link className="btn btn-primary" href={`/serie/${celebrate.id}`} onClick={() => setCelebrate(null)}>Ver série</Link>
              <button className="btn btn-ghost" type="button" onClick={() => setCelebrate(null)}>Continuar</button>
            </div>
          </div>
        </div>
      )}

      {!top ? (
        <Empty title="acabaram os cards por hoje">
          <p>Dê nota para mais séries na coleção e volte: as sugestões ficam mais certeiras.</p>
          <Link className="btn btn-primary" href="/">Ver coleção</Link>
        </Empty>
      ) : (
        <>
          <div className="deck">
            {deck.slice(1, 3).reverse().map((c, i) => (
              <div key={c.id} className={`mcard under u${i}`}>
                <img src={img(c.poster_path, "w500")} alt="" />
              </div>
            ))}
            <div
              key={top.id}
              className={`mcard top ${drag.active ? "dragging" : ""}`}
              style={{ transform: `translate(${fly.x}px, ${fly.y}px) rotate(${fly.x / 18}deg)` }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            >
              <img src={img(top.poster_path, "w500")} alt={`Pôster de ${top.name}`} draggable="false" />
              <span className={`mstamp yes ${intent === "quero" ? "on" : ""}`}>quero!</span>
              <span className={`mstamp no ${intent === "nao" ? "on" : ""}`}>nem</span>
              <span className={`mstamp seen ${intent === "vi" ? "on" : ""}`}>já vi</span>
              <div className="mcard-info">
                {top.because?.length > 0 && <p className="because">porque você curtiu {top.because.slice(0, 2).join(" e ")}</p>}
                <h2>{top.name} <small>{top.year}</small></h2>
                <div className="mgenres">{top.genre_ids.slice(0, 3).map((g) => GENRES[g] && <span key={g}>{GENRES[g]}</span>)}</div>
                {top.overview && <p className="mover">{top.overview}</p>}
              </div>
            </div>
          </div>
          <div className="match-btns">
            <button type="button" className="mbtn no" onClick={() => decide("nao")} aria-label="Não curti">✕</button>
            <button type="button" className="mbtn seen" onClick={() => decide("vi")} aria-label="Já vi">
              <svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6s10 6 10 6s-3.5 6-10 6S2 12 2 12z M12 9a3 3 0 1 1 0 6a3 3 0 0 1 0-6z" /></svg>
            </button>
            <button type="button" className="mbtn yes" onClick={() => decide("quero")} aria-label="Quero ver">
              <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
            </button>
            <Link className="mbtn info" href={`/serie/${top.id}`} aria-label="Ver detalhes">i</Link>
          </div>
        </>
      )}
    </section>
  );
}
