// Catálogo de remédios usados nas regras de segurança (seção 2.4 da especificação).
// O sistema nunca sugere mudar dose: só ajusta metas e mostra avisos.

export type DrugClass =
  | "thiazide_diuretic"
  | "loop_diuretic"
  | "potassium_sparing_diuretic"
  | "ace_inhibitor"
  | "arb"
  | "calcium_channel_blocker"
  | "beta_blocker"
  | "ssri"
  | "appetite_reducer"
  | "insulin"
  | "sulfonylurea";

export type Drug = {
  id: string;
  label: string;
  classes: DrugClass[];
  aliases: string[];
};

export const DRUGS: Drug[] = [
  // Diuréticos
  { id: "indapamida", label: "Indapamida", classes: ["thiazide_diuretic"], aliases: ["indapamida", "natrilix"] },
  { id: "hidroclorotiazida", label: "Hidroclorotiazida", classes: ["thiazide_diuretic"], aliases: ["hidroclorotiazida", "hctz", "clorana"] },
  { id: "clortalidona", label: "Clortalidona", classes: ["thiazide_diuretic"], aliases: ["clortalidona", "higroton"] },
  { id: "furosemida", label: "Furosemida", classes: ["loop_diuretic"], aliases: ["furosemida", "lasix"] },
  { id: "espironolactona", label: "Espironolactona", classes: ["potassium_sparing_diuretic"], aliases: ["espironolactona", "aldactone"] },
  { id: "amilorida", label: "Amilorida", classes: ["potassium_sparing_diuretic"], aliases: ["amilorida", "moduretic"] },
  // IECA
  { id: "perindopril", label: "Perindopril", classes: ["ace_inhibitor"], aliases: ["perindopril", "coversyl"] },
  { id: "enalapril", label: "Enalapril", classes: ["ace_inhibitor"], aliases: ["enalapril", "renitec"] },
  { id: "captopril", label: "Captopril", classes: ["ace_inhibitor"], aliases: ["captopril", "capoten"] },
  { id: "ramipril", label: "Ramipril", classes: ["ace_inhibitor"], aliases: ["ramipril", "triatec"] },
  { id: "lisinopril", label: "Lisinopril", classes: ["ace_inhibitor"], aliases: ["lisinopril", "zestril", "prinivil"] },
  // BRA
  { id: "losartana", label: "Losartana", classes: ["arb"], aliases: ["losartana", "losartan", "cozaar", "aradois"] },
  { id: "valsartana", label: "Valsartana", classes: ["arb"], aliases: ["valsartana", "diovan"] },
  { id: "olmesartana", label: "Olmesartana", classes: ["arb"], aliases: ["olmesartana", "benicar"] },
  { id: "telmisartana", label: "Telmisartana", classes: ["arb"], aliases: ["telmisartana", "micardis"] },
  { id: "candesartana", label: "Candesartana", classes: ["arb"], aliases: ["candesartana", "atacand"] },
  { id: "irbesartana", label: "Irbesartana", classes: ["arb"], aliases: ["irbesartana", "aprovel"] },
  // Bloqueadores de canal de cálcio
  { id: "anlodipino", label: "Anlodipino", classes: ["calcium_channel_blocker"], aliases: ["anlodipino", "amlodipina", "besilato de anlodipino", "norvasc"] },
  { id: "nifedipino", label: "Nifedipino", classes: ["calcium_channel_blocker"], aliases: ["nifedipino", "adalat"] },
  // Betabloqueadores
  { id: "atenolol", label: "Atenolol", classes: ["beta_blocker"], aliases: ["atenolol", "atenol"] },
  { id: "metoprolol", label: "Metoprolol", classes: ["beta_blocker"], aliases: ["metoprolol", "selozok", "lopressor"] },
  { id: "carvedilol", label: "Carvedilol", classes: ["beta_blocker"], aliases: ["carvedilol", "cardiol", "divelol"] },
  { id: "propranolol", label: "Propranolol", classes: ["beta_blocker"], aliases: ["propranolol"] },
  { id: "bisoprolol", label: "Bisoprolol", classes: ["beta_blocker"], aliases: ["bisoprolol", "concor"] },
  { id: "nebivolol", label: "Nebivolol", classes: ["beta_blocker"], aliases: ["nebivolol", "nebilet"] },
  // ISRS
  { id: "sertralina", label: "Sertralina", classes: ["ssri"], aliases: ["sertralina", "zoloft", "assert", "tolrest"] },
  { id: "fluoxetina", label: "Fluoxetina", classes: ["ssri"], aliases: ["fluoxetina", "prozac", "daforin"] },
  { id: "escitalopram", label: "Escitalopram", classes: ["ssri"], aliases: ["escitalopram", "lexapro", "reconter"] },
  { id: "citalopram", label: "Citalopram", classes: ["ssri"], aliases: ["citalopram", "cipramil"] },
  { id: "paroxetina", label: "Paroxetina", classes: ["ssri"], aliases: ["paroxetina", "paxil", "aropax"] },
  // Reduzem o apetite
  { id: "bupropiona", label: "Bupropiona", classes: ["appetite_reducer"], aliases: ["bupropiona", "wellbutrin", "zetron", "bup"] },
  { id: "semaglutida", label: "Semaglutida", classes: ["appetite_reducer"], aliases: ["semaglutida", "ozempic", "wegovy", "rybelsus"] },
  { id: "tirzepatida", label: "Tirzepatida", classes: ["appetite_reducer"], aliases: ["tirzepatida", "mounjaro", "zepbound"] },
  { id: "liraglutida", label: "Liraglutida", classes: ["appetite_reducer"], aliases: ["liraglutida", "saxenda", "victoza"] },
  // Diabetes com risco de hipoglicemia
  { id: "insulina", label: "Insulina", classes: ["insulin"], aliases: ["insulina", "lantus", "tresiba", "toujeo", "novorapid", "humalog", "fiasp", "basaglar", "nph"] },
  { id: "glibenclamida", label: "Glibenclamida", classes: ["sulfonylurea"], aliases: ["glibenclamida", "daonil"] },
  { id: "gliclazida", label: "Gliclazida", classes: ["sulfonylurea"], aliases: ["gliclazida", "diamicron"] },
  { id: "glimepirida", label: "Glimepirida", classes: ["sulfonylurea"], aliases: ["glimepirida", "amaryl"] },
];

