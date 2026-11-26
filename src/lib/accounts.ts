import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// O Supabase pode ser compartilhado com outros apps: o mesmo login (auth.users)
// serve a todos. O Survivor só apaga ou bloqueia um login que ele mesmo criou,
// marcado em app_metadata (que o próprio usuário não consegue alterar).
export const SURVIVOR_CREATED = { survivor_created: true } as const;

export async function isSurvivorCreatedLogin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.app_metadata?.survivor_created === true;
}

// Tabelas do Survivor com user_id, na ordem em que podem ser apagadas.
const USER_TABLES = [
  "meal_items",
  "meals",
  "ai_usage",
  "fasting_settings",
  "sleep_screenings",
  "sleep_logs",
  "symptom_logs",
  "bp_logs",
  "step_logs",
  "weight_logs",
  "goals",
  "medications",
  "health_screenings",
  "consents",
] as const;

/** Tabela que ainda não existe porque a migração dela não rodou. */
export function isMissingTable(error: { code?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01";
}

/** Apaga todos os dados do Survivor de uma pessoa, sem tocar no login. */
export async function deleteSurvivorData(admin: SupabaseClient, userId: string): Promise<boolean> {
  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error && !isMissingTable(error)) return false;
  }
  await admin.from("invites").update({ created_by: null }).eq("created_by", userId);
  await admin.from("profiles").update({ invited_by: null }).eq("invited_by", userId);
  const { error } = await admin.from("profiles").delete().eq("id", userId);
  return !error;
}
