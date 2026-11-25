import { describe, expect, it } from "vitest";
import { identifyDrugs, medicationFlags } from "./medications";
import { ageFromBirthDate, computeTargets, mifflinStJeor, type TargetInput } from "./targets";

const base: TargetInput = {
  sex: "male",
  ageYears: 64,
  heightCm: 178,
  weightKg: 114,
  targetWeightKg: 99,
  goal: "lose",
  occupation: "sedentary",
  walkMinutesPerDay: 60,
  strengthSessionsPerWeek: 0,
  strengthMinutesPerSession: 60,
  calisthenicsSessionsPerWeek: 7,
  calisthenicsMinutesPerSession: 30,
  drugIds: [],
  kidneyDisease: false,
  renalClearance: false,
};

describe("identifyDrugs", () => {
  it("abre o Triplixan em três princípios ativos", () => {
    expect(identifyDrugs("Triplixan 10-5-10").sort()).toEqual(
      ["anlodipino", "indapamida", "perindopril"],
    );
  });

  it("reconhece nome com dose e acento", () => {
    expect(identifyDrugs("Espironolactona 25mg")).toEqual(["espironolactona"]);
    expect(identifyDrugs("Sertralina 100m")).toEqual(["sertralina"]);
    expect(identifyDrugs("BUPROPIONA 150 mg")).toEqual(["bupropiona"]);
  });

  it("não confunde combinação com o remédio simples", () => {
    expect(identifyDrugs("Diovan HCT 160/12,5").sort()).toEqual(
      ["hidroclorotiazida", "valsartana"],
    );
  });

  it("devolve vazio para remédio desconhecido", () => {
    expect(identifyDrugs("Vitamina D 2000 UI")).toEqual([]);
  });
});

describe("medicationFlags", () => {
  it("marca risco de potássio com IECA + espironolactona", () => {
    const f = medicationFlags(["perindopril", "espironolactona"]);
    expect(f.potassiumRisk).toBe(true);
    expect(f.diuretic).toBe(true);
    expect(f.antihypertensive).toBe(true);
  });
});

describe("computeTargets", () => {
  it("bate com o metabolismo basal calculado à mão", () => {
    expect(mifflinStJeor("male", 114, 178, 64)).toBeCloseTo(1937.5);
  });

  it("dá 2.200 kcal e 198 g de proteína para o caso sem remédios", () => {
    const t = computeTargets(base);
    expect(t.details.tdee).toBe(2724);
    expect(t.kcal).toBe(2200);
    expect(t.proteinG).toBe(198);
    expect(t.fatG).toBe(79);
    expect(t.carbsG).toBe(174);
    expect(t.fiberG).toBe(31);
    expect(t.waterMl).toBe(4000);
    expect(t.sodiumMg).toBe(2000);
  });

  it("aplica as regras dos remédios do usuário atual", () => {
    const drugIds = [
      ...identifyDrugs("Triplixan 10-5-10"),
      ...identifyDrugs("Espironolactona 25mg"),
      ...identifyDrugs("Sertralina 100mg"),
      ...identifyDrugs("Bupropiona 150mg"),
    ];
    const t = computeTargets({ ...base, drugIds });
    expect(t.kcal).toBe(2200);
    expect(t.proteinG).toBe(158);
    expect(t.carbsG).toBe(214);
    expect(t.waterMl).toBeNull();
    expect(t.sodiumMg).toBeNull();
    expect(t.details.flags.potassiumRisk).toBe(true);
    expect(t.details.flags.hyponatremiaRisk).toBe(true);
    expect(t.warnings.some((w) => w.includes("sal light"))).toBe(true);
  });

  it("libera 2,0 g/kg com aprovação médica", () => {
    const t = computeTargets({ ...base, drugIds: ["perindopril"], renalClearance: true });
    expect(t.proteinG).toBe(198);
  });

  it("limita a proteína a 1,2 g/kg com doença renal", () => {
    const t = computeTargets({ ...base, kidneyDisease: true });
    expect(t.proteinG).toBe(119);
  });

  it("respeita o piso de calorias", () => {
    const t = computeTargets({
      ...base,
      sex: "female",
      weightKg: 55,
      targetWeightKg: 50,
      heightCm: 150,
      ageYears: 70,
      walkMinutesPerDay: 0,
      calisthenicsSessionsPerWeek: 0,
    });
    expect(t.kcal).toBe(1300);
    expect(t.details.floorApplied).toBe(true);
  });

  it("calcula superávit para ganho de massa", () => {
    const t = computeTargets({ ...base, goal: "gain_muscle", weightKg: 70, targetWeightKg: 75, ageYears: 30 });
    expect(t.kcal).toBeGreaterThan(t.details.tdee);
    expect(t.proteinG).toBe(140);
  });
});

describe("ageFromBirthDate", () => {
  it("conta o aniversário que ainda não chegou", () => {
    expect(ageFromBirthDate("1962-12-01", new Date("2026-11-25T12:00:00"))).toBe(63);
    expect(ageFromBirthDate("1962-11-25", new Date("2026-11-25T12:00:00"))).toBe(64);
  });
});
