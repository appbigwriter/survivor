"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasCurrentConsent, requireProfile } from "@/lib/auth";
import { healthyRange } from "@/lib/health/anamnese-steps";
import { identifyDrugs } from "@/lib/health/medications";
import { isCautiousMode, SCREENING_QUESTIONS, type ScreeningAnswers } from "@/lib/health/screening";
import { ageFromBirthDate, computeTargets } from "@/lib/health/targets";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnamneseState = { error?: string };

const num = (min: number, max: number, msg: string) =>
  z.coerce.number({ error: msg }).min(min, msg).max(max, msg);

const schema = z.object({
  sex: z.enum(["male", "female"], { error: "Escolha o sexo." }),
  birth_date: z.iso.date({ error: "Data de nascimento inválida." }),
  height_cm: num(100, 250, "Altura deve estar entre 100 e 250 cm."),
  weight_kg: num(30, 300, "Peso deve estar entre 30 e 300 kg."),
  waist_cm: z.union([z.literal(""), num(40, 250, "Cintura deve estar entre 40 e 250 cm.")]),
  goal: z.enum(["lose", "maintain", "gain_muscle", "gain_weight"], { error: "Escolha o objetivo." }),
  target_weight_kg: num(30, 300, "Peso-alvo deve estar entre 30 e 300 kg."),
  occupation_activity: z.enum(["sedentary", "active"]),
  walk_minutes_per_day: num(0, 300, "Minutos de caminhada inválidos."),
  strength_sessions_per_week: num(0, 7, "Sessões de musculação: de 0 a 7."),
  strength_minutes_per_session: num(10, 180, "Duração da musculação: de 10 a 180 minutos."),
  calisthenics_sessions_per_week: num(0, 7, "Sessões de calistenia: de 0 a 7."),
  calisthenics_minutes_per_session: num(10, 120, "Duração da calistenia: de 10 a 120 minutos."),
  training_location: z.enum(["gym", "home_equipment", "home_none"]),
  training_experience: z.enum(["never", "stopped", "current"]),
  medications: z.string().max(2000, "A lista de remédios ficou longa demais.").default(""),
  renal_clearance: z.string().optional(),
});

export async function saveAnamnese(_prev: AnamneseState, formData: FormData): Promise<AnamneseState> {
  const profile = await requireProfile();
  if (!(await hasCurrentConsent())) redirect("/consentimento");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const age = ageFromBirthDate(d.birth_date);
  if (age < 18 || age > 100) return { error: "O Survivor é para maiores de 18 anos." };

  if (d.goal === "lose" && d.target_weight_kg >= d.weight_kg) {
    return { error: "Para perder peso, o peso-alvo precisa ser menor que o peso atual." };
  }
  if ((d.goal === "gain_weight" || d.goal === "gain_muscle") && d.target_weight_kg < d.weight_kg) {
    return { error: "Para ganhar peso ou massa, o peso-alvo não pode ser menor que o atual." };
  }
  const minHealthy = healthyRange(d.height_cm)[0];
  if (d.goal === "lose" && d.target_weight_kg < minHealthy) {
    return { error: `Esse peso-alvo fica abaixo do saudável para a sua altura. Escolha ${minHealthy} kg ou mais.` };
  }

  const answers = Object.fromEntries(
    SCREENING_QUESTIONS.map((q) => [q.id, formData.get(`q_${q.id}`) === "yes"]),
  ) as ScreeningAnswers;
  const cautious = isCautiousMode(answers, age);

  const medicationLines = d.medications
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);
  const meds = medicationLines.map((line) => ({ name: line, drug_ids: identifyDrugs(line) }));
  const drugIds = [...new Set(meds.flatMap((m) => m.drug_ids))];
  const renalClearance = d.renal_clearance === "on";

  const targets = computeTargets({
    sex: d.sex,
    ageYears: age,
    heightCm: d.height_cm,
    weightKg: d.weight_kg,
    targetWeightKg: d.target_weight_kg,
    goal: d.goal,
    occupation: d.occupation_activity,
    walkMinutesPerDay: d.walk_minutes_per_day,
    strengthSessionsPerWeek: d.strength_sessions_per_week,
    strengthMinutesPerSession: d.strength_minutes_per_session,
    calisthenicsSessionsPerWeek: d.calisthenics_sessions_per_week,
    calisthenicsMinutesPerSession: d.calisthenics_minutes_per_session,
    drugIds,
    kidneyDisease: answers.kidney_disease,
    renalClearance,
  });

  const supabase = await createSupabaseServerClient();
  const uid = profile.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      sex: d.sex,
      birth_date: d.birth_date,
      height_cm: d.height_cm,
      waist_cm: d.waist_cm === "" ? null : d.waist_cm,
      goal: d.goal,
      target_weight_kg: d.target_weight_kg,
      occupation_activity: d.occupation_activity,
      walk_minutes_per_day: d.walk_minutes_per_day,
      strength_sessions_per_week: d.strength_sessions_per_week,
      strength_minutes_per_session: d.strength_minutes_per_session,
      calisthenics_sessions_per_week: d.calisthenics_sessions_per_week,
      calisthenics_minutes_per_session: d.calisthenics_minutes_per_session,
      training_location: d.training_location,
      training_experience: d.training_experience,
      renal_clearance: renalClearance,
      onboarding_completed_at: profile.onboarding_completed_at ?? new Date().toISOString(),
    })
    .eq("id", uid);
  if (profileError) return { error: "Não foi possível salvar. Tente de novo." };

  await supabase.from("health_screenings").upsert({
    user_id: uid,
    answers,
    cautious_mode: cautious,
    updated_at: new Date().toISOString(),
  });

  // Troca a lista de remédios sem perder a antiga se a gravação da nova falhar.
  const { data: oldMeds } = await supabase.from("medications").select("id").eq("user_id", uid);
  if (meds.length) {
    const { error } = await supabase.from("medications").insert(meds.map((m) => ({ ...m, user_id: uid })));
    if (error) return { error: "Não foi possível salvar os remédios. Tente de novo." };
  }
  const oldIds = (oldMeds ?? []).map((m) => m.id);
  if (oldIds.length) await supabase.from("medications").delete().in("id", oldIds);

  // Só registra o peso se ele mudou desde o último registro.
  const { data: lastWeight } = await supabase
    .from("weight_logs")
    .select("weight_kg")
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastWeight || Number(lastWeight.weight_kg) !== d.weight_kg) {
    await supabase.from("weight_logs").insert({ user_id: uid, weight_kg: d.weight_kg, source: "manual" });
  }

  const { error: goalError } = await supabase.from("goals").insert({
    user_id: uid,
    kcal: targets.kcal,
    protein_g: targets.proteinG,
    fat_g: targets.fatG,
    carbs_g: targets.carbsG,
    fiber_g: targets.fiberG,
    water_ml: targets.waterMl,
    sodium_mg: targets.sodiumMg,
    method: "initial",
    details: { ...targets.details, warnings: targets.warnings, cautious, ageYears: age },
  });
  if (goalError) return { error: "Não foi possível salvar as metas. Tente de novo." };

  redirect("/metas");
}
