import { describe, expect, it } from "vitest";
import {
  birthDateISO,
  draftFrom,
  firstInvalid,
  healthNotes,
  healthyRange,
  medicationNotes,
  nextWhileEditing,
  paceEstimate,
  parseNum,
  stepsFor,
  toFormFields,
  validateStep,
  type Draft,
} from "./anamnese-steps";

const today = new Date("2026-11-26T12:00:00");

const filled: Draft = {
  sex: "female",
  birthDay: "10",
  birthMonth: "5",
  birthYear: "1962",
  heightCm: "162",
  weightKg: "101,6",
  waistCm: "",
  goal: "lose",
  targetWeightKg: "92",
  occupation: "sedentary",
  walkMinutes: "30",
  training: "none",
  strengthSessions: "",
  strengthMinutes: "60",
  calisthenicsSessions: "",
  calisthenicsMinutes: "30",
  trainingLocation: "gym",
  trainingExperience: "never",
  screening: {
    heart_or_bp: false,
    chest_pain: false,
    dizziness: false,
    chronic_disease: false,
    kidney_disease: false,
    heart_bp_diabetes_meds: false,
    joint_problem: false,
    supervised_only: false,
  },
  medications: "",
  renalClearance: false,
};

describe("anamnese em passos", () => {
  it("aceita vírgula nos números", () => {
    expect(parseNum("95,5")).toBe(95.5);
    expect(parseNum("")).toBeNull();
    expect(parseNum("abc")).toBeNull();
  });

  it("recusa datas que não existem", () => {
    expect(birthDateISO({ ...filled, birthDay: "31", birthMonth: "2" })).toBeNull();
    expect(birthDateISO(filled)).toBe("1962-05-10");
  });

  it("valida idade mínima", () => {
    expect(validateStep("birth", { ...filled, birthYear: "2015" }, today)).toMatch(/18 anos/);
    expect(validateStep("birth", filled, today)).toBeNull();
  });

  it("peso-alvo coerente com o objetivo e acima do saudável", () => {
    expect(validateStep("target", { ...filled, targetWeightKg: "110" })).toMatch(/menor/);
    expect(validateStep("target", { ...filled, targetWeightKg: "40" })).toMatch(/abaixo do saudável/);
    expect(validateStep("target", filled)).toBeNull();
    expect(healthyRange(162)).toEqual([49, 65]);
  });

  it("abre os passos certos conforme as respostas", () => {
    const none = stepsFor(filled);
    expect(none).toContain("experience");
    expect(none).not.toContain("training_detail");
    expect(none).not.toContain("meds_summary");
    const trains = stepsFor({ ...filled, training: "both", medications: "Losartana 50 mg" });
    expect(trains).toContain("training_detail");
    expect(trains).not.toContain("experience");
    expect(trains).toContain("meds_summary");
    expect(stepsFor({ ...filled, goal: "maintain" })).not.toContain("pace");
  });

  it("detalhe do treino exige vezes por semana", () => {
    const d: Draft = { ...filled, training: "strength", strengthSessions: "" };
    expect(validateStep("training_detail", d)).toMatch(/vezes/);
    expect(validateStep("training_detail", { ...d, strengthSessions: "3" })).toBeNull();
  });

  it("aponta o primeiro passo sem resposta", () => {
    expect(firstInvalid(filled, today)).toBeNull();
    expect(firstInvalid({ ...filled, screening: { ...filled.screening, dizziness: undefined } }, today)).toBe("health_dizziness");
  });

  it("pela revisão, percorre o grupo inteiro antes de voltar", () => {
    expect(nextWhileEditing("health_heart_or_bp", filled, today)).toBe("health_chest_pain");
    expect(nextWhileEditing("health_supervised_only", filled, today)).toBe("health_summary");
    expect(nextWhileEditing("health_summary", filled, today)).toBe("review");
    const trains: Draft = { ...filled, training: "strength", strengthSessions: "3" };
    expect(nextWhileEditing("training", trains, today)).toBe("training_detail");
    expect(nextWhileEditing("training", filled, today)).toBe("experience");
    expect(nextWhileEditing("meds", { ...filled, medications: "Losartana" }, today)).toBe("meds_summary");
    expect(nextWhileEditing("sex", filled, today)).toBe("review");
    expect(nextWhileEditing("goal", filled, today)).toBe("target");
  });

  it("experiência 'treino hoje' não vale para quem não treina", () => {
    expect(validateStep("experience", { ...filled, trainingExperience: "current" })).not.toBeNull();
    expect(validateStep("meds", { ...filled, medications: "x".repeat(2001) })).toMatch(/longa/);
  });

  it("estima o tempo até a meta no ritmo seguro", () => {
    const p = paceEstimate(filled)!;
    expect(p.kg).toBe(9.6);
    expect(p.minMonths).toBeLessThan(p.maxMonths);
  });

  it("modo cuidadoso pela idade ou por qualquer sim", () => {
    expect(healthNotes(filled, 64).cautious).toBe(true);
    expect(healthNotes(filled, 40).cautious).toBe(false);
    const chest = healthNotes({ ...filled, screening: { ...filled.screening, chest_pain: true } }, 40);
    expect(chest.cautious).toBe(true);
    expect(chest.notes.join(" ")).toMatch(/peito/);
  });

  it("explica os remédios reconhecidos e lista os desconhecidos", () => {
    const m = medicationNotes("Triplixan 10/5/10\nAldactone 25\nRemedio X");
    expect(m.recognized.length).toBeGreaterThan(1);
    expect(m.notes.join(" ")).toMatch(/Diurético/);
    expect(m.unknown).toEqual(["Remedio X"]);
  });

  it("gera os campos que o servidor espera", () => {
    const f = toFormFields(filled);
    expect(f.birth_date).toBe("1962-05-10");
    expect(f.weight_kg).toBe("101.6");
    expect(f.strength_sessions_per_week).toBe("0");
    expect(f.training_experience).toBe("never");
    expect(f.q_dizziness).toBe("no");
    expect(f.renal_clearance).toBeUndefined();
    const t = toFormFields({ ...filled, training: "calisthenics", calisthenicsSessions: "3", renalClearance: true });
    expect(t.calisthenics_sessions_per_week).toBe("3");
    expect(t.training_experience).toBe("current");
    expect(t.renal_clearance).toBe("on");
  });

  it("monta o rascunho de quem já preencheu", () => {
    const d = draftFrom({
      sex: "male",
      birth_date: "1960-03-07",
      height_cm: 175,
      waist_cm: null,
      goal: "lose",
      target_weight_kg: 85,
      occupation_activity: "active",
      walk_minutes_per_day: 45,
      strength_sessions_per_week: 3,
      strength_minutes_per_session: 60,
      calisthenics_sessions_per_week: 0,
      calisthenics_minutes_per_session: 30,
      training_location: "home_none",
      training_experience: "current",
      renal_clearance: false,
      onboarded: true,
      weightKg: 95,
      screening: { heart_or_bp: true },
      medications: "Losartana 50 mg",
    });
    expect(d.birthDay).toBe("7");
    expect(d.birthMonth).toBe("3");
    expect(d.training).toBe("strength");
    expect(d.screening.heart_or_bp).toBe(true);
    expect(d.renalClearance).toBe(false);
  });
});
