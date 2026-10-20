"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sb } from "@/lib/supabase";
import { img } from "@/lib/tmdb";
import Intro from "./Intro";
import Wordmark from "./Wordmark";

const Ctx = createContext(null);
export const useDomi = () => useContext(Ctx);

const NAV = [
  { href: "/", label: "Coleção", icon: "M4 5h16v11H4z M8 20h8 M12 16v4" },
  { href: "/buscar", label: "Buscar", icon: "M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14z M20 20l-4-4" },
  { href: "/match", label: "Match", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" },
  { href: "/retro", label: "Retrô", icon: "M5 4h14v16H5z M9 9l6 3l-6 3z" },
];

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

export default function Shell({ children }) {
  const [session, setSession] = useState(undefined);
  const [shows, setShows] = useState(null);
  const [intro, setIntro] = useState(false);
  const [toast, setToast] = useState(null);
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

  useEffect(() => {
    if (session) reload();
    else if (session === null) setShows(null);
  }, [session, reload]);

  const say = useCallback((text) => {
    setToast(text);
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(null), 2600);
  }, []);

  /** Cria ou atualiza uma série da coleção e devolve a linha salva. */
  const saveShow = useCallback(async (fields) => {
    const uid = (await sb().auth.getUser()).data.user?.id;
    const { data, error } = await sb().from("shows").upsert({ ...fields, user_id: uid }, { onConflict: "user_id,tmdb_id" }).select().single();
    if (error) { say("Não consegui salvar. Confira a internet e tente de novo."); throw error; }
    setShows((list) => [data, ...(list || []).filter((s) => s.tmdb_id !== data.tmdb_id)]);
    return data;
  }, [say]);

  const removeShow = useCallback(async (tmdbId) => {
    await sb().from("episodes_watched").delete().eq("tmdb_show_id", tmdbId);
    const { error } = await sb().from("shows").delete().eq("tmdb_id", tmdbId);
    if (error) { say("Não consegui remover agora."); return false; }
    setShows((list) => (list || []).filter((s) => s.tmdb_id !== tmdbId));
    return true;
  }, [say]);

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

  const value = { session, shows, byTmdb, reload, saveShow, removeShow, say, posters };

  return (
    <Ctx.Provider value={value}>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Domi TV, início">
          <Wordmark className="brand-wm" />
        </Link>
        <nav className="topnav" aria-label="Seções">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}>{n.label}</Link>
          ))}
        </nav>
        <details className="menu">
          <summary aria-label="Menu">•••</summary>
          <div className="menu-pop">
            <Link href="/importar">Importar do TV Time</Link>
            <button type="button" onClick={() => { try { sessionStorage.removeItem("domi-intro"); } catch {} setIntro(true); }}>Ver a abertura</button>
            <button type="button" onClick={() => sb().auth.signOut()}>Sair</button>
            <p className="credit">Dados e imagens de séries: TMDB. Este app usa a API do TMDB, mas não é endossado nem certificado por ele.</p>
          </div>
        </details>
      </header>
      <main className="page">{children}</main>
      <nav className="tabbar" aria-label="Seções">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={n.icon} /></svg>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
      <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div>
    </Ctx.Provider>
  );
}
