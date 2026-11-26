import { describe, expect, it } from "vitest";
import { eatingWindow, fastingEligibility, fastingNow, fastingWarning, insideWindow, overnightFasts, type EligibilityInput } from "./fasting";

const base: EligibilityInput = {
  ageYears: 45,
  sex: "male",
  bmi: 32,
  pregnant: false,
  eatingDisorder: false,
  type1Diabetes: false,
  diabetes: false,
  glucoseLoweringDrug: false,
  hypoglycemiaRisk: false,
  bloodPressureMeds: false,
  appetiteReducer: false,
  unknownMeds: false,
  heartOrBp: false,
  dizziness: false,
  kidneyDisease: false,
  chronicOrMeds: false,
};

describe("triagem do jejum", () => {
  it("libera quem não tem restrição", () => {
    expect(fastingEligibility(base).status).toBe("ok");
  });

  it("bloqueia grupos de risco", () => {
    expect(fastingEligibility({ ...base, pregnant: true }).status).toBe("blocked");
    expect(fastingEligibility({ ...base, eatingDisorder: true }).status).toBe("blocked");
    expect(fastingEligibility({ ...base, hypoglycemiaRisk: true }).status).toBe("blocked");
    expect(fastingEligibility({ ...base, ageYears: 16 }).status).toBe("blocked");
    expect(fastingEligibility({ ...base, bmi: 17.9 }).status).toBe("blocked");
    expect(fastingEligibility({ ...base, glucoseLoweringDrug: true }).status).toBe("blocked");
  });

  it("na dúvida, pede liberação", () => {
    expect(fastingEligibility({ ...base, unknownMeds: true }).status).toBe("needs_clearance");
    expect(fastingEligibility({ ...base, bmi: null }).status).toBe("needs_clearance");
    expect(fastingEligibility({ ...base, appetiteReducer: true }).status).toBe("needs_clearance");
  });

  it("remédio de pressão exige liberação médica", () => {
    const r = fastingEligibility({ ...base, ageYears: 64, bloodPressureMeds: true, heartOrBp: true });
    expect(r.status).toBe("needs_clearance");
    expect(r.reasons).toHaveLength(1); // não repete a pressão
  });

  it("bloqueio vence a liberação", () => {
    expect(fastingEligibility({ ...base, bloodPressureMeds: true, hypoglycemiaRisk: true }).status).toBe("blocked");
  });
});

describe("janela de alimentação", () => {
  it("janela normal e janela que passa da meia-noite", () => {
    const w = eatingWindow("16:8", 10 * 60); // 10h às 18h
    expect(insideWindow(12 * 60, w)).toBe(true);
    expect(insideWindow(19 * 60, w)).toBe(false);
    const late = eatingWindow("12:12", 14 * 60); // 14h às 2h
    expect(insideWindow(60, late)).toBe(true);
    expect(insideWindow(3 * 60, late)).toBe(false);
  });

  it("estado atual", () => {
    const f = fastingNow(8 * 60, 13 * 60, "14:10", 10 * 60); // 8h, janela 10h-20h
    expect(f.phase).toBe("fasting");
    expect(f.untilChangeMin).toBe(120);
    expect(f.targetMin).toBe(14 * 60);
    const e = fastingNow(19 * 60, 30, "14:10", 10 * 60);
    expect(e.phase).toBe("eating");
    expect(e.untilChangeMin).toBe(60);
  });
});

describe("jejum de cada noite", () => {
  it("do jantar até a primeira refeição do dia seguinte", () => {
    const meals = [
      { at: "2026-11-24T22:30:00.000Z", day: "2026-11-24" }, // 19:30
      { at: "2026-11-25T11:30:00.000Z", day: "2026-11-25" }, // 8:30
      { at: "2026-11-25T15:00:00.000Z", day: "2026-11-25" },
      { at: "2026-11-26T15:00:00.000Z", day: "2026-11-26" }, // 24 h depois: esquecimento
      { at: "2026-11-27T12:00:00.000Z", day: "2026-11-27" },
    ];
    const r = overnightFasts(meals);
    expect(r.get("2026-11-25")).toBe(13);
    expect(r.has("2026-11-26")).toBe(false);
    expect(r.has("2026-11-27")).toBe(false); // 21 h: também fora
  });
});

describe("avisos", () => {
  it("tontura com pressão baixa manda pausar", () => {
    expect(fastingWarning({ dizzyLast7d: 1, lowBpLast3d: true, lowIntake3d: false })).toContain("Pause");
    expect(fastingWarning({ dizzyLast7d: 0, lowBpLast3d: false, lowIntake3d: false })).toBeNull();
  });
});
