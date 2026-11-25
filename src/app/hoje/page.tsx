import Link from "next/link";
import { BottomNav, Card, LinkButton, Notice, Page, Progress } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { getCurrentGoal, isCautious } from "@/lib/data";
import { addDays, dayRange, formatDay, formatTime, MEAL_TYPE_LABEL, todayISO } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BloodPressureForm, StepsForm, SymptomForm, WeightForm } from "./log-forms";

type MealRow = {
  id: string;
  eaten_at: string;
  meal_type: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  meal_items: { name: string }[];
};

const sum = (rows: MealRow[], key: keyof MealRow) =>
  rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

export default async function TodayPage() {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const today = todayISO();
  const { from, to } = dayRange(today);
  const threeDaysAgo = dayRange(addDays(today, -3)).from;

  const [goal, cautious, mealsRes, stepsRes, weightsRes, recentMealsRes, dizzyRes] = await Promise.all([
    getCurrentGoal(),
    isCautious(),
    supabase
      .from("meals")
      .select("id, eaten_at, meal_type, kcal, protein_g, fat_g, carbs_g, fiber_g, meal_items(name)")
      .gte("eaten_at", from)
      .lt("eaten_at", to)
      .order("eaten_at"),
    supabase.from("step_logs").select("steps, source").eq("day", today),
    supabase
      .from("weight_logs")
      .select("weight_kg, measured_at")
      .gte("measured_at", dayRange(addDays(today, -13)).from)
      .order("measured_at", { ascending: false }),
    supabase.from("meals").select("eaten_at, kcal").gte("eaten_at", threeDaysAgo).lt("eaten_at", from),
    supabase
      .from("symptom_logs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "dizziness")
      .gte("logged_at", dayRange(addDays(today, -7)).from),
  ]);

  const meals = (mealsRes.data ?? []) as MealRow[];
  const kcal = sum(meals, "kcal");
  const steps = Math.max(0, ...(stepsRes.data ?? []).map((s) => s.steps));
  const manualSteps = (stepsRes.data ?? []).find((s) => s.source === "manual")?.steps ?? null;

  const weights = weightsRes.data ?? [];
  const lastWeight = weights[0]?.weight_kg ?? null;
  const last7 = weights.filter((w) => w.measured_at >= dayRange(addDays(today, -6)).from);
  const avg7 = last7.length ? last7.reduce((a, w) => a + Number(w.weight_kg), 0) / last7.length : null;

  // Alerta: menos de 1.500 kcal registradas em cada um dos 3 dias anteriores.
  const byDay = new Map<string, number>();
  for (const m of recentMealsRes.data ?? []) {
    const d = todayISO(new Date(m.eaten_at));
    byDay.set(d, (byDay.get(d) ?? 0) + Number(m.kcal));
  }
  const lowIntakeDays = [1, 2, 3].filter((i) => {
    const v = byDay.get(addDays(today, -i));
    return v !== undefined && v < 1500;
  }).length;

  const remaining = goal ? goal.kcal - kcal : null;

  return (
    <Page title="Hoje">
      <p className="-mt-4 mb-4 capitalize text-muted">{formatDay(today)}</p>

      {lowIntakeDays === 3 && (
        <Notice>
          Nos últimos 3 dias você registrou menos de 1.500 kcal por dia. Comer pouco demais faz
          perder músculo e pode causar tontura. Se foi esquecimento de registrar, tudo bem; se não,
          tente chegar mais perto da sua meta.
        </Notice>
      )}
      {(dizzyRes.count ?? 0) >= 2 && (
        <Notice>
          Você registrou tontura mais de uma vez nesta semana. Meça a pressão e fale com seu médico.
        </Notice>
      )}

      {goal && (
        <Card>
          <p className="text-muted">Calorias restantes</p>
          <p className="mb-4 text-4xl font-bold">
            {remaining !== null && remaining >= 0
              ? `${Math.round(remaining).toLocaleString("pt-BR")} kcal`
              : `${Math.round(-(remaining ?? 0)).toLocaleString("pt-BR")} kcal acima`}
          </p>
          <Progress label="Calorias" value={kcal} target={goal.kcal} unit="kcal" />
          <Progress label="Proteína" value={sum(meals, "protein_g")} target={goal.protein_g} unit="g" />
          <Progress label="Carboidrato" value={sum(meals, "carbs_g")} target={goal.carbs_g} unit="g" />
          <Progress label="Gordura" value={sum(meals, "fat_g")} target={goal.fat_g} unit="g" />
          <Progress label="Fibra" value={sum(meals, "fiber_g")} target={goal.fiber_g} unit="g" />
          <p className="mt-2 text-sm text-muted">
            <Link href="/metas" className="underline">Ver minhas metas e avisos</Link>
          </p>
        </Card>
      )}

      <Card title="Refeições">
        {meals.length === 0 ? (
          <p className="mb-3 text-muted">Nenhuma refeição registrada hoje.</p>
        ) : (
          <ul className="mb-3 divide-y divide-border">
            {meals.map((m) => (
              <li key={m.id} className="py-2">
                <Link href={`/refeicao/${m.id}`} className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium">{MEAL_TYPE_LABEL[m.meal_type]}</span>{" "}
                    <span className="text-muted">{formatTime(m.eaten_at)}</span>
                    <span className="block text-sm text-muted">
                      {m.meal_items.map((i) => i.name).join(", ")}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">{Math.round(m.kcal)} kcal</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <LinkButton href="/refeicao/nova">Registrar refeição</LinkButton>
      </Card>

      <Card title="Passos">
        <p className="mb-3 text-3xl font-bold">{steps.toLocaleString("pt-BR")}</p>
        <StepsForm current={manualSteps} />
      </Card>

      <Card title="Peso">
        <p className="mb-1">
          Último: <strong>{lastWeight ? `${Number(lastWeight).toLocaleString("pt-BR")} kg` : "—"}</strong>
        </p>
        {avg7 && (
          <p className="mb-3 text-muted">
            Média dos últimos 7 dias: {avg7.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
          </p>
        )}
        <WeightForm />
      </Card>

      {cautious && (
        <>
          <Card title="Pressão arterial">
            <BloodPressureForm />
          </Card>
          <Card title="Sentiu algo?">
            <SymptomForm />
          </Card>
        </>
      )}

      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
