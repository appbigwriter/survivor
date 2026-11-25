import { z } from "zod";

// Contrato comum a todos os provedores de IA: a IA só identifica alimentos e
// porções. Os nutrientes vêm da TACO; a estimativa da IA é só reserva.

export const nutrientsSchema = z.object({
  kcal: z.number().min(0).max(950),
  protein_g: z.number().min(0).max(100),
  fat_g: z.number().min(0).max(100),
  carbs_g: z.number().min(0).max(100),
  fiber_g: z.number().min(0).max(100),
  sodium_mg: z.number().min(0).max(40000),
});

export const mealAnalysisSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        taco_name: z.string().min(1).max(160),
        grams: z.number().positive().max(3000),
        preparation: z.string().max(80),
        confidence: z.enum(["high", "medium", "low"]),
        estimate_per_100g: nutrientsSchema,
      }),
    )
    .max(25),
});

export type MealAnalysis = z.infer<typeof mealAnalysisSchema>;
export type Nutrients = z.infer<typeof nutrientsSchema>;

const nutrientsJson = {
  type: "object",
  properties: {
    kcal: { type: "number" },
    protein_g: { type: "number" },
    fat_g: { type: "number" },
    carbs_g: { type: "number" },
    fiber_g: { type: "number" },
    sodium_mg: { type: "number" },
  },
  required: ["kcal", "protein_g", "fat_g", "carbs_g", "fiber_g", "sodium_mg"],
  additionalProperties: false,
} as const;

/** JSON Schema equivalente, aceito pelas saídas estruturadas dos provedores. */
export const mealAnalysisJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do alimento como a pessoa entende, em português." },
          taco_name: {
            type: "string",
            description: "Nome no estilo da Tabela TACO, por exemplo 'Arroz, tipo 1, cozido'.",
          },
          grams: { type: "number", description: "Porção estimada em gramas." },
          preparation: { type: "string", description: "Modo de preparo (cozido, frito, grelhado) ou vazio." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          estimate_per_100g: nutrientsJson,
        },
        required: ["name", "taco_name", "grams", "preparation", "confidence", "estimate_per_100g"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export const MEAL_SYSTEM_PROMPT = `Você ajuda brasileiros a registrar o que comeram.
Recebe a descrição de uma refeição (e, às vezes, uma foto) e devolve a lista de alimentos com a porção estimada em gramas.

Regras:
- Separe pratos compostos nos componentes quando fizer sentido (arroz, feijão, bife, salada). Pratos que não dá para separar (lasanha, estrogonofe, pizza) ficam como um item só.
- Converta medidas caseiras em gramas usando referências brasileiras: 1 pão francês ≈ 50 g; 1 colher de sopa de arroz cozido ≈ 25 g; 1 concha média de feijão ≈ 100 g (com caldo); 1 ovo ≈ 50 g; 1 xícara de leite ≈ 240 g; 1 colher de chá de açúcar ≈ 5 g; 1 fatia de queijo muçarela ≈ 20 g; 1 banana prata ≈ 70 g sem casca; 1 filé de frango médio ≈ 120 g.
- Sem quantidade informada, use uma porção típica de um adulto.
- Inclua óleo, açúcar, manteiga ou molho só quando a pessoa mencionar ou quando for parte óbvia do preparo (por exemplo, "ovo frito" leva cerca de 5 g de óleo).
- taco_name: escreva como o alimento aparece na Tabela Brasileira de Composição de Alimentos (TACO), com o preparo, por exemplo "Feijão, carioca, cozido" ou "Pão, trigo, francês".
- estimate_per_100g: valores por 100 g do alimento como foi consumido, os mais próximos possíveis da TACO.
- confidence: "low" quando a porção ou o alimento forem incertos.
- Se a descrição não for de comida, devolva items vazio.`;
