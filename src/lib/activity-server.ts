import "server-only";
import { isMissingTable } from "@/lib/accounts";
import type { Profile } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { defaultPlan, type ActivityKind, type ActivityPlan, type Session } from "@/lib/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActivityContext = {
  plan: ActivityPlan;
  /** true se a pessoa já salvou um plano; false = plano padrão tirado da anamnese. */
  savedPlan: boolean;
  sessions: (Session & { id: string; effort: number | null; notes: string | null; source: string })[];
  stepsByDay: Map<string, number>;
  /** false enquanto a migração 0005 não rodou. */
  ready: boolean;
};

// 60 dias: a sequência da atividade olha até dois meses para trás.
export async function loadActivity(profile: Profile, today: string, days = 60): Promise<ActivityContext> {
  const supabase = await createSupabaseServerClient();
  const since = addDays(today, -(days - 1));
  const [planRes, sessionsRes, stepsRes] = await Promise.all([
    supabase.from("activity_plans").select("strength_days, calisthenics_days, walk_minutes").maybeSingle(),
    supabase
      .from("activity_sessions")
      .select("id, day, kind, minutes, effort, notes, source")
      .gte("day", since)
      .order("day", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("step_logs").select("day, steps").gte("day", since),
  ]);

  const ready = !(planRes.error && isMissingTable(planRes.error));
  const fallback = defaultPlan({
    strengthSessions: profile.strength_sessions_per_week ?? 0,
    calisthenicsSessions: profile.calisthenics_sessions_per_week ?? 0,
    // O plano aceita até 180 min de caminhada; a anamnese, até 300.
    walkMinutes: Math.min(180, profile.walk_minutes_per_day ?? 30),
    strengthMinutes: profile.strength_minutes_per_session ?? 60,
    calisthenicsMinutes: profile.calisthenics_minutes_per_session ?? 30,
  });
  const row = planRes.data;
  const plan: ActivityPlan = row
    ? {
        ...fallback,
        strengthDays: (row.strength_days as number[]) ?? [],
        calisthenicsDays: (row.calisthenics_days as number[]) ?? [],
        walkMinutes: Number(row.walk_minutes),
      }
    : fallback;

  // Vários registros no mesmo dia (manual e iPhone): vale o maior.
  const stepsByDay = new Map<string, number>();
  for (const s of stepsRes.data ?? []) stepsByDay.set(s.day, Math.max(stepsByDay.get(s.day) ?? 0, s.steps));

  return {
    plan,
    savedPlan: Boolean(row),
    sessions: (sessionsRes.data ?? []).map((s) => ({
      id: s.id,
      day: s.day,
      kind: s.kind as ActivityKind,
      minutes: Number(s.minutes),
      effort: s.effort,
      notes: s.notes,
      source: s.source,
    })),
    stepsByDay,
    ready,
  };
}
