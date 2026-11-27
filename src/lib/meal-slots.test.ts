import { describe, expect, it } from "vitest";
import { mealSlots } from "./meal-slots";

const meal = (id: string, meal_type: string, kcal: number) => ({ id, eaten_at: "2026-11-26T11:00:00Z", meal_type, kcal, items: [] });

describe("refeições por horário", () => {
  it("mostra os quatro horários mesmo vazios, sem a ceia", () => {
    const s = mealSlots([], 1700);
    expect(s.map((x) => x.type)).toEqual(["breakfast", "lunch", "snack", "dinner"]);
    expect(s.map((x) => x.target)).toEqual([430, 600, 170, 510]);
  });

  it("soma várias refeições do mesmo horário e inclui a ceia registrada", () => {
    const s = mealSlots([meal("a", "snack", 100), meal("b", "snack", 150), meal("c", "supper", 90)], 1700);
    expect(s.find((x) => x.type === "snack")!.kcal).toBe(250);
    expect(s.find((x) => x.type === "supper")!.target).toBeNull();
  });

  it("tipo desconhecido entra no lanche, sem sumir", () => {
    expect(mealSlots([meal("x", "outro", 80)], 1700).find((x) => x.type === "snack")!.meals).toHaveLength(1);
  });

  it("à noite a ceia aparece mesmo vazia", () => {
    expect(mealSlots([], 1700, true).map((x) => x.type)).toContain("supper");
  });

  it("sem meta, não inventa alvo", () => {
    expect(mealSlots([], null).every((x) => x.target === null)).toBe(true);
  });
});
