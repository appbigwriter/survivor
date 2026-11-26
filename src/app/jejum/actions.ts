"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth";
import { fastingEligibility, formatHHMM, parseHHMM, PROTOCOLS, protocolById, startLimits, type ProtocolId } from "@/lib/fasting";
import { loadFastingContext } from "@/lib/fasting-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FastingState = { error?: string; ok?: string; blocked?: string[] };

const yesNo = z.enum(["yes", "no"], { error: "Responda todas as perguntas." }).transform((v) => v === "yes");

const answersSchema = z.object({
  pregnant: yesNo.optional(),
  eatingDisorder: yesNo,
  type1Diabetes: yesNo,
  diabetes: yesNo,
  glucoseLoweringDrug: yesNo,
});

const choiceSchema = z.object({
  protocol: z.enum(PROTOCOLS.map((p) => p.id) as [ProtocolId, ...ProtocolId[]], { error: "Escolha o tempo de jejum." }),
  eating_start: z.string().refine((v) => parseHHMM(v) !== null, "Informe a hora como 08:00."),
  clearance: z.literal("on").optional(),
});

function revalidateAll() {
  revalidatePath("/hoje");
  revalidatePath("/jejum");
  revalidatePath("/historico");
}

export async function saveFasting(_prev: FastingState, formData: FormData): Promise<FastingState> {
  const profile = await requireOnboarded();
  const raw = Object.fromEntries(formData);
  const parsedAnswers = answersSchema.safeParse(raw);
  if (!parsedAnswers.success) return { error: parsedAnswers.error.issues[0].message };
  const askPregnancy = profile.sex !== "male";
  if (askPregnancy && parsedAnswers.data.pregnant === undefined) return { error: "Responda todas as perguntas." };

  // A triagem é refeita aqui com os dados do servidor; o navegador só mostra a prévia.
  const ctx = await loadFastingContext(profile);
  if (!ctx.ready) return { error: "O jejum ainda não está disponível. Avise o administrador." };
  if (ctx.incomplete) return { error: "Não foi possível conferir seus dados agora. Tente de novo em instantes." };

  const a = parsedAnswers.data;
  const answers = {
    pregnant: askPregnancy ? Boolean(a.pregnant) : false,
    eatingDisorder: a.eatingDisorder,
    type1Diabetes: a.type1Diabetes,
    diabetes: a.diabetes || a.type1Diabetes,
    glucoseLoweringDrug: a.glucoseLoweringDrug,
  };
  const eligibility = fastingEligibility({ ...ctx.facts, ...answers });
  const supabase = await createSupabaseServerClient();

  // Bloqueado: grava as respostas e desliga, sem exigir as escolhas de horário.
  if (eligibility.status === "blocked") {
    const { error } = await supabase.from("fasting_settings").upsert({
      user_id: profile.id,
      enabled: false,
      protocol: ctx.settings?.protocol ?? "12:12",
      eating_start: ctx.settings?.eating_start ?? "08:00",
      answers,
      eligibility: "blocked",
      medical_clearance: false,
    });
    if (error) {
      console.error("Falha ao salvar jejum:", error);
      return { error: "Não foi possível salvar. Tente de novo." };
    }
    revalidateAll();
    return { blocked: eligibility.reasons };
  }

  const parsedChoice = choiceSchema.safeParse(raw);
  if (!parsedChoice.success) return { error: parsedChoice.error.issues[0].message };
  const c = parsedChoice.data;
  const startMin = parseHHMM(c.eating_start)!;
  const limits = startLimits(c.protocol);
  if (startMin < limits.min || startMin > limits.max) {
    return {
      error: `No jejum ${protocolById(c.protocol).id}, a janela deve abrir entre ${formatHHMM(limits.min)} e ${formatHHMM(limits.max)}, para terminar até a meia-noite.`,
    };
  }

  const clearance = c.clearance === "on";
  const enabled = eligibility.status === "ok" || clearance;
  const { error } = await supabase.from("fasting_settings").upsert({
    user_id: profile.id,
    enabled,
    protocol: c.protocol,
    eating_start: c.eating_start,
    answers,
    eligibility: eligibility.status,
    medical_clearance: eligibility.status === "needs_clearance" && clearance,
  });
  if (error) {
    console.error("Falha ao salvar jejum:", error);
    return { error: "Não foi possível salvar. Tente de novo." };
  }
  revalidateAll();
  if (!enabled) return { error: "Respostas salvas. Para ativar, confirme que seu médico liberou o jejum." };
  return { ok: "Jejum ativado." };
}

export type DisableState = { error?: string };

export async function disableFasting(): Promise<DisableState> {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("fasting_settings").update({ enabled: false }).eq("user_id", profile.id);
  if (error) {
    console.error("Falha ao desativar jejum:", error);
    return { error: "Não foi possível desativar. Tente de novo." };
  }
  revalidateAll();
  return {};
}
