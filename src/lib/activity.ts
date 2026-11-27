// Plano da semana de atividade física e o quanto dele foi cumprido. Tudo puro.

export type ActivityKind = "walk" | "strength" | "calisthenics" | "other";

export const KIND_LABEL: Record<ActivityKind, string> = {
  walk: "Caminhada",
  strength: "Musculação",
  calisthenics: "Calistenia",
  other: "Outra atividade",
};

export type ActivityPlan = {
  strengthDays: number[]; // 0 = domingo ... 6 = sábado
  calisthenicsDays: number[];
  walkMinutes: number;
  strengthMinutes: number;
  calisthenicsMinutes: number;
};

/** source: "manual" ou "apple_health". */
export type Session = { day: string; kind: ActivityKind; minutes: number; source?: string };

// Dias preferidos, na ordem da semana-modelo da especificação (seg, qua, sex...).
const STRENGTH_DAYS: Record<number, number[]> = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
const FREE_ORDER = [2, 4, 6, 1, 3, 5, 0]; // ter, qui, sáb primeiro; domingo por último

/** Plano inicial a partir da anamnese: musculação em dias não seguidos, calistenia nos outros. */
export function defaultPlan(p: {
  strengthSessions: number;
  calisthenicsSessions: number;
  walkMinutes: number;
  strengthMinutes: number;
  calisthenicsMinutes: number;
}): ActivityPlan {
  const strengthDays = STRENGTH_DAYS[Math.min(7, Math.max(0, p.strengthSessions))] ?? [];
  const free = FREE_ORDER.filter((d) => !strengthDays.includes(d));
  const calisthenicsDays = free.slice(0, Math.min(free.length, Math.max(0, p.calisthenicsSessions))).sort();
  return {
    strengthDays: [...strengthDays],
    calisthenicsDays,
    walkMinutes: p.walkMinutes,
    strengthMinutes: p.strengthMinutes,
    calisthenicsMinutes: p.calisthenicsMinutes,
  };
}

export type PlannedItem = { kind: ActivityKind; minutes: number };

export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** O que está planejado para um dia. */
export function plannedFor(plan: ActivityPlan, day: string): PlannedItem[] {
  const wd = weekdayOf(day);
  const items: PlannedItem[] = [];
  if (plan.walkMinutes > 0) items.push({ kind: "walk", minutes: plan.walkMinutes });
  if (plan.strengthDays.includes(wd)) items.push({ kind: "strength", minutes: plan.strengthMinutes });
  if (plan.calisthenicsDays.includes(wd)) items.push({ kind: "calisthenics", minutes: plan.calisthenicsMinutes });
  return items;
}

/** Minutos de caminhada estimados pelos passos: acima de 3.000, cerca de 100 passos por minuto. */
export function walkMinutesFromSteps(steps: number): number {
  return Math.max(0, Math.round((steps - 3000) / 100));
}

export type ItemProgress = PlannedItem & { done: number; ok: boolean; fromSteps: boolean };

/** Quanto de cada item do plano foi feito no dia. Vale como cumprido a partir de 80% do tempo. */
export function dayProgress(plan: ActivityPlan, day: string, sessions: Session[], steps: number) {
  const ofDay = sessions.filter((s) => s.day === day);
  // A mesma caminhada pode chegar à mão e pelo iPhone: vale o maior dos dois, não a soma.
  const minutesOf = (k: ActivityKind) => {
    const sum = (manual: boolean) =>
      ofDay.filter((s) => s.kind === k && (s.source === "apple_health") !== manual).reduce((a, s) => a + s.minutes, 0);
    return Math.max(sum(true), sum(false));
  };
  const items: ItemProgress[] = plannedFor(plan, day).map((it) => {
    const logged = minutesOf(it.kind);
    const estimated = it.kind === "walk" ? walkMinutesFromSteps(steps) : 0;
    const done = Math.max(logged, estimated);
    return { ...it, done, ok: done >= it.minutes * 0.8, fromSteps: estimated > logged };
  });
  const planned = items.reduce((a, i) => a + i.minutes, 0);
  // Cada item conta até o seu planejado: 3 h de caminhada não "pagam" a musculação.
  const done = items.reduce((a, i) => a + Math.min(i.done, i.minutes), 0);
  const extra = minutesOf("other");
  // Dia sem nada planejado é descanso: não conta nem a favor nem contra.
  const rest = items.length === 0;
  return { items, planned, done, extra, rest, ok: !rest && items.every((i) => i.ok) };
}

/** Constância: os últimos 7 dias, quantos cumpriram o plano e a sequência atual. */
export function activityStats(
  plan: ActivityPlan,
  today: string,
  sessions: Session[],
  stepsByDay: Map<string, number>,
  addDays: (d: string, n: number) => string,
) {
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, -(6 - i));
    const p = dayProgress(plan, day, sessions, stepsByDay.get(day) ?? 0);
    return { day, pct: p.planned ? p.done / p.planned : 0, ok: p.ok, rest: p.rest };
  });
  let streak = 0;
  // Hoje só entra na sequência depois de cumprido; até lá, conta de ontem para trás.
  // Dias de descanso são pulados: não quebram a sequência nem somam a ela.
  for (let i = last7[6].ok ? 0 : 1; i < 60; i++) {
    const day = addDays(today, -i);
    const p = dayProgress(plan, day, sessions, stepsByDay.get(day) ?? 0);
    if (p.rest) continue;
    if (!p.ok) break;
    streak++;
  }
  const planned7 = last7.filter((d) => !d.rest);
  // Minutos da semana sem contar em dobro o que veio à mão e pelo iPhone (por dia e tipo, vale o maior).
  const bySource = new Map<string, { manual: number; phone: number }>();
  for (const s of sessions) {
    if (s.day <= addDays(today, -7)) continue;
    const key = `${s.day}|${s.kind}`;
    const cur = bySource.get(key) ?? { manual: 0, phone: 0 };
    if (s.source === "apple_health") cur.phone += s.minutes;
    else cur.manual += s.minutes;
    bySource.set(key, cur);
  }
  const weekMinutes = [...bySource.values()].reduce((a, v) => a + Math.max(v.manual, v.phone), 0);
  return {
    last7,
    onPlan7: last7.filter((d) => d.ok).length,
    /** Dias da semana com algo planejado (os de descanso ficam de fora). */
    planned7: planned7.length,
    /** Média do quanto foi feito do plano, só nos dias com plano. */
    avgPct: planned7.length ? planned7.reduce((a, d) => a + Math.min(1, d.pct), 0) / planned7.length : 0,
    streak,
    weekMinutes,
  };
}
