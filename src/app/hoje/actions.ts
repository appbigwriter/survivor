"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogState = { error?: string; ok?: string };

const decimal = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(",", ".") : v),
    z.coerce.number({ error: msg }).min(min, msg).max(max, msg),
  );

export async function logWeight(_prev: LogState, formData: FormData): Promise<LogState> {
  const profile = await requireOnboarded();
  const parsed = z
    .object({ weight_kg: decimal(30, 300, "Peso deve estar entre 30 e 300 kg.") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("weight_logs")
    .insert({ user_id: profile.id, weight_kg: parsed.data.weight_kg, source: "manual" });
  if (error) return { error: "Não foi possível salvar o peso." };
  revalidatePath("/hoje");
  return { ok: "Peso registrado." };
}

export async function logSteps(_prev: LogState, formData: FormData): Promise<LogState> {
  const profile = await requireOnboarded();
  const parsed = z
    .object({ steps: z.coerce.number().int().min(0, "Passos inválidos.").max(200000, "Passos inválidos.") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("step_logs").upsert({
    user_id: profile.id,
    day: todayISO(),
    source: "manual",
    steps: parsed.data.steps,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Não foi possível salvar os passos." };
  revalidatePath("/hoje");
  return { ok: "Passos registrados." };
}

export async function logBloodPressure(_prev: LogState, formData: FormData): Promise<LogState> {
  const profile = await requireOnboarded();
  const parsed = z
    .object({
      systolic: z.coerce.number().int().min(60, "Pressão máxima inválida.").max(260, "Pressão máxima inválida."),
      diastolic: z.coerce.number().int().min(30, "Pressão mínima inválida.").max(160, "Pressão mínima inválida."),
      pulse: z.union([z.literal(""), z.coerce.number().int().min(30).max(220)]).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { systolic, diastolic, pulse } = parsed.data;
  if (diastolic >= systolic) return { error: "A pressão mínima precisa ser menor que a máxima." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("bp_logs").insert({
    user_id: profile.id,
    systolic,
    diastolic,
    pulse: pulse === "" || pulse === undefined ? null : pulse,
  });
  if (error) return { error: "Não foi possível salvar a pressão." };
  revalidatePath("/hoje");

  if (systolic >= 160 || diastolic >= 100) {
    return { ok: "Pressão registrada. Ela está alta: se continuar assim, fale com seu médico." };
  }
  if (systolic < 100 || diastolic < 60) {
    return { ok: "Pressão registrada. Ela está baixa: se você sentir tontura, fale com seu médico." };
  }
  return { ok: "Pressão registrada." };
}

const SYMPTOMS = ["dizziness", "fatigue", "nausea", "headache", "pain", "other"] as const;

export async function logSymptom(_prev: LogState, formData: FormData): Promise<LogState> {
  const profile = await requireOnboarded();
  const parsed = z
    .object({ kind: z.enum(SYMPTOMS, { error: "Escolha o sintoma." }), note: z.string().max(500).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("symptom_logs")
    .insert({ user_id: profile.id, kind: parsed.data.kind, note: parsed.data.note || null });
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/hoje");
  if (parsed.data.kind === "dizziness") {
    return {
      ok: "Registrado. Sente-se, beba um pouco de água e meça a pressão. Se a tontura se repetir, fale com seu médico.",
    };
  }
  return { ok: "Registrado." };
}
