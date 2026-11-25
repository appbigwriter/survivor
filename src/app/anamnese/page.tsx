import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/ui";
import { hasCurrentConsent, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AnamneseForm } from "./anamnese-form";

export default async function AnamnesePage() {
  const profile = await requireProfile();
  if (!(await hasCurrentConsent())) redirect("/consentimento");

  const supabase = await createSupabaseServerClient();
  const [{ data: weight }, { data: screening }, { data: meds }] = await Promise.all([
    supabase.from("weight_logs").select("weight_kg").order("measured_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("health_screenings").select("answers").maybeSingle(),
    supabase.from("medications").select("name").order("created_at"),
  ]);

  return (
    <Page title={profile.onboarding_completed_at ? "Atualizar meus dados" : `Olá, ${profile.display_name}`} back={profile.onboarding_completed_at ? "/metas" : undefined}>
      {!profile.onboarding_completed_at && (
        <p className="mb-6 text-muted">
          Responda com calma. Com essas informações o Survivor calcula suas metas diárias e liga os
          avisos de segurança certos para você.
        </p>
      )}
      <AnamneseForm
        profile={profile}
        currentWeight={weight?.weight_kg ?? null}
        screening={(screening?.answers as Record<string, boolean> | undefined) ?? {}}
        medications={(meds ?? []).map((m) => m.name).join("\n")}
      />
      {!profile.onboarding_completed_at && (
        <p className="mt-4 text-center">
          <Link href="/conta" className="text-muted underline">Sair ou apagar minha conta</Link>
        </p>
      )}
    </Page>
  );
}
