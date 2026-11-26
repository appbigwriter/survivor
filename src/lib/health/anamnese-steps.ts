// Anamnese em passos: uma pergunta por tela. Tudo aqui é puro (sem React nem
// banco) para poder ser testado e usado no navegador e no servidor.

import { drugLabels, identifyDrugs, medicationFlags } from "./medications";
import { CAUTIOUS_AGE, SCREENING_QUESTIONS, type ScreeningId } from "./screening";
import { ageFromBirthDate, type Goal } from "./targets";

export type Training = "none" | "strength" | "calisthenics" | "both";

export type Draft = {
  sex: "male" | "female" | "";
  birthDay: string;
  birthMonth: string; // "1" a "12"
  birthYear: string;
  heightCm: string;
  weightKg: string;
  waistCm: string;
  goal: Goal | "";
  targetWeightKg: string;
  occupation: "sedentary" | "active" | "";
  walkMinutes: string;
  training: Training | "";
  strengthSessions: string;
  strengthMinutes: string;
  calisthenicsSessions: string;
  calisthenicsMinutes: string;
  trainingLocation: "gym" | "home_equipment" | "home_none";
  trainingExperience: "never" | "stopped" | "current" | "";
  screening: Partial<Record<ScreeningId, boolean>>;
  medications: string;
  renalClearance: boolean | null;
};

export type StepId =
  | "intro"
  | "sex"
  | "birth"
  | "height"
  | "weight"
  | "goal"
  | "target"
  | "pace"
  | "daily"
  | "walk"
  | "training"
  | "training_detail"
  | "experience"
  | "waist"
  | `health_${ScreeningId}`
  | "health_summary"
  | "meds"
  | "meds_summary"
  | "renal"
  | "review";

export type Section = "Sobre você" | "Objetivo" | "Rotina" | "Saúde" | "Remédios" | "Conferir";

/** Aceita "95,5" e "95.5". Vazio ou inválido vira null. */
export function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function birthDateISO(d: Draft): string | null {
  const day = Number(d.birthDay);
  const month = Number(d.birthMonth);
  const year = Number(d.birthYear);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) || year < 1900) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dt = new Date(`${iso}T12:00:00Z`);
  // 31 de fevereiro vira 3 de março no Date: confere se a data existe.
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) return null;
  return iso;
}

export function ageOf(d: Draft, today = new Date()): number | null {
  const iso = birthDateISO(d);
  return iso ? ageFromBirthDate(iso, today) : null;
}

/** Faixa de peso com IMC entre 18,5 e 24,9 para a altura. */
export function healthyRange(heightCm: number): [number, number] {
  const h = heightCm / 100;
  return [Math.round(18.5 * h * h), Math.round(24.9 * h * h)];
}

export const SCREENING_WHY: Record<ScreeningId, string> = {
  heart_or_bp: "Coração e pressão mudam o quanto de sal e de esforço é seguro para você.",
  chest_pain: "Dor no peito precisa ser vista pelo médico antes de você aumentar o exercício.",
  dizziness: "Tontura aumenta o risco de queda. Com isso o app passa a acompanhar sua pressão.",
  chronic_disease: "Algumas doenças mudam as metas de comida e de exercício.",
  kidney_disease: "Rim que funciona menos não deve receber muita proteína. O app ajusta a meta.",
  heart_bp_diabetes_meds: "Esses remédios mudam o sal, o potássio e o açúcar do sangue quando você emagrece.",
  joint_problem: "Assim o app sugere aumentar o exercício aos poucos.",
  supervised_only: "Se o médico pediu supervisão, o app não vai sugerir treino sozinho sem liberação.",
};

export function stepsFor(d: Draft): StepId[] {
  const steps: StepId[] = ["intro", "sex", "birth", "height", "weight", "goal", "target"];
  if (d.goal === "lose" || d.goal === "gain_weight" || d.goal === "gain_muscle") steps.push("pace");
  steps.push("daily", "walk", "training");
  if (d.training && d.training !== "none") steps.push("training_detail");
  else steps.push("experience");
  steps.push("waist");
  for (const q of SCREENING_QUESTIONS) steps.push(`health_${q.id}`);
  steps.push("health_summary", "meds");
  if (d.medications.trim()) steps.push("meds_summary");
  steps.push("renal", "review");
  return steps;
}

