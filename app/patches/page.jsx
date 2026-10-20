"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDomi, PatchBadge } from "@/components/Shell";
import PatchArt from "@/components/PatchArt";

const fmt = (n) => Number(n).toLocaleString("pt-BR");

/** Patch grande que inclina acompanhando o dedo/mouse, como se fosse um bordado de verdade na mão. */
function Tilt({ children }) {
  const ref = useRef(null);
  const move = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 22).toFixed(1)}deg`);
    el.style.setProperty("--ry", `${(x * 22).toFixed(1)}deg`);
    el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(0)}%`);
    el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(0)}%`);
  };
  const reset = () => { const el = ref.current; if (el) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); } };
  return <div ref={ref} className="tilt" onPointerMove={move} onPointerLeave={reset}>{children}<span className="tilt-glare" aria-hidden="true" /></div>;
}

function Sheet({ p, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const locked = !p.done;
  const pct = p.goal ? Math.round((p.have / p.goal) * 100) : 0;
  return (
    <div className="unlock" role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`patch-sheet ${locked ? "is-locked" : ""}`} style={{ "--pc": p.color }}>
        <button type="button" className="sheet-x" onClick={onClose} aria-label="Fechar">×</button>
        <Tilt><PatchArt p={p} size={210} locked={locked} /></Tilt>
        <p className="eyebrow">{locked ? (p.secret ? "patch secreto" : "ainda no molde") : "costurado no perfil"}</p>
        <h2>{locked && p.secret ? "???" : p.name}</h2>
        <p className="sheet-desc">{locked && p.secret ? "Esse você descobre assistindo." : p.desc}</p>
        {locked && !p.secret && p.goal > 1 && (
          <div className="sheet-prog">
            <div className="thread-bar"><span style={{ width: `${pct}%` }} /></div>
            <span className="mono-stamp">{fmt(p.have)} / {fmt(p.goal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Patches() {
  const { patches } = useDomi();
  const [open, setOpen] = useState(null);
  if (!patches) return <div className="loading">desenrolando a linha…</div>;
  const done = patches.filter((p) => p.done);
  const todo = patches.filter((p) => !p.done).sort((a, b) => b.have / b.goal - a.have / a.goal);
  const pct = Math.round((done.length / patches.length) * 100);

  return (
    <div className="patches-page">
      <div className="pp-head">
        <Link href="/perfil" className="btn-round sm" aria-label="Voltar ao perfil">‹</Link>
        <div>
          <p className="eyebrow">sua jaqueta</p>
          <h1 className="h-display">Patches</h1>
        </div>
        <div className="pp-count">
          <b>{done.length}</b><span>de {patches.length}</span>
        </div>
      </div>
      <div className="thread-bar big" aria-label={`${pct}% da coleção`}><span style={{ width: `${pct}%` }} /></div>

      <section className="denim" aria-label="Patches conquistados">
        <span className="denim-seam top" aria-hidden="true" />
        <span className="denim-seam bottom" aria-hidden="true" />
        {done.length ? (
          <div className="denim-grid">
            {done.map((p, i) => (
              <button key={p.id} type="button" className="denim-item" style={{ animationDelay: `${i * 60}ms` }} onClick={() => setOpen(p)}>
                <PatchBadge p={p} size={104} tilt />
                <span className="denim-name">{p.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="denim-empty">Sua jaqueta ainda está lisinha. Marque episódios e os patches vão sendo costurados aqui.</p>
        )}
      </section>

      {todo.length > 0 && (
        <>
          <div className="pp-sub-row">
            <h2 className="pp-sub">No molde</h2>
            <span className="muted">os que faltam costurar</span>
          </div>
          <section className="mold-grid" aria-label="A conquistar">
            {todo.map((p) => (
              <button key={p.id} type="button" className="mold-item" onClick={() => setOpen(p)}>
                <PatchArt p={p} size={84} locked />
                <b>{p.secret ? "Patch secreto" : p.name}</b>
                {!p.secret && p.goal > 1 ? (
                  <span className="mold-prog">
                    <span className="thread-bar"><span style={{ width: `${Math.round((p.have / p.goal) * 100)}%` }} /></span>
                    <em>{fmt(p.have)}/{fmt(p.goal)}</em>
                  </span>
                ) : (
                  <span className="mold-desc">{p.secret ? "descubra assistindo" : p.desc}</span>
                )}
              </button>
            ))}
          </section>
        </>
      )}

      {open && <Sheet p={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
