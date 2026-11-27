import type { CSSProperties, ReactNode } from "react";

// Arco de 270°, aberto embaixo, centro (100,100) e raio 80, num quadro 200x175.
const R = 80;
const START = 135; // graus, sentido horário a partir do eixo x
const SWEEP = 270;
export const ARC_PATH = "M 43.43 156.57 A 80 80 0 1 1 156.57 156.57";
// Comprimento real (3/4 de volta): funciona até em iPhones antigos, sem pathLength.
export const ARC_LEN = (SWEEP / 360) * 2 * Math.PI * R;

/** Ponto do arco numa fração de 0 a 1 do caminho. */
export function arcPoint(f: number) {
  const a = ((START + SWEEP * Math.min(1, Math.max(0, f))) * Math.PI) / 180;
  return { x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a) };
}

/**
 * Arco de progresso que se desenha ao abrir a tela. `marks` são pontos ao longo
 * do caminho (fases do jejum, por exemplo); os já alcançados ficam cheios.
 */
export function Arc({
  value,
  tone = "primary",
  label,
  marks = [],
  children,
}: {
  /** De 0 a 1. */
  value: number;
  tone?: "primary" | "accent";
  label: string;
  marks?: { at: number; reached: boolean }[];
  /** O que vai no meio do arco. */
  children: ReactNode;
}) {
  const pct = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return (
    <div className="relative mx-auto -mb-6 max-w-[17rem]">
      <svg viewBox="0 0 200 175" className="w-full" role="img" aria-label={label}>
        <path d={ARC_PATH} fill="none" stroke="var(--surface-2)" strokeWidth={14} strokeLinecap="round" />
        {pct > 0 && (
          <path
            d={ARC_PATH}
            fill="none"
            stroke={tone === "accent" ? "var(--accent)" : "var(--primary)"}
            strokeWidth={14}
            strokeLinecap="round"
            className="arc-fill"
            style={{ strokeDasharray: `${pct * ARC_LEN} ${ARC_LEN}`, "--len": ARC_LEN } as CSSProperties}
          />
        )}
        {marks.map((m, i) => {
          const p = arcPoint(m.at);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              className={m.reached ? "pop" : undefined}
              fill={m.reached ? "var(--primary-foreground)" : "var(--background)"}
              stroke={m.reached ? "none" : "var(--muted)"}
              strokeWidth={1.5}
              style={{ "--i": 40 + i * 12 } as CSSProperties}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-[30%] text-center">{children}</div>
    </div>
  );
}
