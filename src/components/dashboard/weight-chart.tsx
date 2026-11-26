"use client";

import { useRef, useState } from "react";

export type WeightChartPoint = { day: string; kg: number; avg: number };

const W = 340;
const H = 170;
const PAD = { top: 14, right: 12, bottom: 24, left: 34 };

const shortDay = (day: string) => {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
};
const kg = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Pesagens do dia (pontos claros), média de 7 dias (linha forte) e meta
 * (tracejada). Arrastar o dedo mostra o valor de cada dia.
 */
export function WeightChart({ points, target }: { points: WeightChartPoint[]; target: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length === 0) return null;

  const values = points.flatMap((p) => [p.kg, p.avg]);
  // A meta só entra na escala se estiver perto; senão o gráfico achata.
  const span0 = Math.max(...values) - Math.min(...values);
  const showTarget = target !== null && Math.abs(target - points[points.length - 1].avg) <= Math.max(4, span0 * 2);
  if (showTarget) values.push(target!);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) {
    const mid = (max + min) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  min -= 0.3;
  max += 0.3;

  const first = Date.parse(points[0].day);
  const last = Date.parse(points[points.length - 1].day);
  const spanDays = Math.max(1, (last - first) / 86_400_000);
  const x = (day: string) =>
    points.length === 1 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((Date.parse(day) - first) / 86_400_000 / spanDays) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * (H - PAD.top - PAD.bottom);

  const avgPath = points.map((p, i) => `${i ? "L" : "M"} ${x(p.day).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(" ");
  const areaPath = `${avgPath} L ${x(points[points.length - 1].day).toFixed(1)} ${H - PAD.bottom} L ${x(points[0].day).toFixed(1)} ${H - PAD.bottom} Z`;
  const step = max - min > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].day) - px) < Math.abs(x(points[best].day) - px)) best = i;
    }
    setHover(best);
  };

  const h = hover !== null ? points[hover] : null;

  return (
    <div>
      <div className="mb-2 flex h-11 items-end justify-between">
        {h ? (
          <p className="pop">
            <span className="text-sm text-muted">{shortDay(h.day)} · </span>
            <span className="text-xl font-bold">{kg(h.kg)} kg</span>
            <span className="text-sm text-muted"> · média {kg(h.avg)}</span>
          </p>
        ) : (
          <p className="text-muted">Toque ou arraste o dedo no gráfico para ver cada dia.</p>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`Peso nos últimos dias: de ${kg(points[0].kg)} a ${kg(points[points.length - 1].kg)} kg`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHover(null);
        }}
      >
        <defs>
          <linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart)" stopOpacity={0.22} />
            <stop offset="1" stopColor="var(--chart)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--muted)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {showTarget && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(target!)} y2={y(target!)} stroke="var(--foreground)" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={W - PAD.right} y={y(target!) - 6} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--foreground)">
              meta {kg(target!)}
            </text>
          </g>
        )}
        {points.length > 1 && <path d={areaPath} fill="url(#wfill)" className="rise" />}
        {points.map((p, i) => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.kg)} r={hover === i ? 5 : 3} fill="var(--chart-muted)" className="transition-all" />
        ))}
        {points.length > 1 && (
          <path className="draw" pathLength={1} d={avgPath} fill="none" stroke="var(--chart)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {h && (
          <g>
            <line x1={x(h.day)} x2={x(h.day)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeOpacity={0.5} strokeDasharray="3 3" />
            <circle cx={x(h.day)} cy={y(h.avg)} r={5.5} fill="var(--surface)" stroke="var(--chart)" strokeWidth={3} />
          </g>
        )}
        <text x={PAD.left} y={H - 6} fontSize={12} fill="var(--muted)">{shortDay(points[0].day)}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={12} fill="var(--muted)">{shortDay(points[points.length - 1].day)}</text>
      </svg>
    </div>
  );
}
