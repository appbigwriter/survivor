import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { dateAllowed, healthPayload, summary, workoutKind } from "./health-sync";

describe("dados do iPhone", () => {
  it("entende números no formato brasileiro", () => {
    const p = healthPayload.parse({ date: "2026-11-26", steps: "5.234", distance_km: "3,8", weight_kg: "101,4", active_kcal: "1.210" });
    expect(p.steps).toBe(5234);
    expect(p.distance_km).toBe(3.8);
    expect(p.weight_kg).toBe(101.4);
    expect(p.active_kcal).toBe(1210);
    expect(healthPayload.parse({ date: "2026-11-26", weight_kg: "101.4" }).weight_kg).toBe(101.4);
  });

  it("decimais com vírgula não viram números 100 vezes maiores, e vazio não zera", () => {
    const p = healthPayload.parse({ date: "2026-11-26", active_kcal: "412,37", distance_km: "", steps: "" });
    expect(p.active_kcal).toBe(412);
    expect(p.distance_km).toBeUndefined();
    expect(p.steps).toBeUndefined();
    expect(healthPayload.safeParse({ date: "2026-11-26", steps: "-5" }).success).toBe(false);
  });

  it("data e hora precisam de fuso", () => {
    expect(healthPayload.safeParse({ date: "2026-11-26", weight_at: "2026-11-26T07:00:00" }).success).toBe(false);
    expect(healthPayload.safeParse({ date: "2026-11-26", weight_at: "2026-11-26T07:00:00-03:00" }).success).toBe(true);
  });

  it("recusa valores fora do razoável", () => {
    expect(healthPayload.safeParse({ date: "2026-11-26", weight_kg: "12" }).success).toBe(false);
    expect(healthPayload.safeParse({ date: "26/11/2026" }).success).toBe(false);
  });

  it("traduz os tipos de treino", () => {
    expect(workoutKind("Caminhada")).toBe("walk");
    expect(workoutKind("Traditional Strength Training")).toBe("strength");
    expect(workoutKind("Treinamento de Força Tradicional")).toBe("strength");
    expect(workoutKind("Treino de Core")).toBe("calisthenics");
    expect(workoutKind("Natação")).toBe("other");
  });

  it("aceita só a última semana", () => {
    expect(dateAllowed("2026-11-26", "2026-11-26", addDays)).toBe(true);
    expect(dateAllowed("2026-11-27", "2026-11-26", addDays)).toBe(false);
    expect(dateAllowed("2026-11-10", "2026-11-26", addDays)).toBe(false);
  });

  it("resume o que chegou", () => {
    expect(summary({ steps: 5234 })).toBe("Survivor recebeu: 5.234 passos.");
    expect(summary({}, ["peso sem data"])).toBe("Survivor: nada novo para salvar. Ignorado: peso sem data.");
  });
});
