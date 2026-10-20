"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sb } from "@/lib/supabase";
import { img, prefetchShow, prefetchMovie } from "@/lib/tmdb";
import Intro from "./Intro";
import Wordmark from "./Wordmark";
import { computePatches } from "@/lib/patches";
import PatchArt from "./PatchArt";

const Ctx = createContext(null);
export const useDomi = () => useContext(Ctx);

const NAV = [
  { href: "/", label: "Início", icon: "M4 11l8-7l8 7v9h-5v-6H9v6H4z" },
  { href: "/buscar", label: "Buscar", icon: "M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14z M20 20l-4-4" },
  { href: "/match", label: "Match", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" },
  { href: "/quiz", label: "Quiz", icon: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" },
  { href: "/perfil", label: "Perfil", icon: "M12 5a4 4 0 1 1 0 8a4 4 0 0 1 0-8z M4 20c1.5-4 5-5 8-5s6.5 1 8 5" },
];

const tiltOf = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return (Math.abs(h) % 15) - 7; };

export function PatchBadge({ p, size = 64, locked = false, tilt = false }) {
  return (
    <span className="patch2" style={tilt ? { "--tilt": `${tiltOf(p.id)}deg` } : undefined}>
      <PatchArt p={p} size={size} locked={locked} />
    </span>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const enter = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg("E-mail ou senha não conferem. Tente de novo.");
  };

  return (
    <Intro>
      <form className="login" onSubmit={enter}>
        <label htmlFor="login-email" className="sr">E-mail</label>
        <input id="login-email" type="email" required placeholder="seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label htmlFor="login-pass" className="sr">Senha</label>
        <input id="login-pass" type="password" required placeholder="senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? "Entrando…" : "Entrar"}</button>
        {msg && <p className="login-msg">{msg}</p>}
      </form>
    </Intro>
  );
}

/** Foto de perfil, ou a inicial na cor escolhida. */
export function Avatar({ profile = {}, className = "", fallback = "D", style }) {
  const letter = (profile.name || fallback).trim().charAt(0).toUpperCase();
  return (
    <span className={`avatar ${className}`} style={{ background: profile.color || undefined, ...style }}>
      {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : letter}
    </span>
  );
}

/** Menu dos três pontinhos: fecha sozinho ao escolher, ao tocar fora, ao trocar de tela ou no Esc. */
function Menu({ children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>•••</button>
      {open && <div className="menu-pop" onClick={(e) => { if (e.target.closest("a,button")) setOpen(false); }}>{children}</div>}
    </div>
  );
}

export default function Shell({ children }) {
  const [session, setSession] = useState(undefined);
  const [shows, setShows] = useState(null);
  const [intro, setIntro] = useState(false);
  const [toast, setToast] = useState(null);
  const [eps, setEps] = useState(null);
  const [swipes, setSwipes] = useState([]);
  const [profile, setProfile] = useState({});
  const [movies, setMovies] = useState(null);
  const [moviesMissing, setMoviesMissing] = useState(false);
  const [unlocked, setUnlocked] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const path = usePathname();

  useEffect(() => {
    const c = sb();
    c.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = c.auth.onAuthStateChange((_e, s) => setSession(s));
    try { if (!sessionStorage.getItem("domi-intro")) setIntro(true); } catch {}
    return () => sub.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    const { data, error } = await sb().from("shows").select("*").order("updated_at", { ascending: false }).range(0, 4999);
    if (!error) setShows(data);
  }, []);

  const reloadEps = useCallback(async () => {
    const all = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await sb().from("episodes_watched").select("tmdb_show_id,season,episode,runtime,watched_at").order("watched_at", { ascending: false }).range(from, from + 999);
      if (error) break;
      all.push(...data);
      if (data.length < 1000) break;
    }
    setEps(all);
  }, []);

  /** Filmes ficam numa tabela própria; se ela ainda não existir no banco, o app segue sem filmes. */
  const reloadMovies = useCallback(async () => {
    const { data, error } = await sb().from("movies").select("*").order("updated_at", { ascending: false }).range(0, 4999);
    if (error) { setMovies([]); setMoviesMissing(true); return; }
    setMoviesMissing(false);
    setMovies(data || []);
  }, []);

  const reloadSwipes = useCallback(async () => {
    const { data } = await sb().from("swipes").select("tmdb_id,decision,created_at").range(0, 4999);
    setSwipes(data || []);
  }, []);

  useEffect(() => {
    if (session) {
      reload(); reloadEps(); reloadSwipes(); reloadMovies();
      setProfile(session.user?.user_metadata || {});
    } else if (session === null) { setShows(null); setEps(null); setMovies(null); }
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Atualiza a lista local de episódios depois de marcar/desmarcar, sem recarregar tudo. */
  const epsChanged = useCallback(({ add = [], remove } = {}) => {
    setEps((list) => {
      let next = list || [];
      if (remove) next = next.filter((e) => !(e.tmdb_show_id === remove.tmdbId && (remove.season == null || e.season === remove.season) && (remove.episode == null || e.episode === remove.episode)));
      if (add.length) {
        const keys = new Set(next.map((e) => `${e.tmdb_show_id}|${e.season}|${e.episode}`));
        const fresh = add.filter((e) => !keys.has(`${e.tmdb_show_id}|${e.season}|${e.episode}`)).map((e) => ({ watched_at: new Date().toISOString(), ...e }));
        next = [...fresh, ...next];
      }
      return next;
    });
  }, []);

  const saveProfile = useCallback(async (patch) => {
    const { data, error } = await sb().auth.updateUser({ data: patch });
    if (error) { return false; }
    setProfile(data.user?.user_metadata || {});
    return true;
  }, []);

  const patches = useMemo(() => (shows && eps ? computePatches({ shows, eps, swipes }) : null), [shows, eps, swipes]);

  // patch novo: compara com os que ela já viu
  useEffect(() => {
    if (!patches || !session) return;
    const done = patches.filter((p) => p.done).map((p) => p.id);
    const seen = profile.seen_patches;
    if (!Array.isArray(seen)) { saveProfile({ seen_patches: done }); return; }
    const fresh = patches.filter((p) => p.done && !seen.includes(p.id));
    if (fresh.length) {
      setUnlocked(fresh);
      saveProfile({ seen_patches: [...new Set([...seen, ...done])] });
    }
  }, [patches]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = useCallback((text) => {
    setToast(text);
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(null), 2600);
  }, []);

  const showsRef = useRef(null);
  showsRef.current = shows;
  const uidRef = useRef(null);
  uidRef.current = session?.user?.id || null;

  /** Cria ou atualiza uma série: muda na tela na hora e salva em seguida; se falhar, desfaz. */
  const saveShow = useCallback(async (fields) => {
    const uid = uidRef.current || (await sb().auth.getUser()).data.user?.id;
    const prev = (showsRef.current || []).find((s) => s.tmdb_id === fields.tmdb_id);
    const others = (list) => (list || []).filter((s) => s.tmdb_id !== fields.tmdb_id);
    setShows((list) => [{ ...(prev || {}), ...fields, user_id: uid, updated_at: new Date().toISOString() }, ...others(list)]);
    const { data, error } = await sb().from("shows").upsert({ ...fields, user_id: uid }, { onConflict: "user_id,tmdb_id" }).select().single();
    if (error) {
      setShows((list) => (prev ? [prev, ...others(list)] : others(list)));
      const half = error.code === "22P02" || /smallint|integer/i.test(error.message || "");
      say(half ? "Meia estrela ainda não está ligada no banco: rode a atualização 2 no Supabase." : "Não consegui salvar. Confira a internet e tente de novo.");
      throw error;
    }
    setShows((list) => [data, ...others(list)]);
    return data;
  }, [say]);

  // Prefetch: ao passar o mouse ou encostar o dedo num pôster, a série já começa a carregar.
  useEffect(() => {
    const seen = new Set();
    const go = (e) => {
      const a = e.target.closest?.('a[href^="/serie/"], a[href^="/filme/"]');
      if (!a) return;
      const [, kind, raw] = a.getAttribute("href").split("/");
      const id = Number(raw);
      if (id && !seen.has(kind + id)) { seen.add(kind + id); (kind === "filme" ? prefetchMovie : prefetchShow)(id); }
    };
    document.addEventListener("pointerover", go, { passive: true });
    document.addEventListener("touchstart", go, { passive: true });
    return () => { document.removeEventListener("pointerover", go); document.removeEventListener("touchstart", go); };
  }, []);

  const removeShow = useCallback(async (tmdbId) => {
    await sb().from("episodes_watched").delete().eq("tmdb_show_id", tmdbId);
    const { error } = await sb().from("shows").delete().eq("tmdb_id", tmdbId);
    if (error) { say("Não consegui remover agora."); return false; }
    setShows((list) => (list || []).filter((s) => s.tmdb_id !== tmdbId));
    return true;
  }, [say]);

  const moviesRef = useRef(null);
  moviesRef.current = movies;
  /** Igual ao saveShow, para filmes. */
  const saveMovie = useCallback(async (fields) => {
    const uid = uidRef.current || (await sb().auth.getUser()).data.user?.id;
    const prev = (moviesRef.current || []).find((m) => m.tmdb_id === fields.tmdb_id);
    const others = (list) => (list || []).filter((m) => m.tmdb_id !== fields.tmdb_id);
    setMovies((list) => [{ ...(prev || {}), ...fields, user_id: uid, updated_at: new Date().toISOString() }, ...others(list)]);
    const { data, error } = await sb().from("movies").upsert({ ...fields, user_id: uid }, { onConflict: "user_id,tmdb_id" }).select().single();
    if (error) {
      setMovies((list) => (prev ? [prev, ...others(list)] : others(list)));
      const missing = error.code === "42P01" || error.code === "PGRST205" || /movies/i.test(error.message || "");
      say(missing ? "Os filmes ainda não estão ligados no banco: rode a atualização 4 no Supabase." : "Não consegui salvar. Confira a internet e tente de novo.");
      throw error;
    }
    setMovies((list) => [data, ...others(list)]);
    return data;
  }, [say]);

  const removeMovie = useCallback(async (tmdbId) => {
    const { error } = await sb().from("movies").delete().eq("tmdb_id", tmdbId);
    if (error) { say("Não consegui remover agora."); return false; }
    setMovies((list) => (list || []).filter((m) => m.tmdb_id !== tmdbId));
    return true;
  }, [say]);

  const byMovie = useMemo(() => new Map((movies || []).map((m) => [m.tmdb_id, m])), [movies]);
  const byTmdb = useMemo(() => new Map((shows || []).map((s) => [s.tmdb_id, s])), [shows]);
  const posters = useMemo(() => (shows || []).filter((s) => s.poster_path).map((s) => img(s.poster_path, "w185")), [shows]);

  if (session === undefined) return <div className="boot"><Wordmark className="boot-logo" /></div>;
  if (!session) return <Login />;

  if (intro) {
    return (
      <Intro
        posters={posters}
        onEnter={() => { try { sessionStorage.setItem("domi-intro", "1"); } catch {} setIntro(false); }}
      />
    );
  }

  const value = { movies, byMovie, saveMovie, removeMovie, reloadMovies, moviesMissing, session, shows, byTmdb, reload, saveShow, removeShow, say, posters, eps, reloadEps, epsChanged, swipes, reloadSwipes, profile, saveProfile, patches };

  return (
    <Ctx.Provider value={value}>
      <header className={`topbar ${path === "/" ? "over" : ""} ${scrolled ? "solid" : ""}`}>
        <Link href="/" className="brand" aria-label="Domi TV, início">
          <Wordmark className="brand-wm" />
        </Link>
        <div className="top-right">
          <Link href="/colecao" className={`top-link ${path === "/colecao" ? "on" : ""}`}>Coleção</Link>
          <Menu>
            <Link href="/colecao">Coleção completa</Link>
            <Link href="/retro">Retrospectiva</Link>
            <Link href="/patches">Patches</Link>
            <Link href="/importar">Importar do TV Time</Link>
            <button type="button" onClick={() => { try { sessionStorage.removeItem("domi-intro"); } catch {} setIntro(true); }}>Ver a abertura</button>
            <button type="button" onClick={() => sb().auth.signOut()}>Sair</button>
            <p className="credit">Dados e imagens de séries: TMDB. Este app usa a API do TMDB, mas não é endossado nem certificado por ele.</p>
          </Menu>
          <Link href="/perfil" className="avatar-link" aria-label="Perfil"><Avatar profile={profile} className="sm" /></Link>
        </div>
      </header>
      <main className="page">{children}</main>
      <nav className="pillnav" aria-label="Seções">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={on ? "on" : ""} aria-label={n.label} aria-current={on ? "page" : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={n.icon} /></svg>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div>
      {unlocked && (
        <div className="unlock" role="dialog" aria-modal="true" aria-label="Patch novo" onClick={(e) => { if (e.target === e.currentTarget) setUnlocked(null); }}>
          <div className="unlock-card">
            <p className="eyebrow">{unlocked.length > 1 ? `${unlocked.length} patches novos!` : "patch novo!"}</p>
            <div className="unlock-row">
              {unlocked.slice(0, 5).map((p) => <PatchBadge key={p.id} p={p} tilt size={unlocked.length > 1 ? 76 : 150} />)}
            </div>
            {unlocked.length === 1 ? (<><h2>{unlocked[0].name}</h2><p>{unlocked[0].desc}</p></>) : <h2>Costuradas no seu perfil</h2>}
            <div className="row-btns center">
              <Link className="btn btn-primary" href="/patches" onClick={() => setUnlocked(null)}>Ver mural</Link>
              <button className="btn btn-ghost" type="button" onClick={() => setUnlocked(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
