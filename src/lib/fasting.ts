// Jejum intermitente: protocolos, triagem de segurança e cálculos a partir das
// refeições registradas. Funções puras.
//
// O app não pede para "iniciar" e "parar" o jejum: o tempo de jejum é o
// intervalo desde a última refeição registrada.

export const PROTOCOLS = [
  { id: "12:12", fastH: 12, eatH: 12, label: "12 horas de jejum", hint: "Para começar: é quase só não comer depois do jantar." },
  { id: "14:10", fastH: 14, eatH: 10, label: "14 horas de jejum", hint: "Depois de 1 ou 2 semanas bem no 12:12." },
  { id: "16:8", fastH: 16, eatH: 8, label: "16 horas de jejum", hint: "O mais comum nos estudos. Não precisa chegar aqui." },
] as const;

export type ProtocolId = (typeof PROTOCOLS)[number]["id"];
export const protocolById = (id: string) => PROTOCOLS.find((p) => p.id === id) ?? PROTOCOLS[0];

export type EligibilityInput = {
  ageYears: number | null;
  sex: "male" | "female" | null;
  bmi: number | null;
  /** Respostas da tela de jejum. */
  pregnant: boolean;
  eatingDisorder: boolean;
  type1Diabetes: boolean;
  diabetes: boolean;
  /** "Você usa insulina ou remédio que pode baixar demais o açúcar?" */
  glucoseLoweringDrug: boolean;
  /** Dos remédios informados na anamnese. */
  hypoglycemiaRisk: boolean;
  bloodPressureMeds: boolean;
  appetiteReducer: boolean;
  /** Algum remédio informado que o app não reconheceu. */
  unknownMeds: boolean;
  /** Da triagem de saúde da anamnese. */
  heartOrBp: boolean;
  dizziness: boolean;
  kidneyDisease: boolean;
  /** Toma remédio para pressão, diabetes ou coração, ou tem outra doença crônica. */
  chronicOrMeds: boolean;
};

export type Eligibility = {
  status: "ok" | "needs_clearance" | "blocked";
  reasons: string[];
};

/**
 * Quem não deve fazer jejum pelo app, e quem só deve com liberação médica.
 * Baseado nas contraindicações usuais da literatura clínica sobre jejum
 * intermitente; na dúvida, pede liberação.
 */