/** Combinações vendidas com nome comercial próprio. */
const COMBINATIONS: Record<string, string[]> = {
  triplixan: ["perindopril", "indapamida", "anlodipino"],
  "coversyl plus": ["perindopril", "indapamida"],
  "bipressin": ["perindopril", "indapamida"],
  "coveram": ["perindopril", "anlodipino"],
  "lotar": ["losartana", "anlodipino"],
  "hyzaar": ["losartana", "hidroclorotiazida"],
  "diovan hct": ["valsartana", "hidroclorotiazida"],
  "diovan amlo": ["valsartana", "anlodipino"],
  "benicar hct": ["olmesartana", "hidroclorotiazida"],
  "benicar anlo": ["olmesartana", "anlodipino"],
  "micardis hct": ["telmisartana", "hidroclorotiazida"],
  "aldazida": ["espironolactona", "hidroclorotiazida"],
};

const DRUG_BY_ID = new Map(DRUGS.map((d) => [d.id, d]));

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWord(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/** Identifica os princípios ativos num texto livre ("Triplixan 10/5/10"). */
export function identifyDrugs(text: string): string[] {
  const n = normalize(text);
  const found = new Set<string>();

  // Combinações mais longas primeiro ("diovan hct" antes de "diovan").
  const combos = Object.keys(COMBINATIONS).sort((a, b) => b.length - a.length);
  let rest = n;
  for (const combo of combos) {
    if (containsWord(rest, combo)) {
      COMBINATIONS[combo].forEach((id) => found.add(id));
      rest = ` ${rest} `.replace(` ${combo} `, " ").trim();
    }
  }

  for (const drug of DRUGS) {
    if (drug.aliases.some((alias) => containsWord(rest, normalize(alias)))) {
      found.add(drug.id);
    }
  }
  return [...found];
}

export function drugLabels(ids: string[]): string[] {
  return ids.map((id) => DRUG_BY_ID.get(id)?.label ?? id);
}

export type MedicationFlags = {
  diuretic: boolean;
  potassiumRisk: boolean;
  antihypertensive: boolean;
  betaBlocker: boolean;
  ssri: boolean;
  appetiteReducer: boolean;
  hypoglycemiaRisk: boolean;
};

export function medicationFlags(drugIds: string[]): MedicationFlags {
  const classes = new Set<DrugClass>();
  for (const id of drugIds) {
    DRUG_BY_ID.get(id)?.classes.forEach((c) => classes.add(c));
  }
  const has = (c: DrugClass) => classes.has(c);
  const diuretic =
    has("thiazide_diuretic") || has("loop_diuretic") || has("potassium_sparing_diuretic");
  return {
    diuretic,
    potassiumRisk:
      (has("ace_inhibitor") || has("arb")) && has("potassium_sparing_diuretic"),
    antihypertensive:
      diuretic ||
      has("ace_inhibitor") ||
      has("arb") ||
      has("calcium_channel_blocker") ||
      has("beta_blocker"),
    betaBlocker: has("beta_blocker"),
    ssri: has("ssri"),
    appetiteReducer: has("appetite_reducer"),
    hypoglycemiaRisk: has("insulin") || has("sulfonylurea"),
  };
}