export function sectionOf(step: StepId): Section {
  if (["intro", "sex", "birth", "height", "weight"].includes(step)) return "Sobre você";
  if (["goal", "target", "pace"].includes(step)) return "Objetivo";
  if (["daily", "walk", "training", "training_detail", "experience", "waist"].includes(step)) return "Rotina";
  if (step.startsWith("health_")) return "Saúde";
  if (step === "review") return "Conferir";
  return "Remédios";
}

/** Erro que impede avançar, ou null. Mesmas regras do servidor. */
export function validateStep(step: StepId, d: Draft, today = new Date()): string | null {
  const between = (v: string, min: number, max: number, msg: string) => {
    const n = parseNum(v);
    return n === null || n < min || n > max ? msg : null;
  };
  switch (step) {
    case "sex":
      return d.sex ? null : "Escolha uma opção.";
    case "birth": {
      const age = ageOf(d, today);
      if (age === null) return "Confira o dia, o mês e o ano.";
      if (age < 18) return "O Survivor é para maiores de 18 anos.";
      if (age > 100) return "Confira o ano de nascimento.";
      return null;
    }
    case "height":
      return between(d.heightCm, 100, 250, "A altura deve ficar entre 100 e 250 cm.");
    case "weight":
      return between(d.weightKg, 30, 300, "O peso deve ficar entre 30 e 300 kg.");
    case "goal":
      return d.goal ? null : "Escolha uma opção.";
    case "target": {
      const err = between(d.targetWeightKg, 30, 300, "O peso-alvo deve ficar entre 30 e 300 kg.");
      if (err) return err;
      const target = parseNum(d.targetWeightKg)!;
      const weight = parseNum(d.weightKg);
      const height = parseNum(d.heightCm);
      if (weight !== null && d.goal === "lose" && target >= weight)
        return "Para perder peso, o peso-alvo precisa ser menor que o peso de hoje.";
      if (weight !== null && (d.goal === "gain_weight" || d.goal === "gain_muscle") && target < weight)
        return "Para ganhar peso ou massa, o peso-alvo não pode ser menor que o de hoje.";
      if (height !== null && d.goal === "lose" && target < healthyRange(height)[0])
        return `Esse peso fica abaixo do saudável para a sua altura. Escolha ${healthyRange(height)[0]} kg ou mais.`;
      return null;
    }
    case "daily":
      return d.occupation ? null : "Escolha uma opção.";
    case "walk":
      return between(d.walkMinutes, 0, 300, "Escolha de 0 a 300 minutos.");
    case "training":
      return d.training ? null : "Escolha uma opção.";
    case "training_detail": {
      if (d.training === "strength" || d.training === "both") {
        const e =
          between(d.strengthSessions, 1, 7, "Escolha quantas vezes por semana.") ??
          between(d.strengthMinutes, 10, 180, "Escolha quanto tempo dura a musculação.");
        if (e) return e;
      }
      if (d.training === "calisthenics" || d.training === "both") {
        const e =
          between(d.calisthenicsSessions, 1, 7, "Escolha quantas vezes por semana.") ??
          between(d.calisthenicsMinutes, 10, 120, "Escolha quanto tempo dura a calistenia.");
        if (e) return e;
      }
      return null;
    }
    case "experience":
      // "current" só vale para quem treina: quem parou de treinar precisa responder de novo.
      return d.trainingExperience === "never" || d.trainingExperience === "stopped" ? null : "Escolha uma opção.";
    case "waist":
      return d.waistCm.trim() ? between(d.waistCm, 40, 250, "A cintura deve ficar entre 40 e 250 cm.") : null;
    case "meds":
      if (d.medications.length > 2000) return "A lista ficou longa demais. Coloque só o nome e a dose de cada remédio.";
      return d.medications.split("\n").filter((l) => l.trim()).length > 20 ? "Coloque no máximo 20 remédios." : null;
    case "renal":
      return d.renalClearance === null ? "Escolha uma opção." : null;
    default:
      if (step.startsWith("health_") && step !== "health_summary") {
        const id = step.slice("health_".length) as ScreeningId;
        return d.screening[id] === undefined ? "Responda sim ou não." : null;
      }
      return null;
  }
}

/** Passos que andam juntos quando a pessoa toca em "Mudar" na revisão. */
function editGroup(step: StepId): string {
  if (step === "goal" || step === "target" || step === "pace") return "goal";
  if (step === "training" || step === "training_detail" || step === "experience") return "training";
  if (step.startsWith("health_")) return "health";
  if (step === "meds" || step === "meds_summary") return "meds";
  return step;
}

