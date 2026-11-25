function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseAnonKey: () => required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  bootstrapAdminEmail: () => process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null,
  // Com só OPENAI_API_KEY definida, o modo padrão usa a OpenAI.
  aiProvider: () =>
    (process.env.AI_PROVIDER ?? (process.env.OPENAI_API_KEY && !process.env.AI_API_KEY ? "openai_compatible" : "anthropic")) as
      | "anthropic"
      | "openai_compatible",
  aiModel: () => process.env.AI_MODEL ?? (env.aiProvider() === "anthropic" ? "claude-opus-5-5" : required("AI_MODEL")),
  aiBaseUrl: () => process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  aiApiKey: () => process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? null,
  aiDailyLimit: () => Number(process.env.AI_DAILY_LIMIT ?? 15),
};
