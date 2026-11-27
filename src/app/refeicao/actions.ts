"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiError, systemAnalyzer } from "@/lib/ai/providers";
import { nutrientsSchema, type Nutrients } from "@/lib/ai/meal-schema";
import { isMissingColumn } from "@/lib/accounts";
import { requireOnboarded } from "@/lib/auth";
import { addDays, dayRange, todayISO } from "@/lib/dates";
import { env } from "@/lib/env";
import { foodPer100g, pickMatch, scale, total, type FoodRow } from "@/lib/food/nutrients";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type FoodOption = {
  foodId: number | null;
  label: string;
  source: "taco" | "off" | "custom" | "estimated";
  per100g: Nutrients;
};

export type DraftItem = {
  key: string;
  name: string;
  preparation: string;
  confidence: "high" | "medium" | "low";
  grams: number;
  options: FoodOption[];
  selected: number;
};

export type AnalyzeState = { error?: string; items?: DraftItem[]; remaining?: number };

export async function analyzeMealText(_prev: AnalyzeState, formData: FormData): Promise<AnalyzeState> {
  const profile = await requireOnboarded();
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 3) return { error: "Descreva o que você comeu." };
  if (text.length > 1500) return { error: "Descrição longa demais. Divida em mais de uma refeição." };

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const limit = env.aiDailyLimit();
  let analyzer;
  try {
    analyzer = systemAnalyzer();
  } catch (error) {
    console.error("IA sem configuração:", error);
    return { error: "A análise por IA ainda não está configurada. Avise o administrador." };
  }

  // Reserva a vaga antes de chamar a IA e só depois conta: pedidos simultâneos
  // não conseguem passar todos do limite.
  const { data: slot, error: slotError } = await admin
    .from("ai_usage")
    .insert({
      user_id: profile.id,
      mode: "system",
      provider: analyzer.provider,
      model: analyzer.model,
      kind: "meal_text",
      ok: false,
    })
    .select("id")
    .single();
  if (slotError || !slot) return { error: "Não foi possível iniciar a análise. Tente de novo." };

  const { count } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("mode", "system")
    .gte("created_at", dayRange(todayISO()).from);
  const used = count ?? 0;
  if (used > limit) {
    await admin.from("ai_usage").delete().eq("id", slot.id);
    return { error: `Você chegou ao limite de ${limit} análises por IA hoje. Amanhã ele volta.` };
  }

  let result;
  try {
    result = await analyzer.analyze({ text });
  } catch (error) {
    // Falha do serviço (chave inválida, fora do ar) não gasta a cota da pessoa.
    await admin.from("ai_usage").delete().eq("id", slot.id);
    console.error("Falha na análise de IA:", error);
    return { error: error instanceof AiError ? error.message : "Erro inesperado na análise." };
  }

  await admin
    .from("ai_usage")
    .update({
      provider: result.provider,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      ok: true,
    })
    .eq("id", slot.id);

  if (result.analysis.items.length === 0) {
    return { error: "Não encontrei alimentos nessa descrição. Tente de novo com mais detalhes.", remaining: limit - used };
  }

  const items: DraftItem[] = await Promise.all(
    result.analysis.items.map(async (item, i) => {
      const { data } = await supabase.rpc("search_foods", { q: item.taco_name, max_results: 5 });
      const candidates = (data ?? []) as FoodRow[];
      const match = pickMatch(candidates, item.estimate_per_100g);

      const tableOptions: FoodOption[] = candidates.slice(0, 3).map((c) => ({
        foodId: c.id,
        label: `${c.name} (tabela ${c.source.toUpperCase()})`,
        source: c.source as FoodOption["source"],
        per100g: foodPer100g(c),
      }));
      const estimate: FoodOption = {
        foodId: null,
        label: "Estimativa da IA",
        source: "estimated",
        per100g: item.estimate_per_100g,
      };
      const options = [...tableOptions, estimate];
      const selected = match ? options.findIndex((o) => o.foodId === match.id) : options.length - 1;

      return {
        key: `${Date.now()}-${i}`,
        name: item.name,
        preparation: item.preparation,
        confidence: item.confidence,
        grams: Math.round(item.grams),
        options,
        selected,
      };
    }),
  );

  return { items, remaining: limit - used };
}

const saveSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "snack", "dinner", "supper"]),
  input_text: z.string().max(1500),
  day: z.enum(["today", "yesterday"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário da refeição."),
  starts_fast: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        preparation: z.string().max(80),
        grams: z.number().positive().max(3000),
        food_id: z.number().int().nullable(),
        per100g: nutrientsSchema,
      }),
    )
    .min(1, "Adicione pelo menos um alimento.")
    .max(25),
});

export type SaveMealInput = z.infer<typeof saveSchema>;

export async function saveMeal(input: SaveMealInput): Promise<{ error?: string }> {
  const profile = await requireOnboarded();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  // Horário de Brasília (UTC-3, sem horário de verão).
  const day = d.day === "today" ? todayISO() : addDays(todayISO(), -1);
  const eatenAt = new Date(`${day}T${d.time}:00-03:00`);
  if (eatenAt.getTime() > Date.now() + 5 * 60_000) return { error: "Esse horário ainda não chegou. Confira a hora da refeição." };
  const supabase = await createSupabaseServerClient();

  // Para itens da tabela, os valores vêm do banco, não do navegador.
  const foodIds = d.items.flatMap((i) => (i.food_id ? [i.food_id] : []));
  const foods = new Map<number, FoodRow>();
  if (foodIds.length) {
    const { data } = await supabase.from("foods").select("*").in("id", foodIds);
    for (const f of (data ?? []) as FoodRow[]) foods.set(f.id, f);
  }

  const rows = d.items.map((i) => {
    const food = i.food_id ? foods.get(i.food_id) : undefined;
    const per100g = food ? foodPer100g(food) : i.per100g;
    const n = scale(per100g, i.grams);
    return {
      user_id: profile.id,
      food_id: food?.id ?? null,
      name: i.name,
      preparation: i.preparation || null,
      grams: i.grams,
      kcal: n.kcal,
      protein_g: n.protein_g,
      fat_g: n.fat_g,
      carbs_g: n.carbs_g,
      fiber_g: n.fiber_g,
      sodium_mg: n.sodium_mg,
      value_source: food ? (food.source === "off" ? "off" : "taco") : "estimated",
    };
  });

  const t = total(rows.map((r) => ({ kcal: r.kcal, protein_g: r.protein_g, fat_g: r.fat_g, carbs_g: r.carbs_g, fiber_g: r.fiber_g, sodium_mg: r.sodium_mg })));

  const mealRow = {
    user_id: profile.id,
    meal_type: d.meal_type,
    input_mode: "text",
    input_text: d.input_text || null,
    eaten_at: eatenAt.toISOString(),
    ...t,
  };
  let { data: meal, error } = await supabase
    .from("meals")
    .insert({ ...mealRow, starts_fast: d.starts_fast })
    .select("id")
    .single();
  // Sem a migração 0006, salva a refeição sem a marca de última do dia.
  if (error && isMissingColumn(error)) ({ data: meal, error } = await supabase.from("meals").insert(mealRow).select("id").single());
  if (error || !meal) return { error: "Não foi possível salvar a refeição." };

  const { error: itemsError } = await supabase
    .from("meal_items")
    .insert(rows.map((r) => ({ ...r, meal_id: meal.id })));
  if (itemsError) {
    await supabase.from("meals").delete().eq("id", meal.id);
    return { error: "Não foi possível salvar os itens da refeição." };
  }

  revalidatePath("/hoje");
  redirect("/hoje");
}

export async function deleteMeal(formData: FormData) {
  await requireOnboarded();
  const id = String(formData.get("id") ?? "");
  const supabase = await createSupabaseServerClient();
  await supabase.from("meals").delete().eq("id", id);
  revalidatePath("/hoje");
  redirect("/hoje");
}
