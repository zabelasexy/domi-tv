"use client";
import { useState } from "react";
import Link from "next/link";
import { img } from "@/lib/tmdb";
import { STATUS_LABEL } from "@/lib/constants";

const STAR = "M12 2.8l2.83 5.73l6.32.92l-4.57 4.46l1.08 6.3L12 17.24l-5.66 2.97l1.08-6.3L2.85 9.45l6.32-.92z";
const fmtRating = (v) => String(v).replace(".", ",");

function Star({ fill }) {
  return (
    <span className="star" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="star-bg"><path d={STAR} /></svg>
      <span className="star-fill" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24"><path d={STAR} /></svg>
      </span>
    </span>
  );
}

/** Nota em estrelas, com meia estrela. Sem onChange, só mostra. */
export function Stars({ value = 0, onChange, size = "sm", showNumber = false }) {
  const [hover, setHover] = useState(null);
  const v = Number(value) || 0;
  if (!onChange) {
    if (!v) return null;
    return (
      <span className={`stars ${size}`} role="img" aria-label={`nota ${fmtRating(v)} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} fill={Math.max(0, Math.min(1, v - (n - 1)))} />)}
        {showNumber && <b className="stars-n">{fmtRating(v)}</b>}
      </span>
    );
  }
  const shown = hover ?? v;
  return (
    <div className={`stars edit ${size}`} role="radiogroup" aria-label="Nota de meia a 5 estrelas" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="star-slot">
          <Star fill={Math.max(0, Math.min(1, shown - (n - 1)))} />
          {[n - 0.5, n].map((val, i) => (
            <button
              key={val}
              type="button"
              role="radio"
              aria-checked={v === val}
              aria-label={`${fmtRating(val)} ${val === 1 ? "estrela" : "estrelas"}`}
              className={`star-hit ${i ? "right" : "left"}`}
              onMouseEnter={() => setHover(val)}
              onFocus={() => setHover(val)}
              onBlur={() => setHover(null)}
              onClick={() => { setHover(null); onChange(v === val ? 0 : val); }}
            />
          ))}
        </span>
      ))}
      <b className="stars-n">{shown ? fmtRating(shown) : "–"}</b>
    </div>
  );
}

export function StatusPill({ status }) {
  if (!status) return null;
  return <span className={`pill st-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function PosterCard({ id, title, poster, year, status, rating, sub, href }) {
  return (
    <Link href={href || `/serie/${id}`} className="pcard">
      <div className="pcard-img">
        {poster ? <img src={img(poster)} alt="" loading="lazy" /> : <div className="noposter"><span>{title}</span></div>}
        {year && <i className="stamp">&apos;{String(year).slice(2)}</i>}
        {status && <span className={`dot st-${status}`} title={STATUS_LABEL[status]} />}
      </div>
      <div className="pcard-txt">
        <h3>{title}</h3>
        {sub ? <p>{sub}</p> : <Stars value={rating} />}
      </div>
    </Link>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="hand">{title}</p>
      {children}
    </div>
  );
}
