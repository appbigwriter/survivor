import type { CSSProperties } from "react";
import type { DayScore } from "@/lib/dashboard";

const LEVEL_STYLE: Record<DayScore["level"], CSSProperties> = {
  0: { background: "var(--surface-2)" },
  1: { background: "color-mix(in srgb, var(--primary) 30%, var(--surface-2))" },
  2: { background: "color-mix(in srgb, var(--primary) 62%, var(--surface-2))" },
  3: { background: "var(--primary)" },
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Quatro semanas em quadrados: quanto mais escuro, mais metas cumpridas no dia.
 * Os dias vêm em ordem cronológica, terminando hoje.
 */
export function Consistency({ days, today, streak }: { days: DayScore[]; today: string; streak: number }) {
  // Alinha a grade pela semana (domingo primeiro).
  const firstDow = new Date(`${days[0].day}T12:00:00Z`).getUTCDay();
  const cells: (DayScore | null)[] = [...Array(firstDow).fill(null), ...days];
  const logged = days.filter((d) => d.level > 0).length;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <p>
          <span className="text-3xl font-bold">{streak}</span>{" "}
          <span className="text-muted">{streak === 1 ? "dia seguido" : "dias seguidos"}</span>
        </p>
        <p className="text-sm text-muted">
          {logged} de {days.length} dias com registro
        </p>
      </div>
      <div
        className="grid grid-cols-7 gap-1.5"
        role="img"
        aria-label={`Calendário das últimas 4 semanas: ${logged} dias com registro, ${days.filter((d) => d.level === 3).length} com calorias e proteína na meta.`}
      >
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-center text-sm font-semibold text-muted">
            {w}
          </span>
        ))}
        {cells.map((c, i) =>
          c ? (
            <span
              key={c.day}
              title={c.day}
              className={`pop aspect-square rounded-lg ${c.day === today ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""}`}
              style={{ ...LEVEL_STYLE[c.level], "--i": i } as CSSProperties}
            />
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={LEVEL_STYLE[1]} />registrou</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={LEVEL_STYLE[2]} />uma meta</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={LEVEL_STYLE[3]} />calorias e proteína</span>
      </div>
      <p className="mt-2 text-sm text-muted">Um dia esquecido por semana não quebra a sequência.</p>
    </div>
  );
}
