// Cálculos do painel. Funções puras, sem banco, para poderem ser testadas.

export type WeightPoint = { day: string; kg: number };

/** Um peso por dia (o último medido no dia), em ordem cronológica. */
export function dailyWeights(rows: { day: string; kg: number; at: string }[]): WeightPoint[] {
  const byDay = new Map<string, { kg: number; at: string }>();
  for (const r of rows) {
    const cur = byDay.get(r.day);
    if (!cur || r.at > cur.at) byDay.set(r.day, { kg: r.kg, at: r.at });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({ day, kg: v.kg }));
}

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / DAY_MS);

/** Média móvel de 7 dias de calendário (usa os pesos que existirem na janela). */
export function movingAverage(points: WeightPoint[], window = 7): WeightPoint[] {
  return points.map((p) => {
    const end = dayNumber(p.day);
    const inWindow = points.filter((q) => {
      const n = dayNumber(q.day);
      return n <= end && n > end - window;
    });
    return { day: p.day, kg: inWindow.reduce((a, q) => a + q.kg, 0) / inWindow.length };
  });
}

/**
 * Tendência semanal (kg/semana) por regressão linear das pesagens diárias.
 * Só responde com pelo menos 4 pesagens espalhadas por 10 dias ou mais;
 * antes disso a oscilação de água engana.
 */
export function weeklyTrend(points: WeightPoint[]): number | null {
  if (points.length < 4) return null;
  const xs = points.map((p) => dayNumber(p.day));
  if (xs[xs.length - 1] - xs[0] < 10) return null;
  // A regressão já suaviza a oscilação; aplicá-la sobre a média móvel subestimaria a inclinação.
  const ys = points.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : (num / den) * 7;
}

/** Data prevista para chegar ao peso-alvo, se a tendência estiver indo na direção certa. */
export function projectGoalDate(currentKg: number, targetKg: number, perWeek: number | null, today: string): string | null {
  if (perWeek === null) return null;
  const diff = targetKg - currentKg;
  if (Math.abs(diff) < 0.3) return null;
  // Tendência fraca ou na direção errada: não prometer data.
  if (Math.sign(diff) !== Math.sign(perWeek) || Math.abs(perWeek) < 0.1) return null;
  const weeks = diff / perWeek;
  if (weeks > 104) return null;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(weeks * 7));
  return d.toISOString().slice(0, 10);
}

/** Meta de passos sugerida pela caminhada planejada na anamnese (cerca de 100 passos por minuto). */
export function suggestedSteps(walkMinutesPerDay: number | null): number {
  const base = 3000 + (walkMinutesPerDay ?? 30) * 100;
  return Math.min(12000, Math.max(5000, Math.round(base / 500) * 500));
}

export type DayScore = { day: string; level: 0 | 1 | 2 | 3 };

/**
 * Nota do dia para o calendário de constância:
 * 1 = registrou alguma refeição; +1 calorias a até 10% da meta; +1 proteína em 90% da meta.
 */
export function scoreDay(
  d: { meals: number; kcal: number; protein: number },
  goal: { kcal: number; protein_g: number } | null,
): DayScore["level"] {
  if (d.meals === 0) return 0;
  let level = 1;
  if (goal && Math.abs(d.kcal - goal.kcal) <= goal.kcal * 0.1) level++;
  if (goal && d.protein >= goal.protein_g * 0.9) level++;
  return level as DayScore["level"];
}

/**
 * Sequência de dias com registro, contando de ontem para trás (hoje conta se já
 * tiver registro). Um dia sem registro é perdoado, e o perdão volta depois de 7
 * dias registrados, para um esquecimento não zerar semanas de esforço. Vale
 * também de manhã, antes do primeiro registro do dia.
 */
export function streak(days: DayScore[], today: string): number {
  const sorted = [...days].sort((a, b) => (a.day < b.day ? 1 : -1));
  const todayScore = sorted.find((d) => d.day === today);
  let count = todayScore && todayScore.level > 0 ? 1 : 0;
  // Um perdão disponível; ele volta depois de 7 dias registrados.
  let forgiveness = true;
  let sinceMiss = 0;
  for (const d of sorted) {
    if (d.day >= today) continue;
    if (d.level > 0) {
      count++;
      sinceMiss++;
      if (sinceMiss >= 7) forgiveness = true;
    } else {
      if (!forgiveness) break;
      forgiveness = false;
      sinceMiss = 0;
    }
  }
  return count;
}

export type Hint = { tone: "good" | "tip"; text: string };

/** Uma sugestão curta e concreta para o resto do dia. */
export function nextHint(input: {
  hour: number;
  meals: number;
  kcal: number;
  protein: number;
  steps: number;
  goal: { kcal: number; protein_g: number } | null;
  stepGoal: number;
}): Hint | null {
  const { hour, meals, kcal, protein, steps, goal, stepGoal } = input;
  if (!goal) return null;
  const proteinLeft = goal.protein_g - protein;
  if (meals > 0 && protein >= goal.protein_g * 0.9 && Math.abs(kcal - goal.kcal) <= goal.kcal * 0.1) {
    return { tone: "good", text: "Calorias e proteína dentro da meta hoje. Ótimo dia." };
  }
  if (kcal > goal.kcal * 1.1) {
    return {
      tone: "tip",
      text: "Você passou da meta de calorias. Sem culpa: amanhã é outro dia, e uma caminhada a mais hoje ajuda.",
    };
  }
  if (hour >= 14 && proteinLeft > goal.protein_g * 0.5) {
    return {
      tone: "tip",
      text: `Faltam ${Math.round(proteinLeft)} g de proteína. Priorize ovos, frango, peixe, carne magra ou iogurte nas próximas refeições.`,
    };
  }
  if (hour >= 17 && steps < stepGoal * 0.5) {
    return {
      tone: "tip",
      text: `Faltam ${(stepGoal - steps).toLocaleString("pt-BR")} passos para a meta. Uma volta de 20 minutos dá uns 2.000.`,
    };
  }
  if (meals === 0 && hour >= 10) {
    return { tone: "tip", text: "Nenhuma refeição registrada ainda. Registrar logo depois de comer é mais fácil do que lembrar à noite." };
  }
  return null;
}
