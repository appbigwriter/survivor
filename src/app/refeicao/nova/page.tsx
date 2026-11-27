import { BottomNav, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { addDays, dayRange, MEAL_TYPE_LABEL, minutesOfDay, suggestMealType, todayISO } from "@/lib/dates";
import { formatHHMM, parseHHMM } from "@/lib/fasting";
import { liveFasting, loadFastingContext } from "@/lib/fasting-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MealForm } from "./meal-form";

export default async function NewMealPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const profile = await requireOnboarded();
  // O "+" de cada refeição no painel já chega com o tipo escolhido (?tipo=lunch).
  const tipo = (await searchParams).tipo;
  const type = typeof tipo === "string" && Object.hasOwn(MEAL_TYPE_LABEL, tipo) ? tipo : suggestMealType();
  const today = todayISO();

  const supabase = await createSupabaseServerClient();
  const [fastingCtx, recentRes] = await Promise.all([
    loadFastingContext(profile),
    // A refeição anterior ao horário escolhido mostra quanto tempo de jejum a nova encerra.
    supabase.from("meals").select("eaten_at").gte("eaten_at", dayRange(addDays(today, -2)).from).order("eaten_at"),
  ]);
  const live = liveFasting(fastingCtx);
  const fasting =
    live.active && live.settings
      ? { protocol: live.settings.protocol, startMin: parseHHMM(String(live.settings.eating_start).slice(0, 5)) ?? 480 }
      : null;

  return (
    <Page title="Registrar refeição" back="/hoje">
      <MealForm
        suggestedType={type}
        today={today}
        yesterday={addDays(today, -1)}
        nowHHMM={formatHHMM(minutesOfDay())}
        recentMeals={(recentRes.data ?? []).map((m) => m.eaten_at as string)}
        fasting={fasting}
      />
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
