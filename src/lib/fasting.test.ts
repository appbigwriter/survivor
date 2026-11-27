import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  eatingWindow,
  fastingEligibility,
  fastingNow,
  fastingStats,
  fastingWarning,
  insideWindow,
  mealFastingEffect,
  suggestStartsFast,
  overnightFasts,
  phasesFor,
  type EligibilityInput,
} from "./fasting";

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

  it("a refeição abre e fecha o jejum", () => {
    // Janela 10h-20h, 11h, última refeição ontem às 19h (16 h atrás): a janela abriu, mas ainda não comeu.
    const waiting = fastingNow(11 * 60, 16 * 60, "14:10", 10 * 60);
    expect(waiting.phase).toBe("fasting");
    expect(waiting.reason).toBe("waiting");
    // Comeu às 10h30: o jejum acabou.
    expect(fastingNow(11 * 60, 30, "14:10", 10 * 60).phase).toBe("eating");
    // Jantou às 18h e marcou como a última do dia: às 19h já está em jejum, com a janela aberta.
    const closed = fastingNow(19 * 60, 60, "14:10", 10 * 60, true);
    expect(closed.phase).toBe("fasting");
    expect(closed.reason).toBe("closed");
    // A marca de ontem não vale para hoje: comeu às 10h30 sem marcar.
    expect(fastingNow(11 * 60, 30, "14:10", 10 * 60, false).reason).toBe(null);
  });

  it("efeito da refeição no jejum", () => {
    const prev = new Date("2026-11-25T22:00:00Z");
    const ends = mealFastingEffect(new Date("2026-11-26T12:30:00Z"), prev, 14).ends;
    expect(ends?.hours).toBe(14.5);
    expect(ends?.reached).toBe(true);
    expect(mealFastingEffect(new Date("2026-11-25T23:30:00Z"), prev, 14).ends).toBe(null); // lanche 1h30 depois
    // Almoço 5 h depois do café, no mesmo dia: não é fim de jejum.
    expect(mealFastingEffect(new Date("2026-11-26T15:00:00Z"), new Date("2026-11-26T10:00:00Z"), 14).ends).toBe(null);
    expect(mealFastingEffect(new Date("2026-11-26T12:30:00Z"), null, 14).ends).toBe(null);
  });

  it("sugere marcar a última refeição do dia", () => {
    expect(suggestStartsFast("dinner", 12 * 60, "14:10", 10 * 60)).toBe(true);
    expect(suggestStartsFast("lunch", 12 * 60, "14:10", 10 * 60)).toBe(false);
    expect(suggestStartsFast("snack", 19 * 60, "14:10", 10 * 60)).toBe(true); // 1h antes de fechar
    expect(suggestStartsFast("snack", 21 * 60, "14:10", 10 * 60)).toBe(true); // depois de fechar
    expect(suggestStartsFast("breakfast", 7 * 60, "14:10", 10 * 60)).toBe(false); // antes de abrir
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

describe("ceia de madrugada", () => {
  it("conta como a noite anterior, não como o café do dia", () => {
    const meals = [
      { at: "2026-11-24T23:00:00.000Z", day: "2026-11-24" }, // 20:00
      { at: "2026-11-25T03:30:00.000Z", day: "2026-11-25" }, // 00:30 do dia 25
      { at: "2026-11-25T11:00:00.000Z", day: "2026-11-25" }, // 08:00
    ];
    expect(overnightFasts(meals).get("2026-11-25")).toBe(7.5);
  });
});

describe("avisos", () => {
  it("tontura com pressão baixa manda pausar", () => {
    expect(fastingWarning({ dizzyLast7d: 1, lowBpLast3d: true, lowIntake3d: false })).toContain("Pause");
    expect(fastingWarning({ dizzyLast7d: 0, lowBpLast3d: false, lowIntake3d: false })).toBeNull();
  });
});

describe("fases e constância", () => {
  it("mostra só as fases do protocolo", () => {
    expect(phasesFor(12).map((p) => p.h)).toEqual([4, 8, 12]);
    expect(phasesFor(16).map((p) => p.h)).toEqual([4, 8, 12, 14, 16]);
  });

  it("conta a semana, a sequência e a média", () => {
    const fasts = new Map([
      ["2026-11-20", 13],
      ["2026-11-21", 11],
      ["2026-11-22", 12.5],
      ["2026-11-23", 12],
      ["2026-11-25", 14],
    ]);
    const s = fastingStats(fasts, 12, "2026-11-26", addDays);
    expect(s.last7.map((d) => d.day)[0]).toBe("2026-11-20");
    expect(s.onTarget7).toBe(4);
    expect(s.measured7).toBe(5);
    // Hoje ainda sem a primeira refeição: conta de ontem para trás; o dia 24 sem dado interrompe.
    expect(s.streak).toBe(1);
    expect(s.avg7).toBeCloseTo(12.5);
  });
});
