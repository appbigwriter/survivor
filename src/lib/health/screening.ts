// Triagem de saúde baseada no PAR-Q+ (seção 2.3 da especificação).
export const SCREENING_QUESTIONS = [
  { id: "heart_or_bp", text: "Algum médico já disse que você tem problema no coração ou pressão alta?" },
  { id: "chest_pain", text: "Você sente dor no peito em repouso ou ao fazer esforço?" },
  { id: "dizziness", text: "Você perdeu o equilíbrio por tontura ou desmaiou nos últimos 12 meses?" },
  { id: "chronic_disease", text: "Você tem outra doença crônica (diabetes, osteoporose, doença pulmonar, etc.)?" },
  { id: "kidney_disease", text: "Algum médico já disse que você tem doença nos rins?" },
  { id: "heart_bp_diabetes_meds", text: "Você toma remédio para pressão, diabetes ou coração?" },
  { id: "joint_problem", text: "Você tem problema de articulação, coluna ou osso que piora com exercício?" },
  { id: "supervised_only", text: "Algum médico disse que você só deve fazer atividade física com supervisão?" },
] as const;

export type ScreeningId = (typeof SCREENING_QUESTIONS)[number]["id"];
export type ScreeningAnswers = Record<ScreeningId, boolean>;

export const CAUTIOUS_AGE = 60;

export function isCautiousMode(answers: ScreeningAnswers, ageYears: number): boolean {
  return ageYears >= CAUTIOUS_AGE || Object.values(answers).some(Boolean);
}
