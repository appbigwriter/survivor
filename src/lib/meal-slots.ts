// Refeições do dia agrupadas por horário, cada uma com uma parte da meta de calorias.
// A divisão é só uma referência para orientar o dia; o que conta é o total.

export const MEAL_SHARE: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.1,
  dinner: 0.3,
};

export const SLOT_ORDER = ["breakfast", "lunch", "snack", "dinner", "supper"] as const;

export type SlotMeal = { id: string; eaten_at: string; meal_type: string; kcal: number; items: string[] };

export type MealSlot = {
  type: string;
  meals: SlotMeal[];
  kcal: number;
  /** Parte da meta para este horário; null para a ceia, que não tem meta própria. */
  target: number | null;
};

/** Os quatro horários principais sempre aparecem; a ceia, se houver registro ou se já for noite. */
export function mealSlots(meals: SlotMeal[], kcalGoal: number | null, showSupper = false): MealSlot[] {
  return SLOT_ORDER.flatMap((type) => {
    const list = meals.filter((m) => (SLOT_ORDER as readonly string[]).includes(m.meal_type) ? m.meal_type === type : type === "snack");
    if (type === "supper" && list.length === 0 && !showSupper) return [];
    const share = MEAL_SHARE[type];
    return [
      {
        type,
        meals: list,
        kcal: list.reduce((a, m) => a + Number(m.kcal || 0), 0),
        target: kcalGoal && share ? Math.round((kcalGoal * share) / 10) * 10 : null,
      },
    ];
  });
}
