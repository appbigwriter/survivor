"use client";

import { useActionState } from "react";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { Profile } from "@/lib/auth";
import { SCREENING_QUESTIONS } from "@/lib/health/screening";
import { saveAnamnese, type AnamneseState } from "./actions";

type Props = {
  profile: Profile;
  currentWeight: number | null;
  screening: Record<string, boolean>;
  medications: string;
};

export function AnamneseForm({ profile: p, currentWeight, screening, medications }: Props) {
  const [state, action, pending] = useActionState<AnamneseState, FormData>(saveAnamnese, {});

  return (
    <form action={action}>
      <Card title="1. Sobre você">
        <Field label="Sexo">
          <Select name="sex" defaultValue={p.sex ?? ""} required>
            <option value="" disabled>Escolha</option>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </Select>
        </Field>
        <Field label="Data de nascimento">
          <Input name="birth_date" type="date" defaultValue={p.birth_date ?? ""} required />
        </Field>
        <Field label="Altura (cm)">
          <Input name="height_cm" type="number" inputMode="decimal" step="0.5" defaultValue={p.height_cm ?? ""} required />
        </Field>
        <Field label="Peso atual (kg)">
          <Input name="weight_kg" type="number" inputMode="decimal" step="0.1" defaultValue={currentWeight ?? ""} required />
        </Field>
        <Field label="Cintura (cm)" hint="Opcional. Meça com fita métrica na altura do umbigo.">
          <Input name="waist_cm" type="number" inputMode="decimal" step="0.5" defaultValue={p.waist_cm ?? ""} />
        </Field>
      </Card>

      <Card title="2. Objetivo">
        <Field label="O que você quer">
          <Select name="goal" defaultValue={p.goal ?? ""} required>
            <option value="" disabled>Escolha</option>
            <option value="lose">Perder peso</option>
            <option value="maintain">Manter o peso</option>
            <option value="gain_muscle">Ganhar massa muscular</option>
            <option value="gain_weight">Ganhar peso</option>
          </Select>
        </Field>
        <Field label="Peso-alvo (kg)">
          <Input name="target_weight_kg" type="number" inputMode="decimal" step="0.1" defaultValue={p.target_weight_kg ?? ""} required />
        </Field>
      </Card>

      <Card title="3. Rotina e treino">
        <Field label="No dia a dia, você">
          <Select name="occupation_activity" defaultValue={p.occupation_activity ?? "sedentary"}>
            <option value="sedentary">Fica mais sentado</option>
            <option value="active">Anda bastante ou trabalha em pé</option>
          </Select>
        </Field>
        <Field label="Minutos de caminhada por dia (planejado)">
          <Input name="walk_minutes_per_day" type="number" inputMode="numeric" defaultValue={p.walk_minutes_per_day ?? 30} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Musculação (vezes por semana)">
            <Input name="strength_sessions_per_week" type="number" inputMode="numeric" min={0} max={7} defaultValue={p.strength_sessions_per_week ?? 0} required />
          </Field>
          <Field label="Minutos por sessão">
            <Input name="strength_minutes_per_session" type="number" inputMode="numeric" defaultValue={p.strength_minutes_per_session ?? 60} required />
          </Field>
          <Field label="Calistenia (vezes por semana)">
            <Input name="calisthenics_sessions_per_week" type="number" inputMode="numeric" min={0} max={7} defaultValue={p.calisthenics_sessions_per_week ?? 0} required />
          </Field>
          <Field label="Minutos por sessão">
            <Input name="calisthenics_minutes_per_session" type="number" inputMode="numeric" defaultValue={p.calisthenics_minutes_per_session ?? 30} required />
          </Field>
        </div>
        <Field label="Onde você treina">
          <Select name="training_location" defaultValue={p.training_location ?? "gym"}>
            <option value="gym">Academia</option>
            <option value="home_equipment">Em casa, com equipamento</option>
            <option value="home_none">Em casa, sem equipamento</option>
          </Select>
        </Field>
        <Field label="Experiência com treino">
          <Select name="training_experience" defaultValue={p.training_experience ?? "never"}>
            <option value="never">Nunca treinei</option>
            <option value="stopped">Já treinei e parei</option>
            <option value="current">Treino hoje</option>
          </Select>
        </Field>
      </Card>

      <Card title="4. Saúde">
        <p className="mb-4 text-muted">Responda sim ou não. Qualquer “sim” deixa o app no modo cauteloso.</p>
        {SCREENING_QUESTIONS.map((q) => (
          <fieldset key={q.id} className="mb-4">
            <legend className="mb-2">{q.text}</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input type="radio" name={`q_${q.id}`} value="yes" defaultChecked={screening[q.id] === true} required className="size-5" /> Sim
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name={`q_${q.id}`} value="no" defaultChecked={screening[q.id] === false} className="size-5" /> Não
              </label>
            </div>
          </fieldset>
        ))}
      </Card>

      <Card title="5. Remédios">
        <Field label="Remédios que você toma" hint="Um por linha, com a dose. Exemplo: Losartana 50 mg. Deixe em branco se não toma nenhum.">
          <Textarea name="medications" defaultValue={medications} rows={5} />
        </Field>
        <label className="flex gap-3">
          <input type="checkbox" name="renal_clearance" defaultChecked={p.renal_clearance} className="mt-1 size-6" />
          <span>
            Meu médico viu meus exames de função renal e liberou proteína alta (2 g por kg).
          </span>
        </label>
      </Card>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Calculando..." : "Calcular minhas metas"}
      </Button>
    </form>
  );
}
