// Leitura dos dados que o atalho do iPhone envia (Apple Saúde). Puro e testável.
// O iPhone em português formata números como "5.234" e "3,8": os dois jeitos valem.

import { z } from "zod";
import type { ActivityKind } from "./activity";

/** Texto vazio (consulta do Saúde sem amostras) vira "não enviado", não zero. */
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Número vindo como número ou texto: "3,8", "3.8", "1.234,5", "5.234" (milhar) ou "412,37". */
function toNumber(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim().replace(/\s/g, "");
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  // Sem vírgula: "5.234" com três dígitos depois do ponto é milhar no iPhone em português.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t);
}

const dec = (min: number, max: number) => z.preprocess((v) => toNumber(blank(v)), z.number().min(min).max(max).optional());
const int = (min: number, max: number) =>
  z.preprocess((v) => {
    const n = toNumber(blank(v));
    return typeof n === "number" ? Math.round(n) : n;
  }, z.number().int().min(min).max(max).optional());

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato aaaa-mm-dd.");
// Data e hora com fuso (Z ou -03:00): sem fuso, o servidor poderia ler no horário errado.
const dateTime = z
  .string()
  .regex(/(Z|[+-]\d{2}:?\d{2})$/, "Data e hora com fuso.")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Data e hora inválidas.");

export const healthPayload = z.object({
  date: isoDate,
  steps: int(0, 200000),
  distance_km: dec(0, 300),
  active_kcal: int(0, 20000),
  weight_kg: dec(30, 300),
  /** Data e hora da pesagem no Saúde. Sem ela o peso é ignorado, para não repetir uma pesagem antiga. */
  weight_at: dateTime.optional(),
  sleep: z.object({ bedtime: dateTime, wake: dateTime }).optional(),
  workouts: z
    .array(z.object({ type: z.string().max(100), minutes: z.preprocess((v) => toNumber(blank(v)), z.number().min(1).max(600)), start: dateTime }))
    .max(20)
    .optional(),
});

export type HealthPayload = z.infer<typeof healthPayload>;

/** Tipo de treino do Apple Saúde (em português ou inglês) para os tipos do app. */
export function workoutKind(type: string): ActivityKind {
  const t = type.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/walk|caminh|hik|trilha/.test(t)) return "walk";
  if (/strength|forca|muscula|weight/.test(t)) return "strength";
  if (/core|calisten|hiit|interval|cross|funcional/.test(t)) return "calisthenics";
  return "other";
}

/** Aceita só dias recentes: de 7 dias atrás até hoje. */
export function dateAllowed(date: string, today: string, addDays: (d: string, n: number) => string): boolean {
  return date <= today && date >= addDays(today, -7);
}

/** Resumo curto para o atalho mostrar no iPhone, só com o que foi mesmo salvo. */
export function summary(saved: { steps?: number; weight?: number; sleep?: boolean; workouts?: number }, skipped: string[] = []): string {
  const parts: string[] = [];
  if (saved.steps !== undefined) parts.push(`${saved.steps.toLocaleString("pt-BR")} passos`);
  if (saved.weight !== undefined) parts.push(`peso ${saved.weight.toLocaleString("pt-BR")} kg`);
  if (saved.sleep) parts.push("sono");
  if (saved.workouts) parts.push(`${saved.workouts} ${saved.workouts === 1 ? "treino" : "treinos"}`);
  const head = parts.length ? `Survivor recebeu: ${parts.join(", ")}.` : "Survivor: nada novo para salvar.";
  return skipped.length ? `${head} Ignorado: ${skipped.join(", ")}.` : head;
}
