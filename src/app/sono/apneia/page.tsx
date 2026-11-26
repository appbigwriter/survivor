import { BottomNav, Card, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { formatDateTime, todayISO } from "@/lib/dates";
import { medicationFlags } from "@/lib/health/medications";
import { RISK_TEXT, type StopBangAnswers } from "@/lib/sleep";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StopBangForm } from "./stop-bang-form";

function ageOn(birth: string, today: string) {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export default async function ApneaPage() {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const [weightRes, medsRes, screeningRes, lastRes] = await Promise.all([
    supabase.from("weight_logs").select("weight_kg").order("measured_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("medications").select("drug_ids"),
    supabase.from("health_screenings").select("answers").maybeSingle(),
    supabase
      .from("sleep_screenings")
      .select("score, risk, taken_at")
      .eq("kind", "stop_bang")
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // O que o app já sabe vem marcado; a pessoa pode mudar.
  const prefill: Partial<StopBangAnswers> = {};
  if (profile.birth_date) prefill.age = ageOn(profile.birth_date, todayISO()) > 50;
  if (profile.sex) prefill.male = profile.sex === "male";
  const weight = weightRes.data ? Number(weightRes.data.weight_kg) : null;
  if (weight && profile.height_cm) {
    const h = Number(profile.height_cm) / 100;
    prefill.bmi = weight / (h * h) > 35;
  }
  const drugIds = (medsRes.data ?? []).flatMap((m) => m.drug_ids as string[]);
  const answers = (screeningRes.data?.answers ?? {}) as Record<string, boolean>;
  if (medicationFlags(drugIds).antihypertensive) prefill.pressure = true;

  const last = lastRes.data;

  return (
    <Page title="Teste de apneia do sono" subtitle="Questionário STOP-Bang" back="/hoje">
      {last && (
        <Card index={0}>
          <p className="text-sm text-muted">Último resultado, em {formatDateTime(last.taken_at)}</p>
          <p className="text-xl font-bold">
            {RISK_TEXT[last.risk as keyof typeof RISK_TEXT].title} · {last.score} de 8
          </p>
        </Card>
      )}
      <Card index={1}>
        <p className="mb-5 text-muted">
          Apneia é quando a respiração para várias vezes durante o sono. É comum em quem tem sobrepeso e pressão alta, muitas
          vezes passa despercebida e pode atrapalhar o emagrecimento. São 8 perguntas de sim ou não
          {answers.heart_or_bp && !prefill.pressure ? "; na anamnese você contou que tem problema de coração ou pressão" : ""}.
        </p>
        <StopBangForm prefill={prefill} />
      </Card>
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
