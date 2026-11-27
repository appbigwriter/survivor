import { describe, expect, it } from "vitest";
import { activityStats, dayProgress, defaultPlan, plannedFor, walkMinutesFromSteps, type Session } from "./activity";
import { addDays } from "./dates";

const base = { strengthSessions: 3, calisthenicsSessions: 3, walkMinutes: 60, strengthMinutes: 60, calisthenicsMinutes: 30 };

describe("plano de atividade", () => {
  it("segue a semana-modelo: musculação seg/qua/sex e calistenia ter/qui/sáb", () => {
    const p = defaultPlan(base);
    expect(p.strengthDays).toEqual([1, 3, 5]);
    expect(p.calisthenicsDays).toEqual([2, 4, 6]);
  });

  it("sem treino, só caminhada", () => {
    const p = defaultPlan({ ...base, strengthSessions: 0, calisthenicsSessions: 0 });
    // 2026-11-23 é segunda-feira.
    expect(plannedFor(p, "2026-11-23")).toEqual([{ kind: "walk", minutes: 60 }]);
  });

  it("passos viram minutos de caminhada acima de 3.000", () => {
    expect(walkMinutesFromSteps(2500)).toBe(0);
    expect(walkMinutesFromSteps(9000)).toBe(60);
  });

  it("dia cumprido a partir de 80% de cada item, sem um item pagar o outro", () => {
    const p = defaultPlan(base);
    const monday = "2026-11-23";
    const s: Session[] = [{ day: monday, kind: "walk", minutes: 180 }];
    const half = dayProgress(p, monday, s, 0);
    expect(half.ok).toBe(false);
    expect(half.done).toBe(60); // a caminhada conta só até os 60 planejados
    const full = dayProgress(p, monday, [...s, { day: monday, kind: "strength", minutes: 50 }], 0);
    expect(full.ok).toBe(true);
    const bySteps = dayProgress(p, monday, [{ day: monday, kind: "strength", minutes: 60 }], 8000);
    expect(bySteps.items[0].fromSteps).toBe(true);
    expect(bySteps.ok).toBe(true);
  });

  it("conta a semana e a sequência", () => {
    const p = defaultPlan({ ...base, strengthSessions: 0, calisthenicsSessions: 0, walkMinutes: 30 });
    const steps = new Map([
      ["2026-11-24", 7000],
      ["2026-11-25", 6500],
      ["2026-11-26", 1000],
    ]);
    const st = activityStats(p, "2026-11-26", [], steps, addDays);
    expect(st.onPlan7).toBe(2);
    expect(st.streak).toBe(2); // hoje ainda não cumprido: conta de ontem
  });

  it("caminhada à mão e pelo iPhone não somam em dobro", () => {
    const p = defaultPlan({ ...base, strengthSessions: 0, calisthenicsSessions: 0, walkMinutes: 60 });
    const d = "2026-11-23";
    const s: Session[] = [
      { day: d, kind: "walk", minutes: 30, source: "manual" },
      { day: d, kind: "walk", minutes: 32, source: "apple_health" },
    ];
    expect(dayProgress(p, d, s, 0).items[0].done).toBe(32);
    expect(activityStats(p, "2026-11-26", s, new Map(), addDays).weekMinutes).toBe(32);
  });

  it("dia de descanso não quebra a sequência nem conta contra", () => {
    // Só calistenia na segunda (23) e na terça (24); sem caminhada: o resto é descanso.
    const p = { ...defaultPlan({ ...base, strengthSessions: 0, calisthenicsSessions: 0, walkMinutes: 0 }), calisthenicsDays: [1, 2] };
    const s: Session[] = [
      { day: "2026-11-23", kind: "calisthenics", minutes: 30 },
      { day: "2026-11-24", kind: "calisthenics", minutes: 30 },
    ];
    const st = activityStats(p, "2026-11-26", s, new Map(), addDays);
    expect(st.planned7).toBe(2);
    expect(st.onPlan7).toBe(2);
    expect(st.streak).toBe(2);
    expect(st.avgPct).toBe(1);
  });
});

