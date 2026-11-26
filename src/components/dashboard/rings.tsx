import type { CSSProperties } from "react";
import { CountUp } from "./count-up";

export type RingData = {
  key: string;
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
};

const SIZE = 220;
const STROKE = 17;
const GAP = 5;

/**
 * Três anéis concêntricos (calorias, proteína, passos), no estilo dos anéis de
 * atividade. Passar da meta de calorias deixa o anel inteiro e muda o texto.
 */
export function Rings({ rings, center }: { rings: RingData[]; center: { label: string; value: number; unit: string; over?: boolean } }) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
          {rings.map((r, i) => {
            const radius = SIZE / 2 - STROKE / 2 - i * (STROKE + GAP);
            const c = 2 * Math.PI * radius;
            const pct = r.target > 0 ? Math.min(1, r.value / r.target) : 0;
            return (
              <g key={r.key}>
                <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={STROKE} />
                <circle
                  className="ring-arc"
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={radius}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  // Um traço mínimo mostra o começo do anel mesmo em zero.
                  strokeDashoffset={c * (1 - Math.max(pct, 0.004))}
                  style={{ "--ring-c": c, "--i": i } as CSSProperties}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{center.label}</span>
          <span className={`text-[2.1rem] font-bold leading-none tracking-tight ${center.over ? "text-kcal" : ""}`}>
            <CountUp value={center.value} />
          </span>
          <span className="text-sm text-muted">{center.unit}</span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-3 gap-2 sm:grid-cols-1">
        {rings.map((r, i) => (
          <li key={r.key} className="rise rounded-2xl bg-surface-2 px-3 py-2" style={{ "--i": i + 2 } as CSSProperties}>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} aria-hidden />
              {r.label}
            </span>
            <span className="block text-lg font-bold leading-tight">
              <CountUp value={Math.round(r.value)} />
            </span>
            <span className="tabular block text-xs text-muted">
              de {r.target.toLocaleString("pt-BR")} {r.unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
