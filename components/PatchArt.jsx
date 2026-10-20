"use client";
import { useId } from "react";
import { ICONS, FILLED, STYLE } from "@/lib/patches";

const C = 60;
const poly = (pts) => "M" + pts.map((p) => p.map((n) => n.toFixed(2)).join(" ")).join(" L") + " Z";
const around = (n, r, start = -90, rIn = null) => {
  const pts = [];
  const total = rIn ? n * 2 : n;
  for (let i = 0; i < total; i++) {
    const a = ((start + (360 / total) * i) * Math.PI) / 180;
    const rr = rIn && i % 2 ? rIn : r;
    pts.push([C + rr * Math.cos(a), C + rr * Math.sin(a)]);
  }
  return pts;
};
function scallop(n = 16, r = 47) {
  const pts = around(n, r, -90);
  const br = r * Math.sin(Math.PI / n) * 1.08;
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i <= n; i++) {
    const [x, y] = pts[i % n];
    d += ` A${br.toFixed(2)} ${br.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d + " Z";
}

const SHAPES = {
  circle: "M60 8A52 52 0 1 1 59.99 8Z",
  scallop: scallop(),
  shield: "M60 7 L104 21 V57 C104 86 84 104 60 113 C36 104 16 86 16 57 V21 Z",
  hexagon: poly(around(6, 54, -90)),
  star: poly(around(5, 58, -90, 31)),
  heart: "M60 106 C26 84 9 66 9 43 C9 25 23 12 40 12 C50 12 56 17 60 24 C64 17 70 12 80 12 C97 12 111 25 111 43 C111 66 94 84 60 106 Z",
  rounded: "M32 10 H88 A22 22 0 0 1 110 32 V88 A22 22 0 0 1 88 110 H32 A22 22 0 0 1 10 88 V32 A22 22 0 0 1 32 10 Z",
};
const ICON_Y = { shield: -4, heart: -6, star: 2, scallop: 0 };
const ICON_K = { star: 1.55, heart: 1.9 };

/** Patch bordado em SVG: borda de overloque, sarja do tecido, pesponto, ícone em ponto cetim e faixinha. */
export default function PatchArt({ p, size = 80, locked = false, className = "" }) {
  const raw = useId().replace(/:/g, "");
  const st = STYLE[p.id] || { shape: "circle", edge: "#F3EEE4" };
  const shape = SHAPES[st.shape] || SHAPES.circle;
  const ribbon = st.ribbon && !locked ? st.ribbon : st.ribbon && locked && !p.secret ? st.ribbon : null;
  const k = (ICON_K[st.shape] || 2.05) * (ribbon ? 0.88 : 1);
  const cy = C + (ICON_Y[st.shape] || 0) - (ribbon ? 9 : 0);
  const icon = ICONS[p.icon];
  const filled = FILLED.has(p.icon);
  const id = (s) => `${s}${raw}`;
  const inner = `translate(${C} ${C}) scale(.8) translate(${-C} ${-C})`;
  const label = locked ? (p.secret ? "Patch secreto" : `${p.name}, ainda não conquistado`) : p.name;

  if (locked) {
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} className={`patch-art locked ${className}`} role="img" aria-label={label}>
        <path d={shape} fill="rgba(255,255,255,.035)" stroke="rgba(156,194,255,.45)" strokeWidth="2.2" strokeDasharray="5 4" strokeLinejoin="round" />
        <path d={shape} transform={inner} fill="none" stroke="rgba(156,194,255,.18)" strokeWidth="1.4" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        {p.secret ? (
          <text x="60" y="74" textAnchor="middle" fontFamily="Poppins, sans-serif" fontWeight="800" fontSize="40" fill="rgba(156,194,255,.4)">?</text>
        ) : (
          <g transform={`translate(${C - 12 * k} ${cy - 12 * k}) scale(${k})`}>
            <path d={icon} fill="none" stroke="rgba(156,194,255,.45)" strokeWidth="1.3" strokeDasharray="2 1.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {ribbon && (
          <g>
            <path d="M8 84 H112 L105 94 L112 104 H8 L15 94 Z" fill="rgba(255,255,255,.03)" stroke="rgba(156,194,255,.35)" strokeWidth="1.4" strokeDasharray="3 3" />
            <text x="60" y="98" textAnchor="middle" fontFamily="Poppins, sans-serif" fontWeight="800" fontSize="11" letterSpacing=".5" fill="rgba(156,194,255,.5)">{ribbon}</text>
          </g>
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="-6 -6 132 132" width={size} height={size} className={`patch-art ${className}`} role="img" aria-label={label}>
      <defs>
        <pattern id={id("tw")} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3.2" height="3.2" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="3.2" stroke="rgba(255,255,255,.09)" strokeWidth="1.2" />
        </pattern>
        <pattern id={id("tw2")} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(0,0,0,.07)" strokeWidth="1.4" />
        </pattern>
        <pattern id={id("sat")} width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
          <line x1="0" y1="0" x2="0" y2="1.1" stroke="rgba(0,0,0,.16)" strokeWidth=".35" />
        </pattern>
        <radialGradient id={id("hl")} cx="32%" cy="24%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".32" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </radialGradient>
        <filter id={id("sh")} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.6" floodColor="#000" floodOpacity=".5" />
        </filter>
        <filter id={id("ish")} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation=".5" floodColor="#000" floodOpacity=".35" />
        </filter>
        <clipPath id={id("clip")}><path d={shape} /></clipPath>
      </defs>

      <g filter={`url(#${id("sh")})`}>
        <path d={shape} fill={p.color} stroke={st.edge} strokeWidth="9" strokeLinejoin="round" />
      </g>
      <g clipPath={`url(#${id("clip")})`}>
        <rect x="0" y="0" width="120" height="120" fill={`url(#${id("tw")})`} />
        <rect x="0" y="0" width="120" height="120" fill={`url(#${id("tw2")})`} />
        <rect x="0" y="0" width="120" height="120" fill={`url(#${id("hl")})`} />
      </g>
      {/* overloque: fios enrolados na borda */}
      <path d={shape} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="9" strokeDasharray=".7 1.5" strokeLinejoin="round" />
      <path d={shape} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="5" strokeDasharray=".6 1.6" strokeDashoffset=".8" strokeLinejoin="round" />
      {/* pesponto */}
      <path d={shape} transform={inner} fill="none" stroke={st.edge} strokeOpacity=".85" strokeWidth="1.5" strokeDasharray="3.4 2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

      <g transform={`translate(${C - 12 * k} ${cy - 12 * k}) scale(${k})`} filter={`url(#${id("ish")})`}>
        {filled ? (
          <>
            <path d={icon} fill={st.edge} stroke={st.edge} strokeWidth=".9" strokeLinejoin="round" />
            <path d={icon} fill={`url(#${id("sat")})`} />
          </>
        ) : (
          <>
            <path d={icon} fill="none" stroke={st.edge} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d={icon} fill="none" stroke={`url(#${id("sat")})`} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </g>

      {ribbon && (
        <g filter={`url(#${id("ish")})`}>
          <path d="M2 83 H118 L110 94 L118 105 H2 L10 94 Z" fill={st.edge} />
          <path d="M2 83 H118 L110 94 L118 105 H2 L10 94 Z" fill={`url(#${id("tw2")})`} />
          <path d="M9 87 H111 M9 101 H111" stroke={p.color} strokeOpacity=".55" strokeWidth=".9" strokeDasharray="2.4 1.8" />
          <text x="60" y="98.5" textAnchor="middle" fontFamily="Poppins, system-ui, sans-serif" fontWeight="800" fontSize={ribbon.length > 5 ? 11 : 13} letterSpacing=".6" fill={p.color}>{ribbon}</text>
        </g>
      )}
    </svg>
  );
}
