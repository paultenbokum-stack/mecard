import { rands } from "@/lib/money";

// A plain SVG bar chart, drawn on the server (no chart library, nothing to load).

const W = 720;
const H = 160;
const PAD = { top: 10, right: 8, bottom: 22, left: 8 };

const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m` : n >= 10_000 ? `${Math.round(n / 1000)}k` : String(n));

export function BarChart({ points, money = false, label }: { points: { key: string; value: number }[]; money?: boolean; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, points.length);
  const bar = Math.max(1, slot * 0.72);
  const total = points.reduce((t, p) => t + p.value, 0);
  const fmt = (v: number) => (money ? rands(v) : v.toLocaleString("en-ZA"));
  // A date label every so often, so they don't overlap.
  const every = Math.max(1, Math.ceil(points.length / 8));
  return (
    <figure className="adm-chart">
      <figcaption>
        <span>{label}</span>
        <strong>{fmt(total)}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${fmt(total)} in total, highest ${fmt(max)}`} preserveAspectRatio="none">
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className="adm-chart__axis" />
        {points.map((p, i) => {
          const h = (p.value / max) * innerH;
          const x = PAD.left + i * slot + (slot - bar) / 2;
          return (
            <g key={p.key}>
              <rect x={x} y={PAD.top + innerH - h} width={bar} height={Math.max(h, p.value ? 1 : 0)} className="adm-chart__bar">
                <title>{`${p.key}: ${fmt(p.value)}`}</title>
              </rect>
              {i % every === 0 ? (
                <text x={x + bar / 2} y={H - 6} textAnchor="middle" className="adm-chart__label">
                  {p.key.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={W - PAD.right} y={PAD.top + 8} textAnchor="end" className="adm-chart__label">
          {money ? `max ${rands(max)}` : `max ${short(max)}`}
        </text>
      </svg>
    </figure>
  );
}