/**
 * Depois de "Continuar" num passo aberto pela revisão: segue pelos passos do
 * mesmo grupo (as 8 perguntas de saúde, os detalhes do treino, o resumo dos
 * remédios) e depois volta à revisão, ou para o que ficou faltando.
 */
export function nextWhileEditing(step: StepId, d: Draft, today = new Date()): StepId {
  const all = stepsFor(d);
  const following = all[all.indexOf(step) + 1];
  if (all.includes(step) && following && editGroup(following) === editGroup(step)) return following;
  return firstInvalid(d, today) ?? "review";
}

/** Primeiro passo com erro, para levar a pessoa direto a ele na revisão. */
export function firstInvalid(d: Draft, today = new Date()): StepId | null {
  return stepsFor(d).find((s) => validateStep(s, d, today) !== null) ?? null;
}

/** Tempo estimado até o peso-alvo, no ritmo seguro que o app usa (0,5% a 1% do peso por semana). */
export function paceEstimate(d: Draft): { kg: number; minMonths: number; maxMonths: number } | null {
  const weight = parseNum(d.weightKg);
  const target = parseNum(d.targetWeightKg);
  if (weight === null || target === null || weight === target) return null;
  const kg = Math.abs(weight - target);
  const [fast, slow] = d.goal === "lose" ? [0.01, 0.005] : d.goal === "gain_weight" ? [0.0075, 0.005] : [0.005, 0.0025];
  const months = (rate: number) => Math.max(1, Math.round(kg / (weight * rate) / 4.35));
  return { kg: Math.round(kg * 10) / 10, minMonths: months(fast), maxMonths: months(slow) };
}

/** O que muda no app por causa das respostas de saúde e da idade. */
export function healthNotes(d: Draft, age: number | null): { cautious: boolean; notes: string[] } {
  const s = d.screening;
  const notes: string[] = [];
  if (s.chest_pain) notes.push("Dor no peito: fale com seu médico antes de começar a caminhar mais ou treinar.");
  if (s.supervised_only) notes.push("Exercício só com a liberação e a supervisão que o seu médico pediu.");
  if (s.heart_or_bp || s.heart_bp_diabetes_meds || s.dizziness)
    notes.push("O app vai pedir para você anotar a pressão e avisa se ela ficar baixa.");
  if (s.kidney_disease) notes.push("A meta de proteína fica mais baixa até o médico liberar mais.");
  if (s.joint_problem) notes.push("Os passos e os treinos sobem aos poucos.");
  if (age !== null && age >= CAUTIOUS_AGE) notes.push(`A partir de ${CAUTIOUS_AGE} anos o app fica mais cuidadoso com exercício e pressão.`);
  const cautious = (age !== null && age >= CAUTIOUS_AGE) || Object.values(s).some(Boolean);
  return { cautious, notes };
}

