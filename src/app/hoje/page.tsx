import Link from "next/link";
import { BottomNav, Card, LinkButton, Notice, Page, Progress } from "@/components/ui";
import { Consistency } from "@/components/dashboard/consistency";
import { CountUp } from "@/components/dashboard/count-up";
import { DayClock, type ClockMeal } from "@/components/dashboard/day-clock";
import { Rings } from "@/components/dashboard/rings";
import { WeightChart } from "@/components/dashboard/weight-chart";
import { requireOnboarded } from "@/lib/auth";
import {
  dailyWeights,
  movingAverage,
  nextHint,
  projectGoalDate,
  scoreDay,
  streak,
  suggestedSteps,
  weeklyTrend,
  type DayScore,
} from "@/lib/dashboard";
import { getCurrentGoal, isCautious } from "@/lib/data";
import { addDays, dayRange, formatDay, formatTime, MEAL_TYPE_LABEL, minutesOfDay, todayISO } from "@/lib/dates";
import { isMissingTable } from "@/lib/accounts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuickLog } from "./quick-log";
import { SleepCard, type NightSummary } from "./sleep-card";
import { RISK_TEXT, sleepMetrics, sleepVsIntake, type SleepLog } from "@/lib/sleep";

type MealRow = {
  id: string;
  eaten_at: string;
  meal_type: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  meal_items: { name: string }[];
};

const CALENDAR_DAYS = 28;
const CHART_DAYS = 30;
// A sequência olha mais para trás que o calendário, para não travar em 28.
const STREAK_DAYS = 120;

