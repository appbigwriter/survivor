"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { CONSENT_VERSION } from "@/lib/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function acceptConsent(formData: FormData) {
  const profile = await requireProfile();
  if (formData.get("terms") !== "on" || formData.get("health") !== "on") {
    redirect("/consentimento");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.from("consents").upsert(
    [
      { user_id: profile.id, kind: "terms", version: CONSENT_VERSION },
      { user_id: profile.id, kind: "health_data", version: CONSENT_VERSION },
    ],
    { onConflict: "user_id,kind,version", ignoreDuplicates: true },
  );
  redirect(profile.onboarding_completed_at ? "/hoje" : "/anamnese");
}
