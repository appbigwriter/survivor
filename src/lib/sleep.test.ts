import { describe, expect, it } from "vitest";
import { nightTimes, nightVerdict, scoreStopBang, sleepMetrics, sleepVsIntake, type StopBangAnswers } from "./sleep";

describe("horários da noite", () => {
  it("deitou na véspera", () => {
    const r = nightTimes("2026-11-26", "23:15", "06:45");
    expect(r).toEqual({ bedtime: "2026-11-26T02:15:00.000Z", wakeTime: "2026-11-26T09:45:00.000Z" });
  });

  it("deitou depois da meia-noite", () => {
    const r = nightTimes("2026-11-26", "00:30", "07:00");
    expect(r).toEqual({ bedtime: "2026-11-26T03:30:00.000Z", wakeTime: "2026-11-26T10:00:00.000Z" });
  });

  it("recusa horários inválidos ou curtos demais", () => {
    expect(nightTimes("2026-11-26", "25:00", "07:00")).toHaveProperty("error");
    expect(nightTimes("2026-11-26", "06:30", "07:00")).toHaveProperty("error");
  });
});

describe("métricas", () => {
  const log = { bedtime: "2026-11-26T02:00:00.000Z", wake_time: "2026-11-26T10:00:00.000Z", latency_min: 22, awake_min: 10 };
  it("tempo dormindo e eficiência", () => {
    const m = sleepMetrics(log);
    expect(m.inBedMin).toBe(480);
    expect(m.asleepMin).toBe(448);
    expect(m.efficiency).toBeCloseTo(0.933, 2);
    expect(nightVerdict(m).tone).toBe("good");
  });

  it("noite curta", () => {
    const m = sleepMetrics({ ...log, bedtime: "2026-11-26T05:00:00.000Z" });
    expect(nightVerdict(m).tone).toBe("low");
  });
});

describe("sono e alimentação", () => {
  it("compara dias depois de noites curtas e boas", () => {
    const nights = [
      ...["01", "02", "03"].map((d) => ({ night: `2026-11-${d}`, asleepMin: 320 })),
      ...["04", "05", "06"].map((d) => ({ night: `2026-11-${d}`, asleepMin: 450 })),
    ];
    const kcal = new Map([
      ["2026-11-01", 2400], ["2026-11-02", 2300], ["2026-11-03", 2500],
      ["2026-11-04", 2000], ["2026-11-05", 2100], ["2026-11-06", 2000],
    ]);
    const r = sleepVsIntake(nights, kcal)!;
    expect(Math.round(r.diff)).toBe(367);
  });

  it("precisa de dados suficientes", () => {
    expect(sleepVsIntake([{ night: "2026-11-01", asleepMin: 300 }], new Map([["2026-11-01", 2000]]))).toBeNull();
  });
});

describe("STOP-Bang", () => {
  const none: StopBangAnswers = { snoring: false, tired: false, observed: false, pressure: false, bmi: false, age: false, neck: false, male: false };
  it("faixas de risco", () => {
    expect(scoreStopBang({ ...none, age: true, male: true })).toEqual({ score: 2, risk: "low" });
    expect(scoreStopBang({ ...none, age: true, bmi: true, pressure: true })).toEqual({ score: 3, risk: "intermediate" });
    expect(scoreStopBang({ ...none, pressure: true, bmi: true, age: true, male: true, snoring: true }).risk).toBe("high");
  });

  it("dois itens STOP com sexo masculino já é risco alto", () => {
    expect(scoreStopBang({ ...none, snoring: true, tired: true, male: true })).toEqual({ score: 3, risk: "high" });
  });
});
