import { BottomNav, Card, LinkButton, Notice, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { getCurrentGoal } from "@/lib/data";
import { drugLabels } from "@/lib/health/medications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fmt = (n: number) => n.toLocaleString("pt-BR");

export default async function GoalsPage() {
  const profile = await requireOnboarded();
  const goal = await getCurrentGoal();
  const supabase = await createSupabaseServerClient();
  const { data: meds } = await supabase.from("medications").select("name, drug_ids").order("created_at");

  if (!goal) {
    return (
      <Page title="Minhas metas">
        <LinkButton href="/anamnese">Fazer a anamnese</LinkButton>
      </Page>
    );
  }

  const d = goal.details;
  const unknown = (meds ?? []).filter((m) => m.drug_ids.length === 0);
  const known = (meds ?? []).filter((m) => m.drug_ids.length > 0);

  return (
    <Page title="Minhas metas diárias">
      <Card>
        <dl className="grid grid-cols-2 gap-y-3 text-lg">
          <dt>Calorias</dt>
          <dd className="text-right font-bold">{fmt(goal.kcal)} kcal</dd>
          <dt>Proteína</dt>
          <dd className="text-right font-bold">{goal.protein_g} g</dd>
          <dt>Gordura</dt>
          <dd className="text-right font-bold">{goal.fat_g} g</dd>
          <dt>Carboidrato</dt>
          <dd className="text-right font-bold">{goal.carbs_g} g</dd>
          <dt>Fibra</dt>
          <dd className="text-right font-bold">{goal.fiber_g} g</dd>
          <dt>Água</dt>
          <dd className="text-right font-bold">
            {goal.water_ml ? `${(goal.water_ml / 1000).toLocaleString("pt-BR")} litros` : "conforme seu médico"}
          </dd>
          <dt>Sódio</dt>
          <dd className="text-right font-bold">
            {goal.sodium_mg ? `até ${fmt(goal.sodium_mg)} mg` : "conforme seu médico"}
          </dd>
        </dl>
      </Card>

      <Card title="De onde vêm esses números">
        <ul className="list-disc space-y-2 pl-5">
          {d.bmr && <li>Metabolismo basal (gasto em repouso): {fmt(d.bmr)} kcal.</li>}
          {d.tdee && (
            <li>
              Gasto total estimado, com a atividade planejada: {fmt(d.tdee)} kcal
              {d.exerciseKcal ? `, dos quais ${fmt(d.exerciseKcal)} kcal vêm dos exercícios` : ""}.
            </li>
          )}
          {d.proteinPerKg && d.proteinRefWeightKg && (
            <li>
              Proteína: {d.proteinPerKg.toLocaleString("pt-BR")} g × {d.proteinRefWeightKg} kg.
            </li>
          )}
          <li>Carboidrato: o que sobra das calorias depois de proteína e gordura.</li>
          {d.weeklyChangeRangePct && profile.goal !== "maintain" && (
            <li>
              Ritmo esperado: {d.weeklyChangeRangePct.map((v) => Math.abs(v).toLocaleString("pt-BR")).join(" a ")}% do
              peso por semana.
            </li>
          )}
        </ul>
        <p className="mt-3 text-muted">
          A estimativa de gasto erra para mais ou para menos. Depois de 14 dias de registro, o app
          passa a ajustar a meta pela tendência real do seu peso.
        </p>
      </Card>

      {d.warnings && d.warnings.length > 0 && (
        <Card title="Avisos para você">
          {d.warnings.map((w) => (
            <Notice key={w}>{w}</Notice>
          ))}
        </Card>
      )}

      {(known.length > 0 || unknown.length > 0) && (
        <Card title="Remédios informados">
          <ul className="space-y-1">
            {known.map((m) => (
              <li key={m.name}>
                {m.name} <span className="text-muted">({drugLabels(m.drug_ids).join(", ")})</span>
              </li>
            ))}
            {unknown.map((m) => (
              <li key={m.name}>
                {m.name} <span className="text-muted">(não reconhecido: nenhuma regra aplicada)</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {d.cautious && (
        <Notice>
          Você está no modo cauteloso. Antes de começar os treinos, mostre estas metas ao seu
          médico e peça liberação para atividade física.
        </Notice>
      )}

      <div className="flex flex-col gap-3">
        <LinkButton href="/hoje">Ir para o dia de hoje</LinkButton>
        <LinkButton href="/anamnese" variant="secondary">Atualizar meus dados</LinkButton>
      </div>
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
