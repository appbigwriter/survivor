import { notFound } from "next/navigation";
import { Button, Card, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { formatDateTime, MEAL_TYPE_LABEL } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteMeal } from "../actions";

const SOURCE_LABEL: Record<string, string> = {
  taco: "TACO",
  off: "Open Food Facts",
  estimated: "estimativa da IA",
  manual: "manual",
};

export default async function MealPage({ params }: PageProps<"/refeicao/[id]">) {
  await requireOnboarded();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: meal } = await supabase
    .from("meals")
    .select("*, meal_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (!meal) notFound();

  type Item = { id: string; name: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; value_source: string };

  return (
    <Page title={MEAL_TYPE_LABEL[meal.meal_type]} back="/hoje">
      <p className="-mt-4 mb-4 text-muted">{formatDateTime(meal.eaten_at)}</p>
      {meal.input_text && (
        <Card title="Você escreveu">
          <p>{meal.input_text}</p>
        </Card>
      )}
      <Card title="Itens">
        <ul className="divide-y divide-border">
          {(meal.meal_items as Item[]).map((i) => (
            <li key={i.id} className="py-2">
              <p className="font-medium">
                {i.name} <span className="text-muted">· {Number(i.grams)} g</span>
              </p>
              <p className="text-sm text-muted">
                {Math.round(i.kcal)} kcal · {i.protein_g} g proteína · {i.carbs_g} g carboidrato · {i.fat_g} g gordura · {i.fiber_g} g fibra · {SOURCE_LABEL[i.value_source]}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-lg font-bold">Total: {Math.round(meal.kcal)} kcal</p>
      </Card>
      <form action={deleteMeal}>
        <input type="hidden" name="id" value={meal.id} />
        <Button type="submit" variant="danger" className="w-full">Apagar esta refeição</Button>
      </form>
    </Page>
  );
}