export function fastingEligibility(i: EligibilityInput): Eligibility {
  const blocked: string[] = [];
  if (i.ageYears !== null && i.ageYears < 18) blocked.push("Menores de 18 anos não devem fazer jejum sem acompanhamento.");
  if (i.pregnant) blocked.push("Na gravidez e na amamentação o jejum não é recomendado.");
  if (i.eatingDisorder) blocked.push("Para quem já teve transtorno alimentar, o jejum pode trazer o problema de volta.");
  if (i.type1Diabetes) blocked.push("Com diabetes tipo 1, jejum só com acompanhamento médico de perto.");
  if (i.hypoglycemiaRisk || i.glucoseLoweringDrug)
    blocked.push("Insulina e remédios como glibenclamida e gliclazida podem causar hipoglicemia grave em jejum.");
  if (i.bmi !== null && i.bmi < 18.5) blocked.push("Com o peso abaixo do adequado, o jejum não é indicado.");
  if (blocked.length) return { status: "blocked", reasons: blocked };

  const clearance: string[] = [];
  if (i.bloodPressureMeds)
    clearance.push("Remédios para pressão, principalmente diuréticos, somados ao jejum aumentam o risco de pressão baixa e de alteração de sódio e potássio.");
  if (i.diabetes) clearance.push("Com diabetes, o médico precisa saber do jejum para ajustar o acompanhamento.");
  if (i.heartOrBp && !i.bloodPressureMeds) clearance.push("Você contou que tem problema de coração ou pressão.");
  if (i.dizziness) clearance.push("Você contou que teve tontura ou desmaio no último ano.");
  if (i.kidneyDisease) clearance.push("Com doença nos rins, o jejum precisa de orientação médica.");
  if (i.ageYears !== null && i.ageYears >= 70) clearance.push("Acima de 70 anos, vale combinar o jejum com o médico.");
  if (i.appetiteReducer) clearance.push("Você toma remédio que reduz o apetite; somado ao jejum, fica fácil comer menos do que precisa.");
  if (i.unknownMeds) clearance.push("Algum remédio que você informou não foi reconhecido pelo app, então ele não consegue checar se combina com o jejum.");
  if (i.chronicOrMeds && clearance.length === 0) clearance.push("Você contou que tem doença crônica ou toma remédio contínuo.");
  if (i.ageYears === null || i.bmi === null)
    clearance.push("Faltam sua data de nascimento ou seu peso no app, então a checagem ficou incompleta.");
  if (clearance.length) return { status: "needs_clearance", reasons: clearance };
  return { status: "ok", reasons: [] };
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
export function parseHHMM(v: string): number | null {
  const m = HHMM.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export function formatHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Primeiro e último horário permitidos para abrir a janela (ela fecha até meia-noite). */
export function startLimits(protocol: ProtocolId) {
  return { min: 5 * 60, max: (24 - protocolById(protocol).eatH) * 60 };
}

/** Jejuns mais longos que isso são tratados como registro esquecido, não como jejum. */
export const MAX_PLAUSIBLE_FAST_H = 20;

/** Janela de alimentação em minutos do dia (o fim pode passar da meia-noite). */
export function eatingWindow(protocol: ProtocolId, startMin: number) {
  const p = protocolById(protocol);
  return { start: startMin, end: startMin + p.eatH * 60 };
}

export function insideWindow(nowMin: number, w: { start: number; end: number }): boolean {
  if (w.end <= 1440) return nowMin >= w.start && nowMin < w.end;
  return nowMin >= w.start || nowMin < w.end - 1440;
}

export type FastingNow = {
  /** "eating": dentro da janela; "fasting": fora dela. */
  phase: "eating" | "fasting";
  /** Minutos desde a última refeição (null se não houver nos últimos dias). */
  sinceMealMin: number | null;
  targetMin: number;
  /** Minutos até a janela abrir (no jejum) ou fechar (comendo). */
  untilChangeMin: number;
};

export function fastingNow(nowMin: number, sinceMealMin: number | null, protocol: ProtocolId, startMin: number): FastingNow {
  const p = protocolById(protocol);
  const w = eatingWindow(protocol, startMin);
  const eating = insideWindow(nowMin, w);
  const untilChangeMin = eating ? (w.end - nowMin + 1440) % 1440 || 1440 : (w.start - nowMin + 1440) % 1440;
  return { phase: eating ? "eating" : "fasting", sinceMealMin, targetMin: p.fastH * 60, untilChangeMin };
}

/**
 * Jejum de cada dia: da última refeição antes do primeiro horário do dia até a
 * primeira refeição do dia. Dias sem refeição, ou com intervalo maior que 20 h
 * (provavelmente um registro esquecido), ficam de fora.
 */
export function overnightFasts(meals: { at: string; day: string }[]): Map<string, number> {
  const sorted = [...meals].sort((a, b) => (a.at < b.at ? -1 : 1));
  const result = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    if (cur.day === prev.day || result.has(cur.day)) continue; // só a primeira do dia
    const hours = (Date.parse(cur.at) - Date.parse(prev.at)) / 3_600_000;
    if (hours > 0 && hours <= MAX_PLAUSIBLE_FAST_H) result.set(cur.day, hours);
  }
  return result;
}

/** Sinais para pausar ou encurtar o jejum. */
export function fastingWarning(s: { dizzyLast7d: number; lowBpLast3d: boolean; lowIntake3d: boolean }): string | null {
  if (s.dizzyLast7d >= 1 && s.lowBpLast3d)
    return "Você teve tontura e pressão baixa nos últimos dias. Pause o jejum, coma normalmente e fale com seu médico.";
  if (s.dizzyLast7d >= 2) return "Você registrou tontura mais de uma vez nesta semana. Pause o jejum e fale com seu médico.";
  if (s.lowBpLast3d) return "Sua pressão veio baixa nos últimos dias. Encurte o jejum, beba água como seu médico orienta e meça de novo.";
  if (s.lowIntake3d) return "Você comeu pouco nos últimos 3 dias. O jejum não deve virar comer menos que a meta: use a janela para comer o que falta.";
  if (s.dizzyLast7d === 1) return "Você registrou tontura nesta semana. Se voltar a acontecer durante o jejum, pare e coma algo.";
  return null;
}
