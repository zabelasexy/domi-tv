/** Logo Domi TV: "domi" com o "o" de play e o "tv" no carimbo laranja. */
export default function Wordmark({ className = "", animated = false, size, badge = true }) {
  return (
    <span className={`wm ${animated ? "wm-anim" : ""} ${className}`} style={size ? { fontSize: size } : undefined} aria-label="Domi TV" role="img">
      <span className="wm-ch" aria-hidden="true">d</span>
      <span className="wm-o" aria-hidden="true" />
      <span className="wm-ch" aria-hidden="true">m</span>
      <span className="wm-ch" aria-hidden="true">i</span>
      {badge && <small className="wm-tv" aria-hidden="true">tv</small>}
    </span>
  );
}
