// O app usa o horário de Brasília (sem horário de verão desde 2019: UTC-3).
export const TIME_ZONE = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(dayISO: string, days: number): string {
  const d = new Date(`${dayISO}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return todayISO(d);
}

/** Intervalo [início, fim) do dia em ISO UTC, para filtrar timestamps. */
export function dayRange(dayISO: string): { from: string; to: string } {
  const from = new Date(`${dayISO}T00:00:00${OFFSET}`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function formatDay(dayISO: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dayISO}T12:00:00${OFFSET}`));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Tipo de refeição sugerido pelo horário. */
export function suggestMealType(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }).format(now),
  );
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  if (hour < 21) return "dinner";
  return "supper";
}

export const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
  supper: "Ceia",
};
