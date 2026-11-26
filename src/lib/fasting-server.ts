import "server-only";
import { isMissingTable } from "@/lib/accounts";
import type { Profile } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { fastingEligibility, type Eligibility, type EligibilityInput, type ProtocolId } from "@/lib/fasting";
import { medicationFlags } from "@/lib/health/medications";
import { ageFromBirthDate } from "@/lib/health/targets";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FastingAnswers = Pick<EligibilityInput, "pregnant" | "eatingDisorder" | "type1Diabetes" | "diabetes" | "glucoseLoweringDrug">;

export type FastingSettings = {
  enabled: boolean;
  protocol: ProtocolId;
  eating_start: string; // "08:00:00"
  answers: Partial<FastingAnswers>;
  eligibility: "ok" | "needs_clearance" | "blocked";
  medical_clearance: boolean;
};

/** O que o app já sabe da pessoa e entra na triagem do jejum. */
export type KnownFacts = Omit<EligibilityInput, keyof FastingAnswers>;

export type FastingContext = {
  facts: KnownFacts;
  settings: FastingSettings | null;
  /** false enquanto a migração 0004 não rodou. */
  ready: boolean;
  /** true se algum dado da triagem não pôde ser lido agora. */
  incomplete: boolean;
};

export async function loadFastingContext(profile: Profile): Promise<FastingContext> {
  const supabase = await createSupabaseServerClient();
  const [weightRes, medsRes, screeningRes, settingsRes] = await Promise.all([
    supabase.from("weight_logs").select("weight_kg").order("measured_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("medications").select("drug_ids"),
    supabase.from("health_screenings").select("answers").maybeSingle(),
    supabase
      .from("fasting_settings")
      .select("enabled, protocol, eating_start, answers, eligibility, medical_clearance")
      .maybeSingle(),
  ]);

  const meds = medsRes.data ?? [];
  const flags = medicationFlags(meds.flatMap((m) => m.drug_ids as string[]));
  const screening = (screeningRes.data?.answers ?? {}) as Record<string, boolean>;
  const weight = weightRes.data ? Number(weightRes.data.weight_kg) : null;
  const h = profile.height_cm ? Number(profile.height_cm) / 100 : null;

  const facts: KnownFacts = {
    ageYears: profile.birth_date ? ageFromBirthDate(profile.birth_date, new Date(`${todayISO()}T12:00:00Z`)) : null,
    sex: profile.sex,
    bmi: weight && h ? weight / (h * h) : null,
    hypoglycemiaRisk: flags.hypoglycemiaRisk,
    bloodPressureMeds: flags.antihypertensive,
    appetiteReducer: flags.appetiteReducer,
    unknownMeds: meds.some((m) => (m.drug_ids as string[]).length === 0),
    heartOrBp: Boolean(screening.heart_or_bp),
    dizziness: Boolean(screening.dizziness),
    kidneyDisease: Boolean(screening.kidney_disease),
    chronicOrMeds: Boolean(screening.heart_bp_diabetes_meds) || Boolean(screening.chronic_disease),
  };
  const missing = settingsRes.error ? isMissingTable(settingsRes.error) : false;
  return {
    facts,
    settings: (settingsRes.data as FastingSettings | null) ?? null,
    ready: !missing,
    incomplete: Boolean(weightRes.error || medsRes.error || screeningRes.error || (settingsRes.error && !missing)),
  };
}

export type LiveFasting = {
  /** Jejum ativo de verdade: ligado e ainda permitido pelos dados de hoje. */
  active: boolean;
  settings: FastingSettings | null;
  eligibility: Eligibility | null;
  /** Ligado, mas a triagem de hoje não permite mais (remédio novo, peso, etc.). */
  suspended: boolean;
};

/**
 * Refaz a triagem a cada leitura: o que a pessoa respondeu no jejum somado ao
 * que o app sabe hoje. Um remédio novo ou uma mudança de peso suspendem o jejum
 * mesmo que ele tenha sido ligado antes. O que está gravado é só a escolha.
 */
export function liveFasting(ctx: FastingContext): LiveFasting {
  const s = ctx.settings;
  if (!s) return { active: false, settings: null, eligibility: null, suspended: false };
  const a = s.answers ?? {};
  const eligibility = fastingEligibility({
    ...ctx.facts,
    pregnant: Boolean(a.pregnant),
    eatingDisorder: Boolean(a.eatingDisorder),
    type1Diabetes: Boolean(a.type1Diabetes),
    diabetes: Boolean(a.diabetes),
    // Resposta ausente (gravada antes desta pergunta existir) conta como "sim" até a pessoa responder.
    glucoseLoweringDrug: a.glucoseLoweringDrug === undefined ? true : Boolean(a.glucoseLoweringDrug),
  });
  const allowed =
    !ctx.incomplete && (eligibility.status === "ok" || (eligibility.status === "needs_clearance" && s.medical_clearance));
  return { active: s.enabled && allowed, settings: s, eligibility, suspended: s.enabled && !allowed };
}
