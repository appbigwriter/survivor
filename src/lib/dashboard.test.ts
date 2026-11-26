import { describe, expect, it } from "vitest";
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
} from "./dashboard";

describe("pesos", () => {
  it("fica com o último peso de cada dia", () => {
    const r = dailyWeights([
      { day: "2026-11-01", kg: 115, at: "2026-11-01T10:00:00Z" },
      { day: "2026-11-01", kg: 114.5, at: "2026-11-01T20:00:00Z" },
      { day: "2026-10-31", kg: 116, at: "2026-10-31T10:00:00Z" },
    ]);
    expect(r).toEqual([
      { day: "2026-10-31", kg: 116 },
      { day: "2026-11-01", kg: 114.5 },
    ]);
  });

  it("média móvel usa só os 7 dias anteriores", () => {
    const pts = [
      { day: "2026-11-01", kg: 100 },
      { day: "2026-11-05", kg: 98 },
      { day: "2026-11-10", kg: 96 },
    ];
    const avg = movingAverage(pts);
    expect(avg[1].kg).toBe(99);
    expect(avg[2].kg).toBe(97); // 11-01 já saiu da janela
  });

  it("tendência e previsão de data", () => {
    const pts = Array.from({ length: 15 }, (_, i) => ({
      day: `2026-11-${String(i + 1).padStart(2, "0")}`,
      kg: 114 - i * 0.1, // 0,7 kg por semana
    }));
    const trend = weeklyTrend(pts)!;
    expect(trend).toBeCloseTo(-0.7, 1);
    const date = projectGoalDate(112.6, 98, trend, "2026-11-15");
    expect(date).not.toBeNull();
    expect(date! > "2027-02-01" && date! < "2027-05-01").toBe(true);
  });

  it("não promete data com poucos dados ou tendência contrária", () => {
    expect(weeklyTrend([{ day: "2026-11-01", kg: 100 }])).toBeNull();
    expect(projectGoalDate(110, 98, 0.5, "2026-11-15")).toBeNull();
    expect(projectGoalDate(110, 98, -0.05, "2026-11-15")).toBeNull();
  });
});

describe("constância", () => {
  const goal = { kcal: 2000, protein_g: 150 };
  it("nota do dia", () => {
    expect(scoreDay({ meals: 0, kcal: 0, protein: 0 }, goal)).toBe(0);
    expect(scoreDay({ meals: 2, kcal: 1200, protein: 60 }, goal)).toBe(1);
    expect(scoreDay({ meals: 3, kcal: 2100, protein: 140 }, goal)).toBe(3);
  });

  const days = (levels: number[]): DayScore[] =>
    levels.map((level, i) => ({ day: `2026-11-${String(20 - i).padStart(2, "0")}`, level: level as DayScore["level"] }));

  it("perdoa um esquecimento, mas não dois seguidos", () => {
    // hoje = 20 (sem registro ainda), 19 e 18 com registro, 17 sem, 16 e 15 com, 14 e 13 sem
    expect(streak(days([0, 1, 2, 0, 1, 1, 0, 0]), "2026-11-20")).toBe(4);
    expect(streak(days([1, 1, 1]), "2026-11-20")).toBe(3);
    expect(streak(days([0, 0, 0, 1]), "2026-11-20")).toBe(0);
  });

  it("de manhã, ontem esquecido não zera a sequência", () => {
    // hoje sem registro ainda, ontem esquecido, 18 dias seguidos antes disso
    expect(streak(days([0, 0, ...Array(18).fill(1)]), "2026-11-20")).toBe(18);
  });
});

describe("sugestões", () => {
  it("meta de passos pela caminhada", () => {
    expect(suggestedSteps(60)).toBe(9000);
    expect(suggestedSteps(null)).toBe(6000);
    expect(suggestedSteps(200)).toBe(12000);
  });

  it("lembra da proteína à tarde", () => {
    const h = nextHint({ hour: 15, meals: 2, kcal: 900, protein: 40, steps: 8000, goal: { kcal: 2200, protein_g: 160 }, stepGoal: 9000 });
    expect(h?.text).toContain("120 g de proteína");
  });
});
