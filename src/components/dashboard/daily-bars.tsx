import type { CSSProperties } from "react";

export type Bar = { day: string; value: number | null };

const W = 340;
const H = 150;
const PAD = { top: 16, bottom: 22, left: 4, right: 4 };

const weekday = (day: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).toUpperCase();

/**
 * Barras por dia com a linha da meta. Barras dentro da faixa da meta (±10%)
 * ficam na cor cheia; fora dela, mais claras. Dias sem dado ficam vazios.
 */
export function DailyBars({
  bars,
  target,
  color,
  label,
  tolerance = 0.1,
  mode = "band",
  targetLabel,
}: {
  bars: Bar[];
  target: number | null;
  color: string;
  label: string;
  tolerance?: number;
  /** "band": bom é ficar perto da meta (calorias). "min": bom é passar da meta (passos). */
  mode?: "band" | "min";
  /** Texto da linha da meta; o padrão é "meta" e o número. */
  targetLabel?: string;
}) {
  const max = Math.max(1, target ? target * 1.25 : 0, ...bars.map((b) => b.value ?? 0));
  const slot = (W - PAD.left - PAD.right) / bars.length;
  const bw = Math.min(16, slot * 0.62);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const good = (v: number) =>
    target === null ? true : mode === "min" ? v >= target : Math.abs(v - target) <= target * tolerance;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {bars.map((b, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        return (
          <g key={b.day}>
            {b.value !== null && b.value > 0 ? (
              <rect
                className="bar-y"
                x={cx - bw / 2}
                y={y(b.value)}
                width={bw}
                height={H - PAD.bottom - y(b.value)}
                rx={Math.min(6, bw / 2)}
                fill={color}
                fillOpacity={good(b.value) ? 1 : 0.38}
                style={{ "--i": i } as CSSProperties}
              >
                <title>{`${b.day}: ${Math.round(b.value).toLocaleString("pt-BR")}`}</title>
              </rect>
            ) : (
              <circle cx={cx} cy={H - PAD.bottom - 3} r={2} fill="var(--muted)" fillOpacity={0.4} />
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {weekday(b.day)}
            </text>
          </g>
        );
      })}
      {target !== null && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--foreground)" strokeOpacity={0.55} strokeDasharray="4 4" />
          <text x={W - PAD.right} y={y(target) - 5} textAnchor="end" fontSize={10} fontWeight={600} fill="var(--muted)">
            {targetLabel ?? `meta ${target.toLocaleString("pt-BR")}`}
          </text>
        </g>
      )}
    </svg>
  );
}
