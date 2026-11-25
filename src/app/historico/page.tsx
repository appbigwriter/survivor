import { BottomNav, Card, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { getCurrentGoal } from "@/lib/data";
import { addDays, dayRange, formatDay, todayISO } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DAYS = 14;

export default async function HistoryPage() {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const today = todayISO();
  const from = dayRange(addDays(today, -(DAYS - 1))).from;

  const [goal, mealsRes, stepsRes, weightsRes] = await Promise.all([
    getCurrentGoal(),
    supabase.from("meals").select("eaten_at, kcal, protein_g").gte("eaten_at", from),
    supabase.from("step_logs").select("day, steps").gte("day", addDays(today, -(DAYS - 1))),
    supabase.from("weight_logs").select("measured_at, weight_kg").gte("measured_at", from).order("measured_at"),
  ]);

  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, -i));
  const agg = new Map(days.map((d) => [d, { kcal: 0, protein: 0, steps: 0, weight: null as number | null, meals: 0 }]));
  for (const m of mealsRes.data ?? []) {
    const a = agg.get(todayISO(new Date(m.eaten_at)));
    if (a) {
      a.kcal += Number(m.kcal);
      a.protein += Number(m.protein_g);
      a.meals++;
    }
  }
  for (const s of stepsRes.data ?? []) {
    const a = agg.get(s.day);
    if (a) a.steps = Math.max(a.steps, s.steps);
  }
  for (const w of weightsRes.data ?? []) {
    const a = agg.get(todayISO(new Date(w.measured_at)));
    if (a) a.weight = Number(w.weight_kg);
  }

  const withMeals = days.filter((d) => agg.get(d)!.meals > 0);
  const inTarget = goal
    ? withMeals.filter((d) => Math.abs(agg.get(d)!.kcal - goal.kcal) <= goal.kcal * 0.1).length
    : 0;

  return (
    <Page title="Últimos 14 dias">
      {goal && withMeals.length > 0 && (
        <Card>
          <p>
            Dias com refeições registradas: <strong>{withMeals.length}</strong> de {DAYS}.
          </p>
          <p>
            Dias dentro da meta de calorias (±10%): <strong>{inTarget}</strong>.
          </p>
        </Card>
      )}
      <Card>
        <ul className="divide-y divide-border">
          {days.map((d) => {
            const a = agg.get(d)!;
            return (
              <li key={d} className="py-3">
                <p className="font-medium capitalize">{formatDay(d)}</p>
                <p className="text-sm text-muted">
                  {a.meals ? `${Math.round(a.kcal).toLocaleString("pt-BR")} kcal · ${Math.round(a.protein)} g proteína` : "sem refeições"}
                  {" · "}
                  {a.steps.toLocaleString("pt-BR")} passos
                  {a.weight ? ` · ${a.weight.toLocaleString("pt-BR")} kg` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