const sum = (rows: MealRow[], key: keyof MealRow) => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
const kg1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function greeting(minutes: number) {
  if (minutes < 5 * 60) return "Boa noite";
  if (minutes < 12 * 60) return "Bom dia";
  if (minutes < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

export default async function TodayPage() {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const today = todayISO(now);
  const nowMinutes = minutesOfDay(now);
  const { from, to } = dayRange(today);
  const calendarFrom = dayRange(addDays(today, -(CALENDAR_DAYS - 1))).from;

  const [goal, cautious, mealsRes, lastMealRes, stepsRes, weightsRes, historyRes, dizzyRes, streakRes, sleepRes, apneaRes] =
    await Promise.all([
    getCurrentGoal(),
    isCautious(),
    supabase
      .from("meals")
      .select("id, eaten_at, meal_type, kcal, protein_g, fat_g, carbs_g, fiber_g, meal_items(name)")
      .gte("eaten_at", from)
      .lt("eaten_at", to)
      .order("eaten_at"),
    supabase
      .from("meals")
      .select("eaten_at")
      .lte("eaten_at", now.toISOString())
      .gte("eaten_at", dayRange(addDays(today, -2)).from)
      .order("eaten_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("step_logs").select("steps, source").eq("day", today),
    supabase
      .from("weight_logs")
      .select("weight_kg, measured_at")
      .gte("measured_at", dayRange(addDays(today, -(CHART_DAYS + 6))).from)
      .order("measured_at"),
    supabase.from("meals").select("eaten_at, kcal, protein_g").gte("eaten_at", calendarFrom).lt("eaten_at", from),
    supabase
      .from("symptom_logs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "dizziness")
      .gte("logged_at", dayRange(addDays(today, -7)).from),
    supabase
      .from("meals")
      .select("eaten_at")
      .gte("eaten_at", dayRange(addDays(today, -(STREAK_DAYS - 1))).from)
      .lt("eaten_at", from)
      .limit(5000),
    supabase
      .from("sleep_logs")
      .select("night, bedtime, wake_time, latency_min, awake_min, quality")
      .gte("night", addDays(today, -(CALENDAR_DAYS - 1)))
      .order("night", { ascending: false })
      .order("source", { ascending: false }), // "manual" antes de "apple_health"
    supabase
      .from("sleep_screenings")
      .select("risk, score, taken_at")
      .eq("kind", "stop_bang")
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const meals = (mealsRes.data ?? []) as MealRow[];
  const kcal = sum(meals, "kcal");
  const protein = sum(meals, "protein_g");
  const steps = Math.max(0, ...(stepsRes.data ?? []).map((s) => s.steps));
  const manualSteps = (stepsRes.data ?? []).find((s) => s.source === "manual")?.steps ?? null;
  const stepGoal = suggestedSteps(profile.walk_minutes_per_day);

  // Peso: um por dia, média de 7 dias, tendência e previsão.
  const allWeights = dailyWeights(
    (weightsRes.data ?? []).map((w) => ({ day: todayISO(new Date(w.measured_at)), kg: Number(w.weight_kg), at: w.measured_at })),
  );
  const avgs = movingAverage(allWeights);
  const chartFrom = addDays(today, -(CHART_DAYS - 1));
  const chartPoints = allWeights
    .map((p, i) => ({ day: p.day, kg: p.kg, avg: avgs[i].kg }))
    .filter((p) => p.day >= chartFrom);
  const lastPoint = chartPoints.at(-1) ?? null;
  const currentAvg = lastPoint?.avg ?? null;
  const staleWeight = lastPoint !== null && lastPoint.day < addDays(today, -3);
  // Compara com cerca de uma semana antes da última pesagem (entre 6 e 10 dias).
  const weekAgo = lastPoint
    ? [...chartPoints].reverse().find((p) => p.day <= addDays(lastPoint.day, -6) && p.day >= addDays(lastPoint.day, -10))
    : undefined;
  const weekDelta = currentAvg !== null && weekAgo ? currentAvg - weekAgo.avg : null;
  const trend = weeklyTrend(allWeights.filter((p) => p.day >= addDays(today, -27)));
  const target = profile.target_weight_kg !== null ? Number(profile.target_weight_kg) : null;
  const goalDate =
    lastPoint !== null && target !== null && !staleWeight ? projectGoalDate(lastPoint.avg, target, trend, lastPoint.day) : null;

  // Constância: nota de cada dia nas últimas 4 semanas.
  const byDay = new Map<string, { meals: number; kcal: number; protein: number }>();
  for (const m of historyRes.data ?? []) {
    const d = todayISO(new Date(m.eaten_at));
    const cur = byDay.get(d) ?? { meals: 0, kcal: 0, protein: 0 };
    cur.meals++;
    cur.kcal += Number(m.kcal);
    cur.protein += Number(m.protein_g);
    byDay.set(d, cur);
  }
  byDay.set(today, { meals: meals.length, kcal, protein });
  const calendar: DayScore[] = Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const day = addDays(today, -(CALENDAR_DAYS - 1 - i));
    return { day, level: scoreDay(byDay.get(day) ?? { meals: 0, kcal: 0, protein: 0 }, goal) };
  });
  const loggedDays = new Set((streakRes.data ?? []).map((m) => todayISO(new Date(m.eaten_at))));
  const streakDays: DayScore[] = Array.from({ length: STREAK_DAYS }, (_, i) => {
    const day = addDays(today, -i);
    return { day, level: day === today ? (meals.length > 0 ? 1 : 0) : loggedDays.has(day) ? 1 : 0 };
  });
  const currentStreak = streak(streakDays, today);

  // Alerta: menos de 1.500 kcal registradas em cada um dos 3 dias anteriores.
  const lowIntakeDays = [1, 2, 3].filter((i) => {
    const v = byDay.get(addDays(today, -i));
    return v !== undefined && v.kcal < 1500;
  }).length;

  const clockMeals: ClockMeal[] = meals.map((m) => ({
    id: m.id,
    minutes: minutesOfDay(m.eaten_at),
    time: formatTime(m.eaten_at),
    label: MEAL_TYPE_LABEL[m.meal_type] ?? "Refeição",
    kcal: Number(m.kcal),
    items: m.meal_items.map((i) => i.name).join(", "),
  }));
  const lastMealAt = lastMealRes.data?.eaten_at ?? null;
  const lastMealAgo = lastMealAt ? (now.getTime() - Date.parse(lastMealAt)) / 60000 : null;

  // Sono: uma noite por dia (a manual tem prioridade), métricas e comparação com a comida.
  const sleepByNight = new Map<string, SleepLog>();
  for (const s of (sleepRes.data ?? []) as SleepLog[]) if (!sleepByNight.has(s.night)) sleepByNight.set(s.night, s);
  const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
  const summarize = (s: SleepLog): NightSummary => {
    const m = sleepMetrics(s);
    return {
      night: s.night,
      weekday: weekdayFmt.format(new Date(`${s.night}T12:00:00Z`)).replace(".", ""),
      bed: formatTime(s.bedtime),
      wake: formatTime(s.wake_time),
      asleepMin: m.asleepMin,
      inBedMin: m.inBedMin,
      efficiency: m.efficiency,
      quality: s.quality,
      latency: s.latency_min,
      awake: s.awake_min,
    };
  };
  const todaySleep = sleepByNight.get(today);
  const lastSleep = (sleepRes.data ?? [])[0] as SleepLog | undefined;
  const sleepWeek = Array.from({ length: 7 }, (_, i) => {
    const s = sleepByNight.get(addDays(today, -(6 - i)));
    return s ? summarize(s) : null;
  });
  // Só dias completos entram na comparação: duas refeições ou mais.
  const kcalByDay = new Map([...byDay.entries()].filter(([, v]) => v.meals >= 2).map(([d, v]) => [d, v.kcal]));
  const sleepFood = sleepVsIntake(
    [...sleepByNight.values()].filter((s) => s.night !== today).map((s) => ({ night: s.night, asleepMin: sleepMetrics(s).asleepMin })),
    kcalByDay,
  );
  const sleepInsight =
    sleepFood && sleepFood.diff >= 150
      ? `Nos dias depois de dormir menos de 6 horas, você comeu em média ${Math.round(sleepFood.diff).toLocaleString("pt-BR")} kcal a mais do que depois de noites de 7 horas ou mais (${sleepFood.shortDays} e ${sleepFood.okDays} dias comparados).`
      : null;
  const apnea = apneaRes.data
    ? { risk: apneaRes.data.risk as "low" | "intermediate" | "high", label: RISK_TEXT[apneaRes.data.risk as "low" | "intermediate" | "high"].title.replace(" de apneia", "").toLowerCase() }
    : null;
  // No relógio de hoje só entra o trecho depois da meia-noite.
  const clockSleep = todaySleep
    ? { from: todayISO(new Date(todaySleep.bedtime)) < today ? 0 : minutesOfDay(todaySleep.bedtime), to: minutesOfDay(todaySleep.wake_time) }
    : null;
  // Sem a migração do sono aplicada, o cartão fica escondido em vez de falhar ao salvar.
  const sleepReady = !(sleepRes.error && isMissingTable(sleepRes.error));
  // De manhã, sem a noite registrada, o cartão de sono sobe para o topo.
  const morningAsk = sleepReady && !todaySleep && nowMinutes >= 4 * 60 && nowMinutes < 14 * 60;
  const sleepCard = (
    <Card index={morningAsk ? 0 : 4} title="Sono">
      <SleepCard
        today={todaySleep ? summarize(todaySleep) : null}
        last={lastSleep ? summarize(lastSleep) : null}
        week={sleepWeek}
        insight={sleepInsight}
        apnea={apnea}
        defaultNight={nowMinutes < 4 * 60 ? "yesterday" : "today"}
      />
    </Card>
  );

  const remaining = goal ? goal.kcal - kcal : null;
  const hint = nextHint({ hour: Math.floor(nowMinutes / 60), meals: meals.length, kcal, protein, steps, goal, stepGoal });
  const firstName = profile.display_name.split(" ")[0];
  const firstNameNice = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  return (
    <Page title={`${greeting(nowMinutes)}, ${firstNameNice}`} subtitle={formatDay(today)}>
      {lowIntakeDays === 3 && (
        <Notice>
          Nos últimos 3 dias você registrou menos de 1.500 kcal por dia. Comer pouco demais faz perder músculo e pode
          causar tontura. Se foi esquecimento de registrar, tudo bem; se não, tente chegar mais perto da sua meta.
        </Notice>
      )}
      {(dizzyRes.count ?? 0) >= 2 && (
        <Notice>Você registrou tontura mais de uma vez nesta semana. Meça a pressão e fale com seu médico.</Notice>
      )}

      {morningAsk && sleepCard}

      {goal && (
        <Card index={0}>
          <Rings
            center={{
              label: remaining !== null && remaining < 0 ? "acima da meta" : "restam",
              value: Math.abs(Math.round(remaining ?? 0)),
              unit: "kcal",
              over: remaining !== null && remaining < 0,
            }}
            rings={[
              { key: "kcal", label: "Calorias", value: kcal, target: goal.kcal, unit: "kcal", color: "var(--ring-kcal)" },
              { key: "protein", label: "Proteína", value: protein, target: goal.protein_g, unit: "g", color: "var(--ring-protein)" },
              { key: "steps", label: "Passos", value: steps, target: stepGoal, unit: "", color: "var(--ring-steps)" },
            ]}
          />
          {hint && (
            <p
              className={`rise mt-4 rounded-2xl px-4 py-3 text-sm ${
                hint.tone === "good" ? "bg-primary-soft text-foreground" : "bg-surface-2 text-foreground"
              }`}
              style={{ "--i": 5 } as React.CSSProperties}
            >
              {hint.tone === "good" ? "✓ " : ""}
              {hint.text}
            </p>
          )}
        </Card>
      )}

      <Card index={1} title="Seu dia" action={<Link href="/refeicao/nova" className="font-semibold text-primary">+ Refeição</Link>}>
        <DayClock
          meals={clockMeals}
          nowMinutes={nowMinutes}
          lastMealAgoMinutes={lastMealAgo}
          lastMealAt={lastMealAt}
          day={today}
          sleep={clockSleep}
        />
        {meals.length === 0 && (
          <div className="mt-4">
            <LinkButton href="/refeicao/nova">Registrar refeição</LinkButton>
          </div>
        )}
      </Card>

      {goal && (
        <Card index={2} title="Outros nutrientes" action={<Link href="/metas" className="text-muted underline">metas</Link>}>
          <Progress label="Carboidrato" value={sum(meals, "carbs_g")} target={goal.carbs_g} unit="g" color="var(--ring-kcal)" index={0} />
          <Progress label="Gordura" value={sum(meals, "fat_g")} target={goal.fat_g} unit="g" color="var(--night)" index={1} />
          <Progress label="Fibra" value={sum(meals, "fiber_g")} target={goal.fiber_g} unit="g" color="var(--ring-steps)" index={2} />
        </Card>
      )}

      <Card index={3} title="Registrar">
        <QuickLog cautious={cautious} manualSteps={manualSteps} />
      </Card>

      {sleepReady && !morningAsk && sleepCard}

      <Card index={5} title="Peso">
        {currentAvg !== null ? (
          <>
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
              <span className="text-3xl font-bold tracking-tight"><CountUp value={currentAvg} decimals={1} /> kg</span>
              <span className="text-sm text-muted">
                média de 7 dias{staleWeight ? `, até ${lastPoint!.day.slice(8)}/${lastPoint!.day.slice(5, 7)}` : ""}
              </span>
              {weekDelta !== null && Math.abs(weekDelta) >= 0.05 && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    (target !== null && Math.sign(weekDelta) === Math.sign(target - currentAvg))
                      ? "bg-primary-soft text-primary"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {weekDelta < 0 ? "↓" : "↑"} {kg1(Math.abs(weekDelta))} kg na semana
                </span>
              )}
            </div>
            {goalDate ? (
              <p className="mb-3 text-sm text-muted">
                Nesse ritmo, {kg1(target!)} kg por volta de{" "}
                <strong className="text-foreground">
                  {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${goalDate}T12:00:00Z`))}
                </strong>
                .
              </p>
            ) : (
              <p className="mb-3 text-sm text-muted">
                {staleWeight
                  ? "Faz alguns dias que você não se pesa. Registre o peso para atualizar a tendência."
                  : allWeights.length < 4
                  ? "Pese-se algumas vezes por semana para o app calcular sua tendência."
                  : "O peso oscila com água e sal. Olhe a linha da média, não o número do dia."}
              </p>
            )}
            <WeightChart points={chartPoints} target={target} />
          </>
        ) : (
          <p className="text-muted">Registre seu peso na aba Peso, acima, para ver o gráfico.</p>
        )}
      </Card>

      <Card index={6} title="Constância">
        <Consistency days={calendar} today={today} streak={currentStreak} />
      </Card>

      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
