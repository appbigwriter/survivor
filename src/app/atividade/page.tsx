import { BottomNav, Card, Notice, Page } from "@/components/ui";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { activityStats, dayProgress, KIND_LABEL, weekdayOf, type ActivityKind } from "@/lib/activity";
import { loadActivity } from "@/lib/activity-server";
import { requireOnboarded } from "@/lib/auth";
import { suggestedSteps } from "@/lib/dashboard";
import { isCautious } from "@/lib/data";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import { suggestWorkout, type Workout } from "@/lib/workouts";
import { DeleteButton } from "./delete-button";
import { LogForm, PlanForm } from "./forms";

export default async function ActivityPage() {
  const profile = await requireOnboarded();
  const today = todayISO();
  const [ctx, cautious] = await Promise.all([loadActivity(profile, today), isCautious()]);
  const { plan } = ctx;
  const steps = ctx.stepsByDay.get(today) ?? 0;
  const progress = dayProgress(plan, today, ctx.sessions, steps);
  const stats = activityStats(plan, today, ctx.sessions, ctx.stepsByDay, addDays);

  const wd = weekdayOf(today);
  const workouts = progress.items
    .map((it) =>
      suggestWorkout({
        kind: it.kind,
        minutes: it.minutes,
        location: profile.training_location ?? "gym",
        experience: profile.training_experience ?? "never",
        cautious,
        strengthIndex: Math.max(0, plan.strengthDays.indexOf(wd)),
      }),
    )
    .filter((w): w is Workout => w !== null);
  // O que ainda falta hoje vira o tipo sugerido no registro.
  const nextKind: ActivityKind = progress.items.find((i) => !i.ok)?.kind ?? "walk";

  return (
    <Page title="Atividade física" subtitle={formatDay(today)} back="/hoje">
      {!ctx.ready && (
        <Notice tone="info">O registro de atividades ainda não está disponível neste servidor. Por enquanto, o app conta os passos.</Notice>
      )}

      <Card index={0} title="Hoje">
        <ActivityPanel {...progress} steps={steps} stepGoal={suggestedSteps(profile.walk_minutes_per_day)} stats={stats} />
      </Card>

      {workouts.length > 0 && (
        <Card index={1} title="Treino sugerido para hoje">
          <div className="space-y-3">
            {workouts.map((w, i) => (
              <details key={w.title} className="group rounded-2xl border border-border" open={i === 0 && workouts.length === 1}>
                <summary className="press flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3">
                  <span>
                    <span className="block font-semibold">{w.title}</span>
                    <span className="block text-sm text-muted">{w.minutes} minutos</span>
                  </span>
                  <span className="text-muted transition group-open:rotate-180" aria-hidden>
                    ▾
                  </span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="mb-3 text-muted">{w.warmup}</p>
                  {w.rounds && <p className="mb-2 font-semibold">{w.rounds}</p>}
                  <ol className="mb-3 space-y-2">
                    {w.exercises.map((e, n) => (
                      <li key={e.name} className="flex gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{n + 1}</span>
                        <div>
                          <p className="font-semibold leading-tight">{e.name}</p>
                          <p className="text-muted">{e.dose}</p>
                          {e.tip && <p className="text-sm text-muted">{e.tip}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="mb-3 text-muted">{w.cooldown}</p>
                  <ul className="space-y-1 border-l-4 border-accent pl-3 text-sm">
                    {w.safety.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}

      {ctx.ready && (
        <Card index={2} title="Registrar atividade">
          <LogForm defaultKind={nextKind} />
        </Card>
      )}

      {ctx.ready && ctx.sessions.length > 0 && (
        <Card index={3} title="Últimas atividades">
          <ul className="divide-y divide-border">
            {ctx.sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {KIND_LABEL[s.kind]} · {s.minutes} min
                  </p>
                  <p className="text-sm text-muted">
                    {s.day === today ? "Hoje" : s.day === addDays(today, -1) ? "Ontem" : formatDay(s.day)}
                    {s.source === "apple_health" ? " · iPhone" : ""}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </p>
                </div>
                {s.source === "manual" && (
                  <DeleteButton id={s.id} label={`${KIND_LABEL[s.kind].toLowerCase()} de ${s.minutes} minutos`} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {ctx.ready && (
        <Card index={4} title="Plano da semana">
          {!ctx.savedPlan && <p className="mb-4 text-muted">Montamos este plano com as suas respostas da anamnese. Ajuste os dias como preferir.</p>}
          <PlanForm strengthDays={plan.strengthDays} calisthenicsDays={plan.calisthenicsDays} walkMinutes={plan.walkMinutes} />
        </Card>
      )}

      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
