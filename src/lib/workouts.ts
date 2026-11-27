// Sugestões de treino do dia (seções 4, 5 e 6 da especificação). São sugestões
// gerais: o app não prescreve exercício, e o texto diz isso.

import type { ActivityKind } from "./activity";

export type Exercise = { name: string; dose: string; tip?: string };
export type Workout = {
  title: string;
  minutes: number;
  warmup: string;
  exercises: Exercise[];
  rounds?: string;
  cooldown: string;
  safety: string[];
};

type Ctx = {
  kind: ActivityKind;
  minutes: number;
  location: "gym" | "home_equipment" | "home_none";
  experience: "never" | "stopped" | "current";
  cautious: boolean;
  /** Posição desta sessão de musculação na semana: 0 = treino A, 1 = treino B, 2 = A... */
  strengthIndex: number;
};

const STRENGTH_DOSE = "2 a 3 séries de 8 a 12, parando com 2 ou 3 repetições sobrando";

const STRENGTH: Record<Ctx["location"], [Exercise[], Exercise[]]> = {
  gym: [
    [
      { name: "Leg press", dose: STRENGTH_DOSE, tip: "Joelhos alinhados com os pés; não trave o joelho no fim." },
      { name: "Cadeira flexora", dose: STRENGTH_DOSE },
      { name: "Supino na máquina", dose: STRENGTH_DOSE, tip: "Solte o ar ao empurrar." },
      { name: "Remada sentada", dose: STRENGTH_DOSE, tip: "Puxe com as costas, ombros longe das orelhas." },
      { name: "Prancha", dose: "3 vezes de 20 a 30 segundos", tip: "Nos joelhos, se ficar difícil." },
    ],
    [
      { name: "Cadeira extensora", dose: STRENGTH_DOSE },
      { name: "Ponte de glúteo no colchonete", dose: STRENGTH_DOSE },
      { name: "Desenvolvimento na máquina", dose: STRENGTH_DOSE },
      { name: "Puxada frontal", dose: STRENGTH_DOSE, tip: "Puxe a barra até a altura do queixo, sem balançar." },
      { name: "Abdominal remador", dose: "2 a 3 séries de 10 a 15" },
    ],
  ],
  home_equipment: [
    [
      { name: "Agachamento com halteres", dose: STRENGTH_DOSE, tip: "Pode usar uma cadeira atrás como referência." },
      { name: "Levantamento romeno com halteres", dose: STRENGTH_DOSE, tip: "Costas retas, quadril vai para trás." },
      { name: "Supino no chão com halteres", dose: STRENGTH_DOSE },
      { name: "Remada curvada com halter", dose: STRENGTH_DOSE, tip: "Apoie a mão livre numa cadeira." },
      { name: "Prancha", dose: "3 vezes de 20 a 30 segundos" },
    ],
    [
      { name: "Avanço com apoio na parede", dose: STRENGTH_DOSE },
      { name: "Ponte de glúteo", dose: STRENGTH_DOSE },
      { name: "Desenvolvimento sentado com halteres", dose: STRENGTH_DOSE },
      { name: "Remada com elástico", dose: STRENGTH_DOSE },
      { name: "Dead bug (deitado, braço e perna alternados)", dose: "2 a 3 séries de 8 a 10 de cada lado" },
    ],
  ],
  home_none: [
    [
      { name: "Sentar e levantar da cadeira", dose: STRENGTH_DOSE, tip: "Sem impulso; use as mãos só se precisar." },
      { name: "Ponte de glúteo", dose: STRENGTH_DOSE },
      { name: "Flexão na parede ou na mesa", dose: STRENGTH_DOSE },
      { name: "Remada com mochila ou galões de água", dose: STRENGTH_DOSE, tip: "Apoie uma mão na mesa." },
      { name: "Prancha nos joelhos", dose: "3 vezes de 15 a 30 segundos" },
    ],
    [
      { name: "Agachamento livre até a cadeira", dose: STRENGTH_DOSE },
      { name: "Elevação de panturrilha com apoio", dose: "2 a 3 séries de 12 a 15" },
      { name: "Flexão na mesa", dose: STRENGTH_DOSE },
      { name: "Remada com toalha na maçaneta da porta", dose: STRENGTH_DOSE, tip: "Porta bem fechada e trancada." },
      { name: "Dead bug (deitado, braço e perna alternados)", dose: "2 a 3 séries de 8 a 10 de cada lado" },
    ],
  ],
};

