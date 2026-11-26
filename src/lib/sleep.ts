// Sono: cálculos do diário de sono e do questionário STOP-Bang. Funções puras.

import { addDays } from "./dates";

const OFFSET = "-03:00"; // Brasília, sem horário de verão desde 2019

/** Opções do diário (minutos representativos de cada faixa). */
export const LATENCY_OPTIONS = [
  { value: 10, label: "Menos de 15 min" },
  { value: 22, label: "15 a 30 min" },
  { value: 45, label: "30 min a 1 h" },
  { value: 75, label: "Mais de 1 h" },
] as const;

export const AWAKE_OPTIONS = [
  { value: 0, label: "Não acordei" },
  { value: 10, label: "Pouco, menos de 15 min" },
  { value: 30, label: "15 a 45 min" },
  { value: 75, label: "Mais de 45 min" },
] as const;

export const QUALITY_LABELS = ["Péssima", "Ruim", "Regular", "Boa", "Ótima"] as const;

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * Converte "23:15" e "06:40" na noite que terminou no dia `night` (o dia em que
 * acordou). Se a hora de deitar for maior que a de acordar, deitou na véspera.
 */
export function nightTimes(night: string, bed: string, wake: string): { bedtime: string; wakeTime: string } | { error: string } {
  const b = HHMM.exec(bed);
  const w = HHMM.exec(wake);
  if (!b || !w) return { error: "Informe os horários como 23:30." };
  const bedMin = Number(b[1]) * 60 + Number(b[2]);
  const wakeMin = Number(w[1]) * 60 + Number(w[2]);
  const bedDay = bedMin > wakeMin ? addDays(night, -1) : night;
  const pad = (n: number) => String(n).padStart(2, "0");
  const bedtime = new Date(`${bedDay}T${pad(Number(b[1]))}:${b[2]}:00${OFFSET}`);
  const wakeTime = new Date(`${night}T${pad(Number(w[1]))}:${w[2]}:00${OFFSET}`);
  const hours = (wakeTime.getTime() - bedtime.getTime()) / 3_600_000;
  if (hours < 1) return { error: "Entre deitar e acordar precisa haver pelo menos 1 hora." };
  if (hours > 16) return { error: "Mais de 16 horas na cama? Confira os horários." };
  return { bedtime: bedtime.toISOString(), wakeTime: wakeTime.toISOString() };
}

export type SleepLog = {
  night: string;
  bedtime: string;
  wake_time: string;
  latency_min: number;
  awake_min: number;
  quality: number | null;
};

export type SleepMetrics = {
  inBedMin: number;
  asleepMin: number;
  /** Tempo dormindo dividido pelo tempo na cama, de 0 a 1. */
  efficiency: number;
};

export function sleepMetrics(log: Pick<SleepLog, "bedtime" | "wake_time" | "latency_min" | "awake_min">): SleepMetrics {
  const inBedMin = Math.max(0, (Date.parse(log.wake_time) - Date.parse(log.bedtime)) / 60000);
  const asleepMin = Math.max(0, inBedMin - log.latency_min - log.awake_min);
  return { inBedMin, asleepMin, efficiency: inBedMin > 0 ? asleepMin / inBedMin : 0 };
}

/** Avaliação simples da noite, para cor e texto. */
export function nightVerdict(m: SleepMetrics): { tone: "good" | "ok" | "low"; text: string } {
  const h = m.asleepMin / 60;
  if (h >= 7 && m.efficiency >= 0.85) return { tone: "good", text: "Noite boa: tempo suficiente e sono contínuo." };
  if (h < 6) return { tone: "low", text: "Menos de 6 horas de sono. Isso costuma aumentar a fome no dia seguinte." };
  if (m.efficiency < 0.85) return { tone: "ok", text: "Muito tempo acordado na cama. Ir para a cama só com sono costuma ajudar." };
  return { tone: "ok", text: "Perto do ideal. Adultos costumam precisar de 7 a 9 horas." };
}

/**
 * Compara as calorias do dia depois de noites curtas (menos de 6 h) com as do
 * dia depois de noites de 7 h ou mais. Só responde com 3 dias em cada grupo.
 */
export function sleepVsIntake(
  nights: { night: string; asleepMin: number }[],
  kcalByDay: Map<string, number>,
): { shortAvg: number; okAvg: number; diff: number; shortDays: number; okDays: number } | null {
  const short: number[] = [];
  const ok: number[] = [];
  for (const n of nights) {
    const kcal = kcalByDay.get(n.night); // o dia em que acordou
    if (kcal === undefined || kcal <= 0) continue;
    if (n.asleepMin < 360) short.push(kcal);
    else if (n.asleepMin >= 420) ok.push(kcal);
  }
  if (short.length < 3 || ok.length < 3) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const shortAvg = avg(short);
  const okAvg = avg(ok);
  return { shortAvg, okAvg, diff: shortAvg - okAvg, shortDays: short.length, okDays: ok.length };
}

// ---------- STOP-Bang ----------
// Chung F. et al., Anesthesiology 2008; regras de risco de Chung et al., Chest 2016.

export const STOP_BANG = [
  { id: "snoring", short: "S", text: "Você ronca alto (mais alto que uma conversa, ou dá para ouvir de outro cômodo)?" },
  { id: "tired", short: "T", text: "Você se sente cansado ou sonolento durante o dia com frequência?" },
  { id: "observed", short: "O", text: "Alguém já viu você parar de respirar ou engasgar enquanto dormia?" },
  { id: "pressure", short: "P", text: "Você tem ou trata pressão alta?" },
  { id: "bmi", short: "B", text: "Seu IMC é maior que 35?" },
  { id: "age", short: "A", text: "Você tem mais de 50 anos?" },
  { id: "neck", short: "N", text: "Seu pescoço mede mais de 40 cm (na altura do pomo de adão)?" },
  { id: "male", short: "G", text: "Sexo masculino?" },
] as const;

export type StopBangId = (typeof STOP_BANG)[number]["id"];
export type StopBangAnswers = Record<StopBangId, boolean>;

export function scoreStopBang(a: StopBangAnswers): { score: number; risk: "low" | "intermediate" | "high" } {
  const score = STOP_BANG.filter((q) => a[q.id]).length;
  const stop = [a.snoring, a.tired, a.observed, a.pressure].filter(Boolean).length;
  let risk: "low" | "intermediate" | "high" = score <= 2 ? "low" : score <= 4 ? "intermediate" : "high";
  if (stop >= 2 && (a.male || a.bmi || a.neck)) risk = "high";
  return { score, risk };
}

export const RISK_TEXT = {
  low: {
    title: "Risco baixo de apneia",
    text: "Pelas respostas, o risco de apneia do sono é baixo. Se o ronco ou o cansaço piorarem, refaça o questionário.",
  },
  intermediate: {
    title: "Risco intermediário de apneia",
    text: "Vale conversar com seu médico na próxima consulta e contar sobre o ronco e o cansaço. Ele pode pedir um exame do sono.",
  },
  high: {
    title: "Risco alto de apneia",
    text: "Procure seu médico e peça uma avaliação de apneia do sono (polissonografia, que hoje pode ser feita em casa). A apneia tem tratamento, que costuma melhorar o cansaço e ajuda a controlar a pressão.",
  },
} as const;
