"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useDomi, PatchBadge, Avatar } from "@/components/Shell";
import { sb } from "@/lib/supabase";
import { squareJpeg } from "@/lib/photo";
import { img } from "@/lib/tmdb";
import { shareCard } from "@/lib/sharecard";

const COLORS = ["#3F7BFF", "#9CC2FF", "#E86A8E", "#FF9A3C", "#7FD3A8", "#C7B8FF"];
const fmt = (n) => n.toLocaleString("pt-BR");

export default function Perfil() {
  const { shows, eps, profile, saveProfile, patches, say, session } = useDomi();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [sharing, setSharing] = useState(false);

  const byId = useMemo(() => new Map((shows || []).map((s) => [s.tmdb_id, s])), [shows]);

  const top4 = useMemo(() => {
    const chosen = (profile.top4 || []).map((id) => byId.get(id)).filter(Boolean);
    if (chosen.length) return chosen.slice(0, 4);
    return [...(shows || [])].filter((s) => s.favorite || s.rating >= 5).sort((a, b) => b.rating - a.rating).slice(0, 4);
  }, [profile.top4, byId, shows]);

  const stats = useMemo(() => {
    const minutes = (eps || []).reduce((a, e) => a + (e.runtime || 0), 0);
    const rated = (shows || []).filter((s) => s.rating > 0);
    return {
      series: (shows || []).length,
      eps: (eps || []).length,
      hours: Math.round(minutes / 60),
      avg: rated.length ? (rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(1).replace(".", ",") : "–",
    };
  }, [shows, eps]);

  const genres = useMemo(() => {
    const m = new Map();
    (shows || []).filter((s) => s.status !== "quero").forEach((s) => (s.genres || []).forEach((g) => m.set(g, (m.get(g) || 0) + 1)));
    const list = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = list[0]?.[1] || 1;
    return list.map(([n, c]) => ({ n, c, w: Math.round((c / max) * 100) }));
  }, [shows]);

  const lists = useMemo(() => {
    const m = new Map();
    (shows || []).forEach((s) => (s.tags || []).forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [shows]);

  const diary = useMemo(() => {
    const days = new Map();
    for (const e of (eps || []).slice(0, 400)) {
      if (!e.watched_at) continue;
      const k = e.watched_at.slice(0, 10);
      const d = days.get(k) || new Map();
      const arr = d.get(e.tmdb_show_id) || [];
      arr.push(e);
      d.set(e.tmdb_show_id, arr);
      days.set(k, d);
    }
    return [...days.entries()].slice(0, 7).map(([k, d]) => ({
      date: k.split("-").reverse().slice(0, 2).join("/"),
      items: [...d.entries()].map(([id, arr]) => {
        const s = byId.get(id);
        arr.sort((a, b) => a.season - b.season || a.episode - b.episode);
        const first = arr[0], last = arr[arr.length - 1];
        const ep = arr.length === 1 ? `T${first.season} · E${first.episode}` : `${arr.length} episódios`;
        return { id, title: s?.title || "Série", ep: first === last ? ep : ep };
      }),
    }));
  }, [eps, byId]);

  if (!shows || !eps) return <div className="loading">abrindo o perfil…</div>;

  const cover = (profile.cover_tmdb && byId.get(profile.cover_tmdb)?.backdrop_path) || top4.find((s) => s.backdrop_path)?.backdrop_path;
  const done = (patches || []).filter((p) => p.done);
  const name = profile.name || "Domi";
  const color = profile.color || COLORS[0];

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await squareJpeg(file, 480);
      const path = `${session.user.id}/avatar-${Date.now()}.jpg`;
      const up = await sb().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true });
      if (up.error) throw up.error;
      const { data } = sb().storage.from("avatars").getPublicUrl(path);
      const old = profile.avatar_path;
      if (!(await saveProfile({ avatar_url: data.publicUrl, avatar_path: path }))) throw new Error("perfil");
      if (old) sb().storage.from("avatars").remove([old]);
      say("Foto atualizada");
    } catch (e) {
      const msg = String(e?.message || e);
      say(/bucket|not found|policy|row-level|security/i.test(msg) ? "As fotos ainda não estão ligadas no banco: rode a atualização 2 no Supabase." : /formato/.test(msg) ? msg : "Não consegui enviar a foto.");
    }
    setUploading(false);
  };

  const removePhoto = async () => {
    const old = profile.avatar_path;
    if (await saveProfile({ avatar_url: null, avatar_path: null })) {
      if (old) sb().storage.from("avatars").remove([old]);
      say("Foto removida");
    }
  };

  const startEdit = () => {
    setForm({ name: profile.name || "", bio: profile.bio || "", color, top4: top4.map((s) => s.tmdb_id) });
    setEditing(true);
  };
  const save = async () => {
    const ok = await saveProfile({ name: form.name.trim(), bio: form.bio.trim(), color: form.color, top4: form.top4.slice(0, 4), cover_tmdb: form.top4[0] || null });
    if (ok) { setEditing(false); say("Perfil salvo"); } else say("Não consegui salvar o perfil.");
  };
  const toggleTop = (id) => setForm((f) => ({ ...f, top4: f.top4.includes(id) ? f.top4.filter((x) => x !== id) : f.top4.length < 4 ? [...f.top4, id] : f.top4 }));

  const share = async () => {
    setSharing(true);
    try {
      const r = await shareCard({ name, stats, top4, genres, patchCount: done.length });
      if (r === "downloaded") say("Imagem salva");
    } catch {
      say("Não consegui gerar a imagem.");
    }
    setSharing(false);
  };

  const pickable = [...shows].filter((s) => s.favorite || s.rating >= 4).sort((a, b) => b.rating - a.rating).slice(0, 40);

  return (
    <div className="profile">
      <div className="pf-cover">
        {cover && <img src={img(cover, "w1280")} alt="" />}
        <div className="pf-cover-fade" />
      </div>

      <div className="pf-head">
        <label className={`avatar-up ${uploading ? "busy" : ""}`} title="Trocar foto">
          <Avatar profile={{ ...profile, name, color }} className="xl" />
          <span className="avatar-cam" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z M12 10a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7z" /></svg></span>
          <input type="file" accept="image/*" className="sr" aria-label="Trocar foto de perfil" disabled={uploading} onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div className="pf-id">
          <h1>{name}</h1>
          {profile.bio ? <p>{profile.bio}</p> : <p className="muted">conta um pouquinho de você</p>}
        </div>
        <div className="pf-actions">
          <button type="button" className="btn btn-ghost" onClick={startEdit}>Editar</button>
          <button type="button" className="btn btn-primary" onClick={share} disabled={sharing}>{sharing ? "Gerando…" : "Compartilhar"}</button>
        </div>
      </div>

      {editing && form && (
        <div className="pf-edit">
          <div className="field">Foto
            <div className="photo-row">
              <Avatar profile={{ ...profile, name: form.name || name, color: form.color }} className="lgav" />
              <label className="btn btn-ghost">
                {uploading ? "Enviando…" : profile.avatar_url ? "Trocar foto" : "Escolher foto"}
                <input type="file" accept="image/*" className="sr" disabled={uploading} onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {profile.avatar_url && <button type="button" className="btn btn-ghost" onClick={removePhoto}>Remover</button>}
            </div>
          </div>
          <label className="field">Nome<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dominique" /></label>
          <label className="field">Bio<input className="input" value={form.bio} maxLength={80} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="pinta, costura e maratona" /></label>
          <div className="field">Cor
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={form.color === c} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </div>
          </div>
          <div className="field">Top 4 · {form.top4.length}/4
            <div className="pick-grid">
              {pickable.map((s) => (
                <button key={s.tmdb_id} type="button" aria-pressed={form.top4.includes(s.tmdb_id)} onClick={() => toggleTop(s.tmdb_id)} title={s.title}>
                  {s.poster_path ? <img src={img(s.poster_path, "w154")} alt={s.title} /> : <span>{s.title}</span>}
                  {form.top4.includes(s.tmdb_id) && <i>{form.top4.indexOf(s.tmdb_id) + 1}</i>}
                </button>
              ))}
              {!pickable.length && <p className="muted">Marque séries como favoritas (♥) ou dê nota 4+ para escolher aqui.</p>}
            </div>
          </div>
          <div className="row-btns">
            <button type="button" className="btn btn-primary" onClick={save}>Salvar</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <section className="pf-stats" aria-label="Números">
        <div><b>{fmt(stats.series)}</b><span>séries</span></div>
        <div><b>{fmt(stats.eps)}</b><span>episódios</span></div>
        <div><b>{fmt(stats.hours)}</b><span>horas</span></div>
        <div><b className="accent">{stats.avg}</b><span>nota média</span></div>
      </section>

      {top4.length > 0 && (
        <section className="pf-sec">
          <div className="pf-sec-head"><h2>Top 4</h2><span className="muted">as do coração</span></div>
          <div className="top4">
            {top4.map((s, i) => (
              <Link key={s.tmdb_id} href={`/serie/${s.tmdb_id}`} className="top4-item">
                {s.poster_path ? <img src={img(s.poster_path, "w342")} alt={s.title} /> : <div className="noposter"><span>{s.title}</span></div>}
                <i>{i + 1}</i>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="pf-sec">
        <div className="pf-sec-head"><h2>Patches</h2><Link href="/patches" className="see-all">{done.length} de {(patches || []).length} →</Link></div>
        <div className="pf-patches">
          {done.length ? done.slice(-6).reverse().map((p) => <PatchBadge key={p.id} p={p} size={70} tilt />) : <p className="muted">Os patches aparecem aqui conforme você assiste.</p>}
        </div>
      </section>

      <div className="pf-two">
        {genres.length > 0 && (
          <section className="pf-sec">
            <h2>Gêneros</h2>
            <div className="bars">
              {genres.map((g) => (
                <div key={g.n} className="bar"><span className="bar-n">{g.n}</span><span className="bar-t"><i style={{ width: `${g.w}%` }} /></span><span className="bar-c">{g.c}</span></div>
              ))}
            </div>
          </section>
        )}
        {lists.length > 0 && (
          <section className="pf-sec">
            <h2>Listas</h2>
            <div className="lists">
              {lists.map(([t, c]) => <Link key={t} href={`/colecao?tag=${encodeURIComponent(t)}`} className="list-chip">{t}<small>{c}</small></Link>)}
            </div>
          </section>
        )}
      </div>

      {diary.length > 0 && (
        <section className="pf-sec">
          <h2>Diário</h2>
          <ol className="diary">
            {diary.map((d) => (
              <li key={d.date}>
                <span className="diary-date">{d.date}</span>
                <span className="diary-dot" />
                <span className="diary-items">{d.items.map((it) => <Link key={it.id} href={`/serie/${it.id}`}>{it.title} <small>{it.ep}</small></Link>)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="row-btns center">
        <Link className="btn btn-ghost" href="/retro">Retrospectiva</Link>
        <Link className="btn btn-ghost" href="/colecao">Coleção completa</Link>
      </div>
    </div>
  );
}