/** Remédios reconhecidos e o que cada grupo muda nas metas. */
export function medicationNotes(text: string): { recognized: string[]; unknown: string[]; notes: string[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
  const ids = new Set<string>();
  const unknown: string[] = [];
  for (const line of lines) {
    const found = identifyDrugs(line);
    if (found.length === 0) unknown.push(line);
    found.forEach((id) => ids.add(id));
  }
  const f = medicationFlags([...ids]);
  const notes: string[] = [];
  if (f.diuretic) notes.push("Diurético: o app não dá meta de água nem de sal. Siga o que seu médico orienta.");
  if (f.potassiumRisk) notes.push("Evite sal light e suplemento de potássio sem orientação.");
  if (f.antihypertensive) notes.push("Remédio de pressão: ao emagrecer a pressão cai. Meça 2 ou 3 vezes por semana.");
  if (f.betaBlocker) notes.push("Betabloqueador: use o teste da fala no exercício, não os batimentos.");
  if (f.hypoglycemiaRisk) notes.push("Insulina ou remédio que baixa o açúcar: comer menos pode causar hipoglicemia. Fale com o médico.");
  if (f.appetiteReducer) notes.push("Remédio que tira o apetite: mesmo sem fome, tente bater a proteína.");
  if (f.ssri) notes.push("Sertralina e similares: não exagere na água.");
  return { recognized: drugLabels([...ids]), unknown, notes };
}

/** Rascunho a partir do que já está salvo (para quem atualiza os dados). */
export function draftFrom(input: {
  sex: "male" | "female" | null;
  birth_date: string | null;
  height_cm: number | null;
  waist_cm: number | null;
  goal: Goal | null;
  target_weight_kg: number | null;
  occupation_activity: "sedentary" | "active" | null;
  walk_minutes_per_day: number | null;
  strength_sessions_per_week: number | null;
  strength_minutes_per_session: number | null;
  calisthenics_sessions_per_week: number | null;
  calisthenics_minutes_per_session: number | null;
  training_location: "gym" | "home_equipment" | "home_none" | null;
  training_experience: "never" | "stopped" | "current" | null;
  renal_clearance: boolean | null;
  onboarded: boolean;
  weightKg: number | null;
  screening: Record<string, boolean>;
  medications: string;
}): Draft {
  const [y, m, dd] = input.birth_date?.split("-") ?? [];
  // Números com vírgula, como se escreve no Brasil ("101,4").
  const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)).replace(".", ","));
  const ss = input.strength_sessions_per_week ?? 0;
  const cs = input.calisthenics_sessions_per_week ?? 0;
  const training: Draft["training"] = !input.onboarded
    ? ""
    : ss > 0 && cs > 0
      ? "both"
      : ss > 0
        ? "strength"
        : cs > 0
          ? "calisthenics"
          : "none";
  const screening: Draft["screening"] = {};
  if (input.onboarded) for (const q of SCREENING_QUESTIONS) if (q.id in input.screening) screening[q.id] = Boolean(input.screening[q.id]);
  return {
    sex: input.sex ?? "",
    birthDay: dd ? String(Number(dd)) : "",
    birthMonth: m ? String(Number(m)) : "",
    birthYear: y ?? "",
    heightCm: str(input.height_cm),
    weightKg: str(input.weightKg),
    waistCm: str(input.waist_cm),
    goal: input.goal ?? "",
    targetWeightKg: str(input.target_weight_kg),
    occupation: input.onboarded ? (input.occupation_activity ?? "") : "",
    walkMinutes: input.onboarded ? str(input.walk_minutes_per_day) : "",
    training,
    strengthSessions: ss > 0 ? String(ss) : "",
    strengthMinutes: str(input.strength_minutes_per_session ?? 60),
    calisthenicsSessions: cs > 0 ? String(cs) : "",
    calisthenicsMinutes: str(input.calisthenics_minutes_per_session ?? 30),
    trainingLocation: input.training_location ?? "gym",
    // "current" de quem não treina mais não serve: a pessoa responde de novo.
    trainingExperience:
      input.onboarded && !(training === "none" && input.training_experience === "current") ? (input.training_experience ?? "") : "",
    screening,
    medications: input.medications,
    renalClearance: input.onboarded ? Boolean(input.renal_clearance) : null,
  };
}

/** Campos do formulário que o servidor espera (mesmos nomes da anamnese antiga). */
export function toFormFields(d: Draft): Record<string, string> {
  const num = (v: string) => (parseNum(v) === null ? "" : String(parseNum(v)));
  // Mantém a duração salva mesmo sem treino; fora da faixa do servidor, usa o padrão.
  const minutes = (v: string, max: number, fallback: string) => {
    const n = parseNum(v);
    return n !== null && n >= 10 && n <= max ? String(n) : fallback;
  };
  const strength = d.training === "strength" || d.training === "both";
  const cal = d.training === "calisthenics" || d.training === "both";
  const fields: Record<string, string> = {
    sex: d.sex,
    birth_date: birthDateISO(d) ?? "",
    height_cm: num(d.heightCm),
    weight_kg: num(d.weightKg),
    waist_cm: num(d.waistCm),
    goal: d.goal,
    target_weight_kg: num(d.targetWeightKg),
    occupation_activity: d.occupation,
    walk_minutes_per_day: num(d.walkMinutes),
    strength_sessions_per_week: strength ? num(d.strengthSessions) : "0",
    strength_minutes_per_session: strength ? num(d.strengthMinutes) : minutes(d.strengthMinutes, 180, "60"),
    calisthenics_sessions_per_week: cal ? num(d.calisthenicsSessions) : "0",
    calisthenics_minutes_per_session: cal ? num(d.calisthenicsMinutes) : minutes(d.calisthenicsMinutes, 120, "30"),
    training_location: d.trainingLocation,
    training_experience: d.training && d.training !== "none" ? "current" : d.trainingExperience,
    medications: d.medications,
  };
  if (d.renalClearance) fields.renal_clearance = "on";
  for (const q of SCREENING_QUESTIONS) fields[`q_${q.id}`] = d.screening[q.id] ? "yes" : "no";
  return fields;
}
