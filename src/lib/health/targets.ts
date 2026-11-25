// Cálculo das metas diárias (seção 3 da especificação).
import { medicationFlags, type MedicationFlags } from "./medications";

export type Sex = "male" | "female";
export type Goal = "lose" | "maintain" | "gain_muscle" | "gain_weight";

export type TargetInput = {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  occupation: "sedentary" | "active";
  walkMinutesPerDay: number;
  strengthSessionsPerWeek: number;
  strengthMinutesPerSession: number;
  calisthenicsSessionsPerWeek: number;
  calisthenicsMinutesPerSession: number;
  drugIds: string[];
  kidneyDisease: boolean;
  renalClearance: boolean;
};

export type Targets = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  /** null = conforme orientação médica */
  waterMl: number | null;
  /** null = conforme orientação médica */
  sodiumMg: number | null;
  details: {
    bmr: number;
    baseKcal: number;
    exerciseKcal: number;
    tdee: number;
    goalAdjustment: number;
    floorApplied: boolean;
    proteinPerKg: number;
    proteinRefWeightKg: number;
    fatPerKg: number;
    weeklyChangeRangePct: [number, number];
    flags: MedicationFlags & { hyponatremiaRisk: boolean };
  };
  warnings: string[];
};

export const KCAL_FLOOR: Record<Sex, number> = { male: 1600, female: 1300 };

const MET = { walk: 3, strength: 3.5, calisthenics: 4 } as const;

const GOAL_RULES: Record<
  Goal,
  {
    kcalFactor: number;
    proteinPerKg: number;
    fatPerKg: number;
    ref: "target" | "current";
    weeklyPct: [number, number];
  }
> = {
  lose: { kcalFactor: 0.8, proteinPerKg: 2.0, fatPerKg: 0.8, ref: "target", weeklyPct: [-1, -0.5] },
  maintain: { kcalFactor: 1.0, proteinPerKg: 1.6, fatPerKg: 0.9, ref: "current", weeklyPct: [-0.25, 0.25] },
  gain_muscle: { kcalFactor: 1.1, proteinPerKg: 2.0, fatPerKg: 0.9, ref: "current", weeklyPct: [0.25, 0.5] },
  gain_weight: { kcalFactor: 1.15, proteinPerKg: 1.8, fatPerKg: 1.0, ref: "current", weeklyPct: [0.5, 0.75] },
};

/** Metabolismo basal (Mifflin-St Jeor). */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, ageYears: number) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

/** Gasto líquido de uma atividade: (MET - 1) × peso × horas. */
function activityKcal(met: number, weightKg: number, minutes: number) {
  return (met - 1) * weightKg * (minutes / 60);
}

