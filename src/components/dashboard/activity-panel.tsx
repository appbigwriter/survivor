import type { CSSProperties } from "react";
import { KIND_LABEL, type ItemProgress } from "@/lib/activity";
import { Arc } from "./arc";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const WEEKDAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Atividade do dia: o arco mostra os minutos feitos contra os planejados, cada
 * item do plano aparece com seu andamento, e embaixo vem a constância da semana.
 */
export function ActivityPanel({
  items,
  planned,
  done,
  extra,
  steps,
  stepGoal,
  stats,
}: {
  items: ItemProgress[];
  planned: number;
  done: number;
  extra: number;
  steps: number;
  stepGoal: number;
  stats: { last7: { day: string; pct: number; ok: boolean; rest: boolean }[]; onPlan7: number; planned7: number; avgPct: number; streak: number; weekMinutes: number };
}) {
  const rest = items.length === 0;
  return (
    <div>
      <Arc
        value={planned ? done / planned : 0}
        label={rest ? "Dia de descanso" : `${fmt(done)} de ${fmt(planned)} minutos de atividade`}
        marks={items.length > 1 ? cumulative(items, planned) : []}
      >
        <p className="text-[2.6rem] font-bold leading-none tracking-tight">{rest ? "—" : fmt(done)}</p>
        <p className="mt-1 font-medium text-muted">{rest ? "dia de descanso" : `de ${fmt(planned)} min`}</p>
      </Arc>

      <div className="mb-5 flex justify-between px-1">
        <div>
          <p className="tabular text-xl font-bold">{fmt(steps)}</p>
          <p className="text-sm text-muted">passos de {fmt(stepGoal)}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-xl font-bold">{fmt(stats.weekMinutes)} min</p>
          <p className="text-sm text-muted">registrados na semana</p>
        </div>
      </div>

      {!rest && (
        <ul className="mb-5 space-y-3">
          {items.map((it, i) => (
            <li key={it.kind} className="flex items-center gap-3">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  it.ok ? "pop bg-primary text-primary-foreground" : "border-2 border-border text-muted"
                }`}
                style={{ "--i": 30 + i * 8 } as CSSProperties}
                aria-hidden
              >
                {it.ok ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{KIND_LABEL[it.kind]}</span>
                  <span className="tabular text-sm text-muted">
                    <strong className="font-semibold text-foreground">{fmt(it.done)}</strong> de {fmt(it.minutes)} min
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div
                    className="bar-x h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (it.done / it.minutes) * 100)}%`, "--i": i + 2 } as CSSProperties}
                  />
                </div>
                {it.fromSteps && <p className="mt-1 text-sm text-muted">Calculado pelos seus passos.</p>}
              </div>
            </li>
          ))}
          {extra > 0 && <li className="text-muted">Mais {fmt(extra)} min de outras atividades.</li>}
        </ul>
      )}

      <div className="rounded-2xl bg-surface-2 p-4">
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <Stat value={`${stats.onPlan7}/${stats.planned7}`} label="dias no plano" />
          <Stat value={String(stats.streak)} label={stats.streak === 1 ? "dia seguido" : "dias seguidos"} />
          <Stat value={`${Math.round(stats.avgPct * 100)}%`} label="do plano feito" />
        </div>
        <div className="relative h-16" aria-hidden>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-muted/50" />
          <div className="flex h-full items-end gap-2">
            {stats.last7.map((d, i) => (
              <div key={d.day} className="flex h-full flex-1 items-end justify-center">
                <div
                  className="bar-y w-full max-w-7 rounded-t-md"
                  style={
                    {
                      height: `${Math.max(4, Math.min(1, d.pct) * 100)}%`,
                      background: d.ok ? "var(--primary)" : d.rest ? "transparent" : d.pct > 0 ? "var(--chart-muted)" : "var(--border)",
                      "--i": i,
                    } as CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 flex gap-2 text-center text-sm text-muted" aria-hidden>
          {stats.last7.map((d) => (
            <span key={d.day} className="flex-1">
              {WEEKDAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}
            </span>
          ))}
        </div>
        <p className="sr-only">Nos últimos 7 dias, o plano foi cumprido em {stats.onPlan7} de {stats.planned7} dias.</p>
      </div>
    </div>
  );
}

/** Marcas no arco onde cada item do plano termina (caminhada, depois treino). */
function cumulative(items: ItemProgress[], planned: number) {
  let acc = 0;
  return items.map((it) => {
    acc += it.minutes;
    return { at: acc / planned, reached: it.ok };
  });
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="tabular text-xl font-bold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
