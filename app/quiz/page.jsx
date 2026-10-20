"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDomi } from "@/components/Shell";
import { tmdb, quiz, img, showFields, SHOW_PARAMS } from "@/lib/tmdb";
import { usePosterColor, accentVars } from "@/lib/color";
import { GENRES } from "@/lib/constants";

const QUESTIONS = [
  {
    k: "clima", eyebrow: "pra começar", title: "Hoje você quer…",
    options: [
      { v: "rir", t: "Rir alto", d: "comédia, piada boa", c: "#FFB443" },
      { v: "chorar", t: "Chorar um pouquinho", d: "drama que aperta", c: "#6EA8FF" },
      { v: "frio", t: "Frio na barriga", d: "romance, casal, suspiro", c: "#FF7AA8" },
      { v: "tensao", t: "Ficar tensa", d: "mistério, crime, plot twist", c: "#B07CFF" },
      { v: "outro", t: "Ir pra outro mundo", d: "fantasia, sci-fi, magia", c: "#4FD1C5" },
      { v: "conforto", t: "Colinho", d: "algo leve e quentinho", c: "#F3C9A0" },
    ],
  },
  {
    k: "tempo", eyebrow: "tempo", title: "Quanto tempo tem?",
    options: [
      { v: "curto", t: "Uns 20 minutos", d: "episódio curtinho", c: "#7FD3A8" },
      { v: "medio", t: "Uma noite", d: "episódios de 40 min a 1 h", c: "#6EA8FF" },
      { v: "maratona", t: "Maratona", d: "de preferência já terminada", c: "#FF9A3C" },
      { v: "tanto", t: "Tanto faz", d: "", c: "#8C9BC8" },
    ],
  },
  {
    k: "epoca", eyebrow: "novidade", title: "Que tipo de achado?",
    options: [
      { v: "novinha", t: "Lançamento", d: "saiu agora, todo mundo falando", c: "#FF7AA8" },
      { v: "joia", t: "Joia escondida", d: "nota alta, pouca gente viu", c: "#4FD1C5" },
      { v: "classico", t: "Clássico", d: "aquela que todo mundo já viu, menos você", c: "#F3C9A0" },
      { v: "tanto", t: "Surpreende", d: "", c: "#8C9BC8" },
    ],
  },
  {
    k: "origem", eyebrow: "passaporte", title: "De onde?",
    options: [
      { v: "tanto", t: "Qualquer lugar", d: "", c: "#8C9BC8" },
      { v: "us", t: "Estados Unidos", d: "", c: "#6EA8FF" },
      { v: "gb", t: "Britânica", d: "", c: "#B07CFF" },
      { v: "kr", t: "Coreana", d: "k-drama", c: "#FF7AA8" },
      { v: "es", t: "Espanha e latinas", d: "", c: "#FFB443" },
      { v: "br", t: "Brasileira", d: "", c: "#7FD3A8" },
      { v: "jp", t: "Japonesa", d: "anime e dorama", c: "#FF7A6B" },
    ],
  },
  {
    k: "cabeca", eyebrow: "por último", title: "E a cabeça?",
    options: [
      { v: "desligar", t: "Quero desligar", d: "sem precisar pensar", c: "#7FD3A8" },
      { v: "atencao", t: "Topo prestar atenção", d: "pode ser complexa", c: "#B07CFF" },
      { v: "tanto", t: "Tanto faz", d: "", c: "#8C9BC8" },
    ],
  },
];

const label = (k, v) => QUESTIONS.find((q) => q.k === k)?.options.find((o) => o.v === v);