export function ageFromBirthDate(birthDate: string | Date, today = new Date()): number {
  const b = typeof birthDate === "string" ? new Date(`${birthDate}T12:00:00`) : birthDate;
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

const round = (n: number, step = 1) => Math.round(n / step) * step;

export function computeTargets(input: TargetInput): Targets {
  const rule = GOAL_RULES[input.goal];
  const flags = medicationFlags(input.drugIds);
  const hyponatremiaRisk = flags.ssri && (flags.diuretic || input.ageYears >= 65);
  const warnings: string[] = [];

  const bmr = mifflinStJeor(input.sex, input.weightKg, input.heightCm, input.ageYears);
  const baseKcal = bmr * (input.occupation === "active" ? 1.375 : 1.2);
  const exerciseKcal =
    activityKcal(MET.walk, input.weightKg, input.walkMinutesPerDay) +
    activityKcal(
      MET.strength,
      input.weightKg,
      (input.strengthSessionsPerWeek * input.strengthMinutesPerSession) / 7,
    ) +
    activityKcal(
      MET.calisthenics,
      input.weightKg,
      (input.calisthenicsSessionsPerWeek * input.calisthenicsMinutesPerSession) / 7,
    );
  const tdee = baseKcal + exerciseKcal;

  let kcal = round(tdee * rule.kcalFactor, 50);
  const floor = KCAL_FLOOR[input.sex];
  const floorApplied = kcal < floor;
  if (floorApplied) {
    kcal = floor;
    warnings.push(
      `A meta ficou no piso de segurança de ${floor} kcal. Abaixo disso, só com acompanhamento médico.`,
    );
  }

  const refWeight = rule.ref === "target" ? input.targetWeightKg : input.weightKg;

  let proteinPerKg = rule.proteinPerKg;
  if (input.kidneyDisease && !input.renalClearance) {
    proteinPerKg = Math.min(proteinPerKg, 1.2);
    warnings.push(
      "Proteína limitada a 1,2 g/kg por causa da doença renal informada, até o médico liberar mais.",
    );
  } else if (
    (flags.antihypertensive || flags.hypoglycemiaRisk) &&
    !input.renalClearance &&
    proteinPerKg > 1.6
  ) {
    proteinPerKg = 1.6;
    warnings.push(
      "Proteína começa em 1,6 g/kg por causa dos remédios de pressão ou diabetes. Com exames de função renal normais e liberação médica, ela pode subir para 2,0 g/kg.",
    );
  }

  const proteinG = round(proteinPerKg * refWeight);
  let fatG = round(rule.fatPerKg * refWeight);
  const minFatG = round(0.6 * refWeight);

  let carbsG = round((kcal - proteinG * 4 - fatG * 9) / 4);
  if (carbsG < 100 && fatG > minFatG) {
    // Pouco espaço para carboidrato: baixa a gordura até o mínimo de 0,6 g/kg.
    const missingKcal = (100 - carbsG) * 4;
    fatG = Math.max(minFatG, round(fatG - missingKcal / 9));
    carbsG = round((kcal - proteinG * 4 - fatG * 9) / 4);
  }
  carbsG = Math.max(0, carbsG);

  const fiberG = round((14 * kcal) / 1000);

  let waterMl: number | null = round(35 * input.weightKg, 100);
  if (flags.diuretic || hyponatremiaRisk) {
    waterMl = null;
    warnings.push(
      "Meta de água: conforme orientação do seu médico. Com diurético ou sertralina e similares, beber água demais pode baixar o sódio do sangue.",
    );
  }

  let sodiumMg: number | null = 2000;
  if (flags.diuretic) {
    sodiumMg = null;
    warnings.push("Sódio: siga a orientação do seu médico. Não corte o sal a zero.");
  }

  if (flags.potassiumRisk) {
    warnings.push(
      "Não use sal light nem substitutos com cloreto de potássio, e não tome suplemento de potássio sem orientação. Peça exames de potássio e creatinina ao médico.",
    );
  }
  if (flags.antihypertensive) {
    warnings.push(
      "Meça a pressão 2 ou 3 vezes por semana. Conforme o peso cai, a pressão também cai, e o médico pode precisar ajustar a dose. Levante devagar da cama e da cadeira.",
    );
  }
  if (flags.betaBlocker) {
    warnings.push(
      "Com betabloqueador, a frequência cardíaca não serve para medir a intensidade. Use o teste da fala: dá para conversar, mas não para cantar.",
    );
  }
  if (flags.hypoglycemiaRisk) {
    warnings.push(
      "Com insulina ou sulfonilureia, há risco de hipoglicemia ao comer menos e treinar mais. Fale com o médico sobre o ajuste da dose.",
    );
  }
  if (flags.appetiteReducer) {
    warnings.push(
      "Seu remédio pode tirar o apetite. Mesmo sem fome, tente bater a proteína e não fique abaixo da meta mínima.",
    );
  }

  return {
    kcal,
    proteinG,
    fatG,
    carbsG,
    fiberG,
    waterMl,
    sodiumMg,
    details: {
      bmr: round(bmr),
      baseKcal: round(baseKcal),
      exerciseKcal: round(exerciseKcal),
      tdee: round(tdee),
      goalAdjustment: rule.kcalFactor,
      floorApplied,
      proteinPerKg,
      proteinRefWeightKg: refWeight,
      fatPerKg: rule.fatPerKg,
      weeklyChangeRangePct: rule.weeklyPct,
      flags: { ...flags, hyponatremiaRisk },
    },
    warnings,
  };
}
