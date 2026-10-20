"use client";
import Link from "next/link";
import { img } from "@/lib/tmdb";
import { STATUS_LABEL } from "@/lib/constants";

/** Nota em ponto-cruz: cinco ✕ bordados. */
export function Stitches({ value = 0, onChange, size = "sm" }) {
  if (!onChange) {
    if (!value) return null;
    return (
      <span className={`stitches ${size}`} aria-label={`nota ${value} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= value ? "on" : ""}>✕</i>)}
      </span>
    );
  }
  return (
    <div className={`stitches edit ${size}`} role="radiogroup" aria-label="Nota de 1 a 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`}
          className={n <= value ? "on" : ""} onClick={() => onChange(value === n ? 0 : n)}>✕</button>
      ))}
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
        {sub ? <p>{sub}</p> : <Stitches value={rating} />}
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
