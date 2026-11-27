"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActivityState = { error?: string; ok?: string };

const revalidate = () => {
  revalidatePath("/hoje");
  revalidatePath("/atividade");
  revalidatePath("/historico");
};

const days = z
  .array(z.coerce.number().int().min(0).max(6))
  .max(7)
  .transform((d) => [...new Set(d)].sort());

export async function savePlan(_prev: ActivityState, formData: FormData): Promise<ActivityState> {
  const profile = await requireOnboarded();
  const parsed = z
    .object({
      strength_days: days,
      calisthenics_days: days,
      walk_minutes: z.coerce.number({ error: "Minutos de caminhada inválidos." }).int().min(0, "Minutos de caminhada inválidos.").max(180, "No máximo 180 minutos de caminhada."),
    })
    .safeParse({
      strength_days: formData.getAll("strength_days"),
      calisthenics_days: formData.getAll("calisthenics_days"),
      walk_minutes: formData.get("walk_minutes"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.strength_days.some((x) => d.calisthenics_days.includes(x)))
    return { error: "Musculação e calistenia no mesmo dia pesam demais. Escolha dias diferentes." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("activity_plans").upsert({
    user_id: profile.id,
    strength_days: d.strength_days,
    calisthenics_days: d.calisthenics_days,
    walk_minutes: d.walk_minutes,
  });
  if (error) return { error: "Não foi possível salvar o plano. Tente de novo." };
  revalidate();
  return { ok: "Plano salvo." };
}

export async function logActivity(_prev: ActivityState, formData: FormData): Promise<ActivityState> {
  const profile = await requireOnboarded();
  const today = todayISO();
  const parsed = z
    .object({
      kind: z.enum(["walk", "strength", "calisthenics", "other"], { error: "Escolha o tipo de atividade." }),
      minutes: z.coerce.number({ error: "Informe os minutos." }).int().min(1, "Informe os minutos.").max(600, "No máximo 600 minutos."),
      effort: z.union([z.literal(""), z.coerce.number().int().min(1).max(10)]).optional(),
      notes: z.string().max(500, "Anotação longa demais.").optional(),
      when: z.enum(["today", "yesterday"]).default("today"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("activity_sessions").insert({
    user_id: profile.id,
    day: d.when === "yesterday" ? addDays(today, -1) : today,
    kind: d.kind,
    minutes: d.minutes,
    effort: d.effort === "" || d.effort === undefined ? null : d.effort,
    notes: d.notes?.trim() || null,
    source: "manual",
  });
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  revalidate();
  return { ok: "Atividade registrada." };
}

export async function deleteActivity(formData: FormData): Promise<void> {
  await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  // A política de RLS garante que só apaga a própria sessão; as do iPhone voltariam no próximo envio.
  await supabase.from("activity_sessions").delete().eq("id", id.data).eq("source", "manual");
  revalidate();
}
