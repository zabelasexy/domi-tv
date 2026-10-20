"use client";
import Link from "next/link";
import { useDomi, PatchBadge } from "@/components/Shell";

export default function Patches() {
  const { patches } = useDomi();
  if (!patches) return <div className="loading">desenrolando a linha…</div>;
  const done = patches.filter((p) => p.done);
  const todo = patches.filter((p) => !p.done).sort((a, b) => b.have / b.goal - a.have / a.goal);

  return (
    <div className="patches-page">
      <div className="pp-head">
        <Link href="/perfil" className="btn-round sm" aria-label="Voltar ao perfil">‹</Link>
        <h1 className="h-display">Patches</h1>
        <span className="mono-stamp">{done.length}/{patches.length}</span>
      </div>
      <p className="muted pp-lead">Cada conquista vira um patch bordado no seu perfil. Os que faltam mostram quanto ainda falta.</p>

      {done.length > 0 && (
        <section className="pp-grid" aria-label="Conquistados">
          {done.map((p) => (
            <div key={p.id} className="pp-item">
              <PatchBadge p={p} size={84} />
              <b>{p.name}</b>
              <span>{p.desc}</span>
            </div>
          ))}
        </section>
      )}

      {todo.length > 0 && (
        <>
          <h2 className="pp-sub">Ainda faltam</h2>
          <section className="pp-grid" aria-label="A conquistar">
            {todo.map((p) => (
              <div key={p.id} className="pp-item locked">
                <PatchBadge p={p} size={84} locked />
                <b>{p.secret ? "Patch secreto" : p.name}</b>
                <span>{p.secret ? "Esse você descobre assistindo" : p.desc}</span>
                {!p.secret && p.goal > 1 && (
                  <span className="pp-prog"><i style={{ width: `${Math.round((p.have / p.goal) * 100)}%` }} /><em>{p.have.toLocaleString("pt-BR")}/{p.goal.toLocaleString("pt-BR")}</em></span>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
