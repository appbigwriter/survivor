import { describe, expect, it } from "vitest";
import { pickMatch, scale, total, type FoodRow } from "./nutrients";

const food = (over: Partial<FoodRow>): FoodRow => ({
  id: 1,
  source: "taco",
  name: "x",
  kcal_100g: 100,
  protein_100g: 0,
  fat_100g: 0,
  carbs_100g: 0,
  fiber_100g: 0,
  sodium_mg_100g: 0,
  score: 0.9,
  ...over,
});

const est = { kcal: 76, protein_g: 4.8, fat_g: 0.5, carbs_g: 13.6, fiber_g: 8.5, sodium_mg: 2 };

describe("scale e total", () => {
  it("calcula 150 g de arroz cozido da TACO", () => {
    const n = scale({ kcal: 128, protein_g: 2.5, fat_g: 0.2, carbs_g: 28.1, fiber_g: 1.6, sodium_mg: 1 }, 150);
    expect(n.kcal).toBe(192);
    expect(n.carbs_g).toBe(42.2);
    expect(total([n, n]).kcal).toBe(384);
  });
});

describe("pickMatch", () => {
  it("aceita correspondência com calorias próximas", () => {
    const m = pickMatch([food({ id: 7, kcal_100g: 76 })], est);
    expect(m?.id).toBe(7);
  });

  it("recusa feijão cru quando a estimativa é de cozido", () => {
    const m = pickMatch([food({ id: 8, kcal_100g: 329 }), food({ id: 9, kcal_100g: 80 })], est);
    expect(m?.id).toBe(9);
  });

  it("recusa correspondência com pontuação baixa", () => {
    expect(pickMatch([food({ score: 0.2 })], est)).toBeNull();
  });
});