const CALISTHENICS: Record<Ctx["experience"], Exercise[]> = {
  never: [
    { name: "Flexão na parede", dose: "8 a 10" },
    { name: "Sentar e levantar da cadeira", dose: "8 a 10" },
    { name: "Prancha nos joelhos", dose: "15 a 20 segundos" },
    { name: "Ponte de glúteo", dose: "10" },
    { name: "Marcha parada, joelhos altos", dose: "30 segundos" },
  ],
  stopped: [
    { name: "Flexão na mesa ou bancada", dose: "8 a 12" },
    { name: "Agachamento livre", dose: "10 a 12" },
    { name: "Prancha", dose: "20 a 30 segundos" },
    { name: "Abdominal remador", dose: "10 a 12" },
    { name: "Polichinelo sem salto", dose: "30 segundos" },
  ],
  current: [
    { name: "Flexão (nos joelhos, se preciso)", dose: "8 a 12" },
    { name: "Agachamento livre", dose: "12 a 15" },
    { name: "Avanço alternado", dose: "8 de cada perna" },
    { name: "Prancha", dose: "30 a 45 segundos" },
    { name: "Abdominal remador", dose: "12 a 15" },
  ],
};

const SAFETY_BASE =
  "Se sentir dor ou aperto no peito, falta de ar fora do normal, tontura ou coração disparado, pare na hora. Se não passar em poucos minutos, ligue 192 (SAMU).";
const SAFETY_LEGAL = "Sugestão geral. Um profissional de Educação Física pode ajustar ao seu caso.";

export function suggestWorkout(c: Ctx): Workout | null {
  const safety = [SAFETY_BASE];
  if (c.cautious)
    safety.push(
      c.kind === "walk"
        ? "No modo cuidadoso, aumente o tempo aos poucos e só acelere o passo com a liberação do médico."
        : "No modo cuidadoso, mostre este treino ao seu médico e peça liberação antes de começar. Com a liberação, comece pelo número menor de séries.",
    );
  safety.push(SAFETY_LEGAL);

  if (c.kind === "walk") {
    const split = c.minutes > 30 ? ` Se preferir, divida em duas de ${Math.round(c.minutes / 2)} minutos.` : "";
    return {
      title: `Caminhada de ${c.minutes} minutos`,
      minutes: c.minutes,
      warmup: "Comece devagar nos primeiros 5 minutos.",
      exercises: [
        { name: "Ritmo", dose: "Dá para conversar, mas não para cantar", tip: "Cerca de 90 a 110 passos por minuto." },
        { name: "Postura", dose: "Olhar para a frente, braços soltos acompanhando o passo" },
      ],
      cooldown: `Diminua o ritmo nos últimos 5 minutos.${split}`,
      safety,
    };
  }

  if (c.kind === "strength") {
    const ab = c.strengthIndex % 2;
    const list = STRENGTH[c.location][ab];
    return {
      title: `Musculação, treino ${ab === 0 ? "A" : "B"}`,
      minutes: c.minutes,
      warmup: "5 minutos de bicicleta, esteira ou caminhada leve, e uma série leve do primeiro exercício.",
      exercises: c.cautious ? list.map((e) => ({ ...e, dose: e.dose.replace("2 a 3 séries", "2 séries") })) : list,
      cooldown: "Termine com 5 minutos de caminhada leve. Descanse 1 a 2 minutos entre as séries.",
      safety: [
        ...(c.location === "gym" ? ["Nas primeiras semanas, prefira as máquinas: são mais seguras para começar."] : []),
        "Solte o ar no esforço; não prenda a respiração.",
        ...safety,
      ],
    };
  }

  if (c.kind === "calisthenics") {
    return {
      title: "Calistenia em circuito",
      minutes: c.minutes,
      warmup: "5 minutos de aquecimento: marcha parada, giros de ombro e de quadril.",
      exercises: CALISTHENICS[c.experience],
      rounds: c.cautious ? "2 voltas, 30 a 60 segundos de descanso entre os exercícios" : "3 a 4 voltas, 30 segundos de descanso entre os exercícios",
      cooldown: "5 minutos de volta à calma: caminhada leve e alongamento.",
      safety,
    };
  }
  return null;
}