function Question({ q, step, total, onPick, onBack, chosen }) {
  return (
    <section className="qz-step" key={q.k}>
      <div className="qz-top">
        {step > 0 ? <button type="button" className="btn-round sm" onClick={onBack} aria-label="Pergunta anterior">‹</button> : <span className="qz-spacer" />}
        <div className="qz-dots" aria-label={`Pergunta ${step + 1} de ${total}`}>
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < step ? "done" : i === step ? "on" : ""} />)}
        </div>
        <span className="qz-spacer" />
      </div>
      <p className="eyebrow">{q.eyebrow}</p>
      <h1 className="h-display">{q.title}</h1>
      <div className="qz-opts">
        {q.options.map((o, i) => (
          <button key={o.v} type="button" className={`qz-opt ${chosen === o.v ? "on" : ""}`} style={{ "--c": o.c, animationDelay: `${i * 45}ms` }} onClick={() => onPick(o.v)}>
            <span className="qz-dot" aria-hidden="true" />
            <b>{o.t}</b>
            {o.d && <small>{o.d}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}

function Searching() {
  return (
    <section className="qz-search" role="status">
      <div className="qz-reel" aria-hidden="true"><i /><i /><i /></div>
      <p className="eyebrow">procurando no catálogo inteiro</p>
      <h1 className="h-display">Achando a série da vez…</h1>
    </section>
  );
}

function Result({ pool, answers, onRestart }) {
  const { byTmdb, saveShow, say } = useDomi();
  const [cur, setCur] = useState(0);
  const [full, setFull] = useState(null);
  const main = pool[cur];
  const alts = useMemo(() => (pool.length > 1 ? [1, 2].map((d) => pool[(cur + d) % pool.length]).filter((s, i, a) => s.id !== main.id && a.findIndex((x) => x.id === s.id) === i) : []), [pool, cur, main]);
  const rgb = usePosterColor(main?.poster_path ? img(main.poster_path, "w92") : null);

  useEffect(() => {
    if (!main) return;
    setFull(null);
    let alive = true;
    tmdb(`tv/${main.id}`, SHOW_PARAMS).then((d) => alive && setFull(d)).catch(() => {});
    return () => { alive = false; };
  }, [main?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!main) {
    return (
      <section className="qz-search">
        <h1 className="h-display">Não achei nada com essa vibe</h1>
        <p className="muted">Ou ela já viu tudo que encaixa. Tenta outra combinação.</p>
        <button type="button" className="btn btn-primary" onClick={onRestart}>Refazer o quiz</button>
      </section>
    );
  }

  const another = () => { setCur((c) => (c + 3) % pool.length); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const choose = (s) => { setCur(pool.findIndex((x) => x.id === s.id)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const mine = byTmdb.get(main.id) || null;
  const want = async () => {
    try {
      const d = full || (await tmdb(`tv/${main.id}`, SHOW_PARAMS));
      await saveShow({ ...showFields(d), status: "quero" });
      say(`${main.name} foi pro Quero ver`);
    } catch {}
  };

  const providers = full?.["watch/providers"]?.results?.BR?.flatrate || [];
  const seasons = full?.number_of_seasons;
  const rt = full?.episode_run_time?.[0];
  const why = ["clima", "tempo", "epoca", "origem", "cabeca"].map((k) => answers[k] !== "tanto" && label(k, answers[k])?.t).filter(Boolean);
  const genres = (main.genre_ids || []).map((g) => GENRES[g]).filter(Boolean).slice(0, 2);

  return (
    <section className="qz-result tinted" style={accentVars(rgb)}>
      {main.backdrop_path && <div className="qz-bg" style={{ backgroundImage: `url(${img(main.backdrop_path, "w1280")})` }} aria-hidden="true" />}
      <p className="eyebrow">a de hoje é</p>
      <div className="qz-pick" key={main.id}>
        <Link href={`/serie/${main.id}`} className="qz-poster"><img src={img(main.poster_path, "w500")} alt={`Pôster de ${main.name}`} /></Link>
        <div className="qz-info">
          <h1 className="h-display">{main.name}</h1>
          <p className="qz-meta">
            {[main.year, genres.join(" · "), seasons ? `${seasons} temporada${seasons > 1 ? "s" : ""}` : null, rt ? `~${rt} min` : null].filter(Boolean).join("  ·  ")}
            {main.vote ? <span className="qz-vote">★ {main.vote.toFixed(1)}</span> : null}
          </p>
          {main.because && <p className="qz-because">porque você amou <b>{main.because}</b></p>}
          {main.overview && <p className="qz-ov">{main.overview.length > 260 ? main.overview.slice(0, 257).trimEnd() + "…" : main.overview}</p>}
          {why.length > 0 && <div className="qz-why">{why.map((w) => <span key={w}>{w}</span>)}</div>}
          {providers.length > 0 && (
            <div className="qz-prov">
              <span className="muted">tem em</span>
              {providers.slice(0, 4).map((p) => <img key={p.provider_id} src={img(p.logo_path, "w92")} alt={p.provider_name} title={p.provider_name} />)}
            </div>
          )}
          <div className="qz-actions">
            <Link href={`/serie/${main.id}`} className="btn btn-primary">Ver a série</Link>
            {mine ? <span className="btn btn-ghost" aria-disabled="true">Já está na coleção</span> : <button type="button" className="btn btn-ghost" onClick={want}>+ Quero ver</button>}
          </div>
        </div>
      </div>

      {alts.length > 0 && (
        <div className="qz-alts">
          <p className="eyebrow">ou então</p>
          <div className="qz-alt-row">
            {alts.map((s) => (
              <button key={s.id} type="button" className="qz-alt" onClick={() => choose(s)}>
                <img src={img(s.poster_path, "w185")} alt="" />
                <span><b>{s.name}</b><small>{s.year}{s.vote ? ` · ★ ${s.vote.toFixed(1)}` : ""}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="qz-foot">
        <button type="button" className="btn btn-ghost" onClick={another}>Sortear outra</button>
        <button type="button" className="btn btn-ghost" onClick={onRestart}>Refazer o quiz</button>
      </div>
    </section>
  );
}

export default function Quiz() {
  const { shows, say } = useDomi();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [pool, setPool] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (ans) => {
    setBusy(true);
    try {
      const list = shows || [];
      const exclude = list.map((s) => s.tmdb_id);
      const loved = list.filter((s) => s.favorite || Number(s.rating) >= 4.5).map((s) => s.tmdb_id);
      const seeds = loved.sort(() => Math.random() - 0.5).slice(0, 5);
      const r = await quiz(ans, exclude, seeds);
      setPool(r.results || []);
    } catch {
      say("Não consegui buscar agora. Confira a internet e tente de novo.");
      setStep(QUESTIONS.length - 1);
    } finally {
      setBusy(false);
    }
  };

  const pick = (v) => {
    const q = QUESTIONS[step];
    const ans = { ...answers, [q.k]: v };
    setAnswers(ans);
    if (step + 1 < QUESTIONS.length) setStep(step + 1);
    else { setStep(QUESTIONS.length); run(ans); }
  };
  const restart = () => { setPool(null); setAnswers({}); setStep(0); };

  return (
    <div className="quiz">
      {step < QUESTIONS.length ? (
        <Question q={QUESTIONS[step]} step={step} total={QUESTIONS.length} chosen={answers[QUESTIONS[step].k]} onPick={pick} onBack={() => setStep(step - 1)} />
      ) : busy || !pool ? (
        <Searching />
      ) : (
        <Result pool={pool} answers={answers} onRestart={restart} />
      )}
    </div>
  );
}
