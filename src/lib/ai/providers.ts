import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import {
  MEAL_SYSTEM_PROMPT,
  mealAnalysisJsonSchema,
  mealAnalysisSchema,
  type MealAnalysis,
} from "./meal-schema";

export type MealInput = {
  text: string;
  image?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };
};

export type AnalysisResult = {
  analysis: MealAnalysis;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export class AiError extends Error {}

export interface MealAnalyzer {
  provider: string;
  model: string;
  analyze(input: MealInput): Promise<AnalysisResult>;
}

function parseAnalysis(raw: string): MealAnalysis {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiError("A IA devolveu uma resposta em formato inválido.");
  }
  const parsed = mealAnalysisSchema.safeParse(json);
  if (!parsed.success) throw new AiError("A IA devolveu uma resposta fora do formato esperado.");
  return parsed.data;
}

// Modelos com fallback no servidor quando o filtro de segurança recusa a resposta.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1"]);

export class AnthropicAnalyzer implements MealAnalyzer {
  provider = "anthropic";
  private client: Anthropic;

  constructor(public model: string, apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : undefined);
  }

  async analyze(input: MealInput): Promise<AnalysisResult> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (input.image) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 },
      });
    }
    content.push({ type: "text", text: input.text || "Identifique os alimentos da foto." });

    const withFallback = FALLBACK_MODELS.has(this.model);
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 8000,
        system: MEAL_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: mealAnalysisJsonSchema as unknown as Record<string, unknown> },
        },
        ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new AiError("Chave da API da Anthropic inválida.");
      if (error instanceof Anthropic.RateLimitError) throw new AiError("Muitos pedidos agora. Tente de novo em um minuto.");
      if (error instanceof Anthropic.APIError) throw new AiError(`Erro no serviço de IA (${error.status}).`);
      throw new AiError("Não foi possível falar com o serviço de IA.");
    }

    if (response.stop_reason === "refusal") throw new AiError("A IA não conseguiu analisar essa descrição.");
    if (response.stop_reason === "max_tokens") throw new AiError("A resposta da IA ficou incompleta. Tente descrever menos itens.");

    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return {
      analysis: parseAnalysis(text),
      provider: this.provider,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

/** OpenAI e qualquer serviço compatível (OpenRouter, Groq, DeepSeek, Gemini, Ollama). */
export class OpenAICompatibleAnalyzer implements MealAnalyzer {
  provider = "openai_compatible";

  constructor(public model: string, private baseUrl: string, private apiKey: string | null) {}

  private async call(input: MealInput, responseFormat: Record<string, unknown>) {
    const userContent: unknown[] = [{ type: "text", text: input.text || "Identifique os alimentos da foto." }];
    if (input.image) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${input.image.mediaType};base64,${input.image.base64}` },
      });
    }
    return fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: `${MEAL_SYSTEM_PROMPT}\n\nResponda só com JSON.` },
          { role: "user", content: userContent },
        ],
        response_format: responseFormat,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  }

  async analyze(input: MealInput): Promise<AnalysisResult> {
    let res: Response;
    try {
      res = await this.call(input, {
        type: "json_schema",
        json_schema: { name: "meal_analysis", schema: mealAnalysisJsonSchema, strict: true },
      });
      // Alguns serviços compatíveis só aceitam o modo JSON simples.
      if (res.status === 400) res = await this.call(input, { type: "json_object" });
    } catch {
      throw new AiError("Não foi possível falar com o serviço de IA.");
    }
    if (res.status === 401 || res.status === 403) throw new AiError("Chave de API inválida.");
    if (res.status === 429) throw new AiError("Muitos pedidos agora. Tente de novo em um minuto.");
    if (!res.ok) throw new AiError(`Erro no serviço de IA (${res.status}).`);

    const body = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text) throw new AiError("A IA devolveu uma resposta vazia.");
    return {
      analysis: parseAnalysis(text),
      provider: this.provider,
      model: body.model ?? this.model,
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
    };
  }
}

/** Analisador do modo padrão do sistema, configurado pelas variáveis de ambiente. */
export function systemAnalyzer(): MealAnalyzer {
  if (env.aiProvider() === "openai_compatible") {
    return new OpenAICompatibleAnalyzer(env.aiModel(), env.aiBaseUrl(), env.aiApiKey());
  }
  return new AnthropicAnalyzer(env.aiModel(), env.aiApiKey() ?? undefined);
}
