import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONSENT_VERSION } from "@/lib/consent";

export type Profile = {
  id: string;
  display_name: string;
  role: "member" | "admin";
  active: boolean;
  sex: "male" | "female" | null;
  birth_date: string | null;
  height_cm: number | null;
  waist_cm: number | null;
  goal: "lose" | "maintain" | "gain_muscle" | "gain_weight" | null;
  target_weight_kg: number | null;
  occupation_activity: "sedentary" | "active" | null;
  walk_minutes_per_day: number | null;
  strength_sessions_per_week: number | null;
  strength_minutes_per_session: number | null;
  calisthenics_sessions_per_week: number | null;
  calisthenics_minutes_per_session: number | null;
  training_location: "gym" | "home_equipment" | "home_none" | null;
  training_experience: "never" | "stopped" | "current" | null;
  renal_clearance: boolean;
  onboarding_completed_at: string | null;
  last_seen_at: string | null;
};

/** Usuário logado e validado no servidor de autenticação, ou null. */
export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

export const hasCurrentConsent = cache(async (): Promise<boolean> => {
  const user = await getAuthUser();
  if (!user) return false;
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("version", CONSENT_VERSION);
  return (count ?? 0) >= 2;
});

/** Exige login e conta ativa. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/entrar");
  if (!profile.active) redirect("/entrar?desativada=1");
  return profile;
}

/** Exige login, consentimento e anamnese concluída. */
export async function requireOnboarded(): Promise<Profile> {
  const profile = await requireProfile();
  if (!(await hasCurrentConsent())) redirect("/consentimento");
  if (!profile.onboarding_completed_at) redirect("/anamnese");
  await touchLastSeen(profile);
  return profile;
}

/** Marca o último acesso (no máximo uma vez por hora), para o resumo do admin. */
async function touchLastSeen(profile: Profile) {
  const last = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  if (Date.now() - last < 60 * 60 * 1000) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id);
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/hoje");
  return profile;
}
