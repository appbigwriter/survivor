import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { formatTime, MEAL_TYPE_LABEL } from "@/lib/dates";
import type { MealSlot } from "@/lib/meal-slots";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
// Comprimento real do anel (raio 21).
const RING_LEN = 2 * Math.PI * 21;

/** Refeições do dia por horário: anel de progresso, total, o que foi comido e um "+" para registrar. */
export function MealSlots({ slots }: { slots: MealSlot[] }) {
  return (
    <ul className="divide-y divide-border">
      {slots.map((s, i) => {
        const pct = s.target ? Math.min(1, s.kcal / s.target) : s.kcal > 0 ? 1 : 0;
        // A divisão por refeição é só referência: passar dela não é erro, então o anel só enche (sem laranja).
        const label = MEAL_TYPE_LABEL[s.type] ?? "Refeição";
        return (
          <li key={s.type} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <Ring pct={pct} index={i}>
                {ICONS[s.type] ?? ICONS.snack}
              </Ring>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold leading-tight">{label}</p>
                <p className="tabular text-muted">
                  <strong className="font-semibold text-foreground">{fmt(s.kcal)}</strong>
                  {s.target ? ` / ${fmt(s.target)}` : ""} kcal
                </p>
              </div>
              <Link
                href={`/refeicao/nova?tipo=${s.type}`}
                aria-label={`Registrar ${label.toLowerCase()}`}
                className="plus grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"
              >
                <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
                </svg>
              </Link>
            </div>
            {s.meals.length > 0 && (
              <ul className="ml-[3.75rem] mt-2">
                {s.meals.map((m) => (
                  <li key={m.id}>
                    <Link href={`/refeicao/${m.id}`} className="press -mx-2 flex min-h-11 items-start gap-2 rounded-xl px-2 py-1.5">
                      <span className="tabular shrink-0 pt-0.5 text-sm text-muted">{formatTime(m.eaten_at)}</span>
                      <span className="line-clamp-2 min-w-0 flex-1">{m.items.join(", ") || "Refeição"}</span>
                      {s.meals.length > 1 && <span className="tabular shrink-0 pt-0.5 text-sm text-muted">{fmt(m.kcal)}</span>}
                      <span className="pt-0.5 text-muted" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Ring({ pct, index, children }: { pct: number; index: number; children: ReactNode }) {
  return (
    <span className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={24} cy={24} r={21} fill="none" stroke="var(--surface-2)" strokeWidth={4} />
        {pct > 0 && (
          <circle
            cx={24}
            cy={24}
            r={21}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={4}
            strokeLinecap="round"
            className="arc-fill"
            style={{ strokeDasharray: `${pct * RING_LEN} ${RING_LEN}`, "--len": RING_LEN, "--i": index + 1 } as CSSProperties}
          />
        )}
      </svg>
      <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-foreground" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

// Ícones de traço simples, desenhados para este app.
const ICONS: Record<string, ReactNode> = {
  // Xícara
  breakfast: (
    <>
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M9 3c-.6.8-.6 1.7 0 2.5M12 3c-.6.8-.6 1.7 0 2.5" />
    </>
  ),
  // Prato com talher
  lunch: (
    <>
      <circle cx={13} cy={12} r={6.5} />
      <circle cx={13} cy={12} r={3.5} />
      <path d="M3.5 4v6M2 4v3.5a1.5 1.5 0 0 0 3 0V4M3.5 10v10" />
    </>
  ),
  // Maçã
  snack: (
    <>
      <path d="M12 8c-1.5-1-4.5-1.2-6 .8-1.8 2.4-.8 7 1.4 9.6 1.3 1.5 2.6 1.8 3.6 1.2.6-.3 1.4-.3 2 0 1 .6 2.3.3 3.6-1.2 2.2-2.6 3.2-7.2 1.4-9.6-1.5-2-4.5-1.8-6-.8z" />
      <path d="M12 8c0-2 .8-3.5 2.5-4.5" />
    </>
  ),
  // Tigela
  dinner: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0z" />
      <path d="M8 7c0-1 .8-1.5.8-2.5M12 7c0-1 .8-1.5.8-2.5M16 7c0-1 .8-1.5.8-2.5" />
    </>
  ),
  // Lua
  supper: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
};
