import type { CSSProperties } from "react";
import { BottomNav, Card, Page } from "@/components/ui";
import { DailyBars } from "@/components/dashboard/daily-bars";
import { suggestedSteps } from "@/lib/dashboard";
import { sleepMetrics, type SleepLog } from "@/lib/sleep";
import { requireOnboarded } from "@/lib/auth";
import { getCurrentGoal } from "@/lib/data";
import { addDays, dayRange, formatDay, todayISO } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DAYS = 14;

export default async function HistoryPage() {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const today = todayISO();
  const from = dayRange(addDays(today, -(DAYS - 1))).from;

  const [goal, mealsRes, stepsRes, weightsRes, sleepRes] = await Promise.all([
    getCurrentGoal(),
    supabase.from("meals").select("eaten_at, kcal, protein_g").gte("eaten_at", from),
    supabase.from("step_logs").select("day, steps").gte("day", addDays(today, -(DAYS - 1))),
    supabase.from("weight_logs").select("measured_at, weight_kg").gte("measured_at", from).order("measured_at"),
    supabase
      .from("sleep_logs")
      .select("night, bedtime, wake_time, latency_min, awake_min, quality")
      .gte("night", addDays(today, -(DAYS - 1)))
      .order("source", { ascending: false }),
  ]);

  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, -i));
  const agg = new Map(days.map((d) => [d, { kcal: 0, protein: 0, steps: 0, weight: null as number | null, meals: 0 }]));
  for (const m of mealsRes.data ?? []) {
    const a = agg.get(todayISO(new Date(m.eaten_at)));
    if (a) {
      a.kcal += Number(m.kcal);
      a.protein += Number(m.protein_g);
      a.meals++;
    }
  }
  for (const s of stepsRes.data ?? []) {
    const a = agg.get(s.day);
    if (a) a.steps = Math.max(a.steps, s.steps);
  }
  for (const w of weightsRes.data ?? []) {
    const a = agg.get(todayISO(new Date(w.measured_at)));
    if (a) a.weight = Number(w.weight_kg);
  }

  const withMeals = days.filter((d) => agg.get(d)!.meals > 0);
  const inTarget = goal
    ? withMeals.filter((d) => Math.abs(agg.get(d)!.kcal - goal.kcal) <= goal.kcal * 0.1).length
    : 0;

  const chrono = [...days].reverse();
  const sleepHours = new Map<string, number>();
  for (const s of (sleepRes.data ?? []) as SleepLog[]) {
    if (!sleepHours.has(s.night)) sleepHours.set(s.night, sleepMetrics(s).asleepMin / 60);
  }
  const avgSleep = sleepHours.size ? [...sleepHours.values()].reduce((a, b) => a + b, 0) / sleepHours.size : null;
  const stepGoal = suggestedSteps(profile.walk_minutes_per_day);
  const withSteps = days.filter((d) => agg.get(d)!.steps > 0);
  const avgSteps = withSteps.length ? withSteps.reduce((a, d) => a + agg.get(d)!.steps, 0) / withSteps.length : 0;
  const avgKcal = withMeals.length ? withMeals.reduce((a, d) => a + agg.get(d)!.kcal, 0) / withMeals.length : 0;
  const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

  return (
    <Page title="Histórico" subtitle="Últimos 14 dias">
      {goal && withMeals.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "dias com registro", value: `${withMeals.length}/${DAYS}` },
            { label: "dias na meta", value: String(inTarget) },
            { label: "kcal por dia", value: fmt(avgKcal) },
          ].map((s, i) => (
            <div key={s.label} className="pop rounded-2xl border border-border bg-surface p-3 text-center shadow-[var(--shadow)]" style={{ "--i": i * 6 } as CSSProperties}>
              <span className="block text-2xl font-bold">{s.value}</span>
              <span className="block text-xs text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <Card index={1} title="Calorias" action={goal ? <span className="text-muted">cheia = dentro da meta</span> : undefined}>
        <DailyBars
          bars={chrono.map((d) => ({ day: d, value: agg.get(d)!.meals ? agg.get(d)!.kcal : null }))}
          target={goal?.kcal ?? null}
          color="var(--ring-kcal)"
          label="Calorias por dia nos últimos 14 dias"
        />
      </Card>

      <Card index={2} title="Passos" action={<span className="text-muted">média {fmt(avgSteps)}</span>}>
        <DailyBars
          bars={chrono.map((d) => ({ day: d, value: agg.get(d)!.steps || null }))}
          target={stepGoal}
          color="var(--ring-steps)"
          mode="min"
          label="Passos por dia nos últimos 14 dias"
        />
      </Card>

      {sleepHours.size > 0 && (
        <Card
          index={3}
          title="Sono"
          action={
            avgSleep !== null ? (
              <span className="text-muted">média {avgSleep.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h</span>
            ) : undefined
          }
        >
          <DailyBars
            bars={chrono.map((d) => ({ day: d, value: sleepHours.get(d) ?? null }))}
            target={8}
            targetLabel="8 h"
            tolerance={0.125}
            color="var(--night)"
            label="Horas de sono por noite nos últimos 14 dias"
          />
          <p className="mt-1 text-xs text-muted">Cheia: entre 7 e 9 horas.</p>
        </Card>
      )}

      <Card index={4} title="Dia a dia">
        <ul className="divide-y divide-border">
          {days.map((d) => {
            const a = agg.get(d)!;
            const onTarget = goal && a.meals > 0 && Math.abs(a.kcal - goal.kcal) <= goal.kcal * 0.1;
            return (
              <li key={d} className="flex items-center gap-3 py-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${onTarget ? "bg-primary" : a.meals ? "bg-kcal/50" : "bg-border"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{formatDay(d)}</span>
                  <span className="block text-sm text-muted">
                    {a.meals ? `${fmt(a.kcal)} kcal · ${Math.round(a.protein)} g proteína` : "sem refeições"}
                    {" · "}
                    {a.steps.toLocaleString("pt-BR")} passos
                  </span>
                </span>
                {a.weight ? <span className="tabular shrink-0 font-semibold">{a.weight.toLocaleString("pt-BR")} kg</span> : null}
              </li>
            );
          })}
        </ul>
      </Card>
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
