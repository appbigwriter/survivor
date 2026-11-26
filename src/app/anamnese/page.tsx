import { redirect } from "next/navigation";
import { hasCurrentConsent, requireProfile } from "@/lib/auth";
import { draftFrom } from "@/lib/health/anamnese-steps";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AnamneseWizard } from "./wizard";

export default async function AnamnesePage() {
  const profile = await requireProfile();
  if (!(await hasCurrentConsent())) redirect("/consentimento");

  const supabase = await createSupabaseServerClient();
  const [{ data: weight }, { data: screening }, { data: meds }] = await Promise.all([
    supabase.from("weight_logs").select("weight_kg").order("measured_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("health_screenings").select("answers").maybeSingle(),
    supabase.from("medications").select("name").order("created_at"),
  ]);

  const onboarded = Boolean(profile.onboarding_completed_at);
  const initial = draftFrom({
    ...profile,
    onboarded,
    weightKg: weight ? Number(weight.weight_kg) : null,
    screening: (screening?.answers as Record<string, boolean> | undefined) ?? {},
    medications: (meds ?? []).map((m) => m.name).join("\n"),
  });

  return <AnamneseWizard initial={initial} onboarded={onboarded} name={profile.display_name} />;
}
