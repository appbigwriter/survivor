import type { Nutrients } from "@/lib/ai/meal-schema";

export type FoodRow = {
  id: number;
  source: string;
  name: string;
  kcal_100g: number;
  protein_100g: number;
  fat_100g: number;
  carbs_100g: number;
  fiber_100g: number;
  sodium_mg_100g: number;
  score?: number;
};

export function foodPer100g(f: FoodRow): Nutrients {
  return {
    kcal: Number(f.kcal_100g),
    protein_g: Number(f.protein_100g),
    fat_g: Number(f.fat_100g),
    carbs_g: Number(f.carbs_100g),
    fiber_g: Number(f.fiber_100g),
    sodium_mg: Number(f.sodium_mg_100g),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function scale(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: r1(per100g.kcal * f),
    protein_g: r1(per100g.protein_g * f),
    fat_g: r1(per100g.fat_g * f),
    carbs_g: r1(per100g.carbs_g * f),
    fiber_g: r1(per100g.fiber_g * f),
    sodium_mg: r1(per100g.sodium_mg * f),
  };
}

export function total(items: Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (acc, n) => ({
      kcal: r1(acc.kcal + n.kcal),
      protein_g: r1(acc.protein_g + n.protein_g),
      fat_g: r1(acc.fat_g + n.fat_g),
      carbs_g: r1(acc.carbs_g + n.carbs_g),
      fiber_g: r1(acc.fiber_g + n.fiber_g),
      sodium_mg: r1(acc.sodium_mg + n.sodium_mg),
    }),
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sodium_mg: 0 },
  );
}

export const MIN_MATCH_SCORE = 0.35;

/**
 * Escolhe o alimento da tabela que corresponde ao item da IA. Descarta a
 * correspondência quando as calorias são muito diferentes da estimativa, o que
 * costuma indicar preparo errado (feijão cru × cozido, por exemplo).
 */
export function pickMatch(candidates: FoodRow[], estimate: Nutrients): FoodRow | null {
  for (const c of candidates) {
    if ((c.score ?? 0) < MIN_MATCH_SCORE) continue;
    const kcal = Number(c.kcal_100g);
    const ratio = estimate.kcal > 0 ? kcal / estimate.kcal : 1;
    const farApart = (ratio > 2.5 || ratio < 0.4) && Math.abs(kcal - estimate.kcal) > 80;
    if (!farApart) return c;
  }
  return null;
}
