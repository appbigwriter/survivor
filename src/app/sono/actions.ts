"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import { AWAKE_OPTIONS, LATENCY_OPTIONS, nightTimes, scoreStopBang, STOP_BANG } from "@/lib/sleep";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SleepState = { error?: string; ok?: string; saved?: number };

const latencyValues = LATENCY_OPTIONS.map((o) => o.value) as number[];
const awakeValues = AWAKE_OPTIONS.map((o) => o.value) as number[];

const sleepSchema = z.object({
  night: z.enum(["today", "yesterday"]),
  bed: z.string(),
  wake: z.string(),
  latency: z.coerce.number().refine((v) => latencyValues.includes(v), "Escolha quanto tempo demorou para dormir."),
  awake: z.coerce.number().refine((v) => awakeValues.includes(v), "Escolha quanto tempo ficou acordado."),
  quality: z.coerce.number({ error: "Diga como acordou." }).int().min(1, "Diga como acordou.").max(5),
});

export async function logSleep(_prev: SleepState, formData: FormData): Promise<SleepState> {
  const profile = await requireOnboarded();
  const parsed = sleepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const today = todayISO();
  const night = d.night === "today" ? today : addDays(today, -1);
  const times = nightTimes(night, d.bed, d.wake);
  if ("error" in times) return { error: times.error };
  if (Date.parse(times.wakeTime) > Date.now() + 5 * 60_000) {
    return { error: "A hora de acordar ainda não chegou. Confira o horário." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("sleep_logs").upsert(
    {
      user_id: profile.id,
      night,
      bedtime: times.bedtime,
      wake_time: times.wakeTime,
      latency_min: d.latency,
      awake_min: d.awake,
      quality: d.quality,
      source: "manual",
    },
    { onConflict: "user_id,night,source" },
  );
  if (error) {
    console.error("Falha ao salvar sono:", error);
    return { error: "Não foi possível salvar o sono. Tente de novo." };
  }
  // A noite foi registrada: o "Iniciar sono" em aberto, se houver, termina aqui.
  await supabase.from("sleep_starts").delete().eq("user_id", profile.id);
  revalidatePath("/hoje");
  revalidatePath("/historico");
  return { ok: "Noite registrada.", saved: Date.now() };
}

/** "Iniciar sono": guarda a hora de deitar até a pessoa tocar em "Acordei". */
export async function startSleep(): Promise<{ error?: string }> {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("sleep_starts")
    .upsert({ user_id: profile.id, started_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    console.error("Falha ao iniciar sono:", error);
    return { error: "Não foi possível marcar a hora de dormir. Tente de novo." };
  }
  revalidatePath("/hoje");
  return {};
}

/** Desfaz um "Iniciar sono" tocado sem querer. */
export async function cancelSleep(): Promise<void> {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  await supabase.from("sleep_starts").delete().eq("user_id", profile.id);
  revalidatePath("/hoje");
}

export type StopBangState = { error?: string; score?: number; risk?: "low" | "intermediate" | "high" };

export async function saveStopBang(_prev: StopBangState, formData: FormData): Promise<StopBangState> {
  const profile = await requireOnboarded();
  const answers = {} as Record<(typeof STOP_BANG)[number]["id"], boolean>;
  for (const q of STOP_BANG) {
    const v = formData.get(q.id);
    if (v !== "yes" && v !== "no") return { error: "Responda todas as perguntas." };
    answers[q.id] = v === "yes";
  }
  const { score, risk } = scoreStopBang(answers);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("sleep_screenings")
    .insert({ user_id: profile.id, kind: "stop_bang", answers, score, risk });
  if (error) {
    console.error("Falha ao salvar STOP-Bang:", error);
    return { error: "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath("/hoje");
  revalidatePath("/sono/apneia");
  return { score, risk };
}
