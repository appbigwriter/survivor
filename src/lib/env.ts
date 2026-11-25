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
  aiProvider: () => (process.env.AI_PROVIDER ?? "anthropic") as "anthropic" | "openai_compatible",
  aiModel: () => process.env.AI_MODEL ?? "claude-opus-5-5",
  aiBaseUrl: () => process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  aiApiKey: () => process.env.AI_API_KEY ?? null,
  aiDailyLimit: () => Number(process.env.AI_DAILY_LIMIT ?? 15),
};
