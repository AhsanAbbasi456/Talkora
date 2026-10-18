import { useEffect, useRef, useState } from "react";
import { formatNumber } from "./adminUtils";

const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 24, left: 36 };
const MAX_BAR = 24;

// 0, 1, 2, 5, 10, 20, 50 ... so the axis shows clean numbers
const niceMax = (value) => {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow * 4 >= value) * pow;
  return step * 4;
};

// Column with a 4px rounded top and a square base
const barPath = (x, y, w, h) => {
  const r = Math.min(4, w / 2, h);
  const base = y + h;
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
};

const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

// One series of daily counts (signups or messages) for the last 30 days
export default function DailyChart({ data, label }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(MAX_BAR, slot - 2)); // 2px gap between touching bars
  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  const active = hover !== null ? data[hover] : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${label} per day, last 30 days`}
          onMouseLeave={() => setHover(null)}
        >
          {/* gridlines + y-axis labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth="1"
                opacity={t === 0 ? 1 : 0.6}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {formatNumber(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const h = (d.count / max) * plotH;
            return (
              <g key={d.date}>
                {h > 0 && (
                  <path
                    d={barPath(x, y(d.count), barW, h)}
                    fill="var(--chart-1)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                {/* the whole column is the hover target, not just the bar */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onTouchStart={() => setHover(i)}
                />
              </g>
            );
          })}

          {/* a date label every 7 days, counted back from today */}
          {data.map((d, i) =>
            (data.length - 1 - i) % 7 === 0 ? (
              <text
                key={`l-${d.date}`}
                x={PAD.left + i * slot + slot / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {dayLabel(d.date)}
              </text>
            ) : null,
          )}
        </svg>
      )}

      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-(--border) bg-(--app-bg) px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(
              Math.max(PAD.left + hover * slot + slot / 2, 60),
              Math.max(60, width - 60),
            ),
          }}
        >
          <p className="text-(--text-muted)">{dayLabel(active.date)}</p>
          <p className="font-semibold tabular-nums text-(--text-primary)">
            {active.count.toLocaleString()} {label.toLowerCase()}
          </p>
        </div>
      )}

      {/* the same numbers as a table for screen readers */}
      <table className="sr-only">
        <caption>{label} per day</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date)}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
