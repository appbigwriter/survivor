import type { CSSProperties } from "react";
import { Arc } from "./arc";
import { CountUp } from "./count-up";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");


/**
 * Resumo do dia: um arco único com as calorias que ainda cabem, ladeado pelo
 * que já foi consumido e pela meta, e os nutrientes em barras pequenas.
 * O arco se desenha ao abrir a tela; quem pediu menos movimento vê ele pronto.
 */
export function DaySummary({
  kcal,
  kcalGoal,
  macros,
}: {
  kcal: number;
  kcalGoal: number;
  /** okOver: passar da meta é bom (proteína, fibra), então não pinta de laranja. */
  macros: { label: string; value: number; target: number; okOver?: boolean }[];
}) {
  const remaining = kcalGoal - kcal;
  const over = remaining < 0;
  const pct = kcalGoal > 0 ? Math.min(1, Math.max(0, kcal / kcalGoal)) : 0;

  return (
    <div>
      <Arc value={pct} tone={over ? "accent" : "primary"} label={`${fmt(kcal)} de ${fmt(kcalGoal)} kcal consumidas`}>
        <p className="text-[2.6rem] font-bold leading-none tracking-tight">
          <CountUp value={Math.abs(Math.round(remaining))} />
        </p>
        <p className={`mt-1 font-medium ${over ? "text-accent" : "text-muted"}`}>{over ? "kcal acima da meta" : "kcal ainda cabem"}</p>
      </Arc>

      <div className="mb-6 flex justify-between px-1">
        <Side label="Consumidas" value={fmt(kcal)} />
        <Side label="Meta do dia" value={fmt(kcalGoal)} align="right" />
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        {macros.map((m, i) => (
          <Mini key={m.label} {...m} index={i} />
        ))}
      </div>
    </div>
  );
}

function Side({ label, value, align }: { label: string; value: string; align?: "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="tabular text-xl font-bold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function Mini({ label, value, target, okOver, index }: { label: string; value: number; target: number; okOver?: boolean; index: number }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = !okOver && target ? value > target * 1.1 : false;
  const done = target ? value >= target && !over : false;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {done && (
          <span className="pop grid size-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-label="meta atingida">
            ✓
          </span>
        )}
      </div>
      <div className="mb-1 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div
          className="bar-x h-full rounded-full"
          style={{ width: `${pct}%`, background: over ? "var(--accent)" : "var(--primary)", "--i": index + 2 } as CSSProperties}
        />
      </div>
      <p className="tabular text-sm text-muted">
        <strong className={`font-semibold ${over ? "text-accent" : "text-foreground"}`}>{fmt(value)}</strong> / {fmt(target)} g
      </p>
    </div>
  );
}

