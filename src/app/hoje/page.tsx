import Link from "next/link";
import { BottomNav, Card, Notice, Page } from "@/components/ui";
import { DaySummary } from "@/components/dashboard/day-summary";
import { MealSlots } from "@/components/dashboard/meal-slots";
import { mealSlots } from "@/lib/meal-slots";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { activityStats, dayProgress } from "@/lib/activity";
import { loadActivity } from "@/lib/activity-server";
import { Consistency } from "@/components/dashboard/consistency";
import { CountUp } from "@/components/dashboard/count-up";
import { SinceLastMeal } from "@/components/dashboard/since-last-meal";
import { FastingStatus } from "@/components/dashboard/fasting-status";
import { fastingStats, fastingWarning, overnightFasts, parseHHMM, protocolById } from "@/lib/fasting";
import { liveFasting, loadFastingContext } from "@/lib/fasting-server";
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
import { addDays, dayRange, formatDay, formatTime, minutesOfDay, todayISO } from "@/lib/dates";
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

  const [goal, cautious, mealsRes, lastMealRes, stepsRes, weightsRes, historyRes, dizzyRes, streakRes, sleepRes, apneaRes, fastingCtx, activityCtx, lowBpRes, sleepStartRes] =
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
      // "*" para ler starts_fast sem quebrar enquanto a migração 0006 não rodou.
      .select("*")
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
    loadFastingContext(profile),
    loadActivity(profile, today),
    supabase
      .from("bp_logs")
      .select("id", { count: "exact", head: true })
      .gte("measured_at", dayRange(addDays(today, -2)).from)
      .or("systolic.lt.100,diastolic.lt.60"),
    supabase.from("sleep_starts").select("started_at").maybeSingle(),
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

  const lastMealAt = lastMealRes.data?.eaten_at ?? null;
  const lastMealStartsFast = Boolean(lastMealRes.data?.starts_fast);
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
  // Antes das 4h a pessoa ainda não dormiu a noite de hoje: a noite "atual" é a anterior.
  const currentNightKey = nowMinutes < 4 * 60 ? "yesterday" : "today";
  const currentSleep = currentNightKey === "yesterday" ? sleepByNight.get(addDays(today, -1)) : todaySleep;
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
  // Sem a migração do sono aplicada, o cartão fica escondido em vez de falhar ao salvar.
  const sleepReady = !(sleepRes.error && isMissingTable(sleepRes.error));
  // De manhã, sem a noite registrada, o cartão de sono sobe para o topo.
  const morningAsk = sleepReady && !todaySleep && nowMinutes >= 4 * 60 && nowMinutes < 14 * 60;
  // "Iniciar sono" em aberto; com mais de 16 h, foi esquecido e não vale mais.
  const sleepStartReady = !(sleepStartRes.error && isMissingTable(sleepStartRes.error));
  const startedAt = sleepStartRes.data?.started_at as string | undefined;
  const sleepingSince = startedAt && now.getTime() - Date.parse(startedAt) < 16 * 3_600_000 ? startedAt : null;
  // De manhã sem a noite registrada, ou dormindo, o cartão de sono sobe para o topo.
  const sleepTop = morningAsk || (sleepReady && Boolean(sleepingSince));
  const sleepCard = (
    <Card index={sleepTop ? 0 : 4} title="Sono">
      <SleepCard
        sleepingSince={sleepingSince}
        canStart={sleepStartReady}
        evening={nowMinutes >= 18 * 60 || nowMinutes < 4 * 60}
        today={currentSleep ? summarize(currentSleep) : null}
        last={lastSleep ? summarize(lastSleep) : null}
        week={sleepWeek}
        insight={sleepInsight}
        apnea={apnea}
        defaultNight={currentNightKey}
      />
    </Card>
  );

  // Jejum: só aparece para quem ativou; quem nunca configurou vê um convite discreto.
  // A triagem é refeita a cada visita: um remédio novo suspende o jejum na hora.
  const live = liveFasting(fastingCtx);
  const fasting = live.active ? live.settings : null;
  const fastingStart = fasting ? (parseHHMM(String(fasting.eating_start).slice(0, 5)) ?? 480) : 480;
  const fastingAlert = fasting
    ? fastingWarning({ dizzyLast7d: dizzyRes.count ?? 0, lowBpLast3d: (lowBpRes.count ?? 0) > 0, lowIntake3d: lowIntakeDays === 3 })
    : null;
  const showFastingInvite = fastingCtx.ready && !fastingCtx.settings;
  // Jejum de cada noite, das refeições dos últimos meses mais as de hoje.
  const fasts = fasting
    ? overnightFasts(
        [...(streakRes.data ?? []), ...meals].map((m) => ({ at: m.eaten_at, day: todayISO(new Date(m.eaten_at)) })),
      )
    : new Map<string, number>();
  const fastStats = fasting ? fastingStats(fasts, protocolById(fasting.protocol).fastH, today, addDays) : null;

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

      {sleepTop && sleepCard}

      {goal && (
        <Card
          index={0}
          title="Resumo do dia"
          action={
            <Link href="/metas" className="inline-flex min-h-11 items-center font-semibold text-primary">
              Metas e avisos ›
            </Link>
          }
        >
          <DaySummary
            kcal={kcal}
            kcalGoal={goal.kcal}
            macros={[
              { label: "Proteína", value: protein, target: goal.protein_g, okOver: true },
              { label: "Carboidrato", value: sum(meals, "carbs_g"), target: goal.carbs_g },
              { label: "Gordura", value: sum(meals, "fat_g"), target: goal.fat_g },
              { label: "Fibra", value: sum(meals, "fiber_g"), target: goal.fiber_g, okOver: true },
            ]}
          />
          {hint && (
            <p
              className={`rise mt-5 border-l-4 py-1 pl-4 ${hint.tone === "good" ? "border-primary" : "border-accent"}`}
              style={{ "--i": 4 } as React.CSSProperties}
            >
              {hint.text}
            </p>
          )}
        </Card>
      )}

      <Card
        index={1}
        title="Refeições"
        action={
          <span className="text-muted">
            Última: <strong className="text-foreground"><SinceLastMeal lastMealAt={lastMealAt} serverMinutes={lastMealAgo} day={today} /></strong>
          </span>
        }
      >
        <MealSlots
          slots={mealSlots(
            meals.map((m) => ({ id: m.id, eaten_at: m.eaten_at, meal_type: m.meal_type, kcal: Number(m.kcal), items: m.meal_items.map((i) => i.name) })),
            goal?.kcal ?? null,
            nowMinutes >= 20 * 60,
          )}
        />
        {showFastingInvite && (
          <Link href="/jejum" className="press -mx-2 mt-4 flex min-h-11 items-center justify-between gap-3 rounded-xl border-t border-border px-2 pt-4 font-medium">
            <span>Jejum intermitente: veja se é para você</span>
            <span className="text-primary" aria-hidden>
              →
            </span>
          </Link>
        )}
      </Card>

      {live.suspended && (
        <Card index={2} title="Jejum suspenso">
          <p className="mb-3">Seus dados mudaram e o jejum não está mais liberado para você. Coma normalmente.</p>
          <Link href="/jejum" className="font-semibold text-primary underline underline-offset-4">
            Ver o motivo
          </Link>
        </Card>
      )}

      {fasting && (
        <Card index={2} title={`Jejum ${protocolById(fasting.protocol).id}`} action={<Link href="/jejum" className="inline-flex min-h-11 items-center font-semibold text-primary">Ajustar ›</Link>}>
          {fastingAlert && <p className="mb-4 border-l-4 border-accent py-1 pl-4">{fastingAlert}</p>}
          <FastingStatus
            protocol={fasting.protocol}
            startMin={fastingStart}
            lastMealAt={lastMealAt}
            lastMealStartsFast={lastMealStartsFast}
            serverNowMin={nowMinutes}
            serverSinceMin={lastMealAgo}
            todayFastH={fasts.get(today) ?? null}
            stats={fastStats!}
          />
        </Card>
      )}

      <Card
        index={3}
        title="Atividade física"
        action={
          <Link href="/atividade" className="inline-flex min-h-11 items-center font-semibold text-primary">
            Plano e treino ›
          </Link>
        }
      >
        <ActivityPanel
          {...dayProgress(activityCtx.plan, today, activityCtx.sessions, Math.max(steps, activityCtx.stepsByDay.get(today) ?? 0))}
          steps={steps}
          stepGoal={stepGoal}
          stats={activityStats(activityCtx.plan, today, activityCtx.sessions, activityCtx.stepsByDay, addDays)}
        />
        <Link href="/atividade" className="press mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-primary-soft font-semibold text-primary">
          Registrar atividade
        </Link>
      </Card>

      <Card index={4} title="Registrar">
        <QuickLog cautious={cautious} manualSteps={manualSteps} />
      </Card>

      {sleepReady && !sleepTop && sleepCard}

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
