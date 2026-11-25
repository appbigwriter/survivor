"use client";

import { useActionState } from "react";
import { Button, Input, Notice, Select } from "@/components/ui";
import { logBloodPressure, logSteps, logSymptom, logWeight, type LogState } from "./actions";

function Result({ state }: { state: LogState }) {
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.ok) return <Notice tone="info">{state.ok}</Notice>;
  return null;
}

export function WeightForm() {
  const [state, action, pending] = useActionState<LogState, FormData>(logWeight, {});
  return (
    <form action={action}>
      <div className="flex gap-2">
        <Input name="weight_kg" inputMode="decimal" placeholder="Peso em kg" aria-label="Peso em kg" required />
        <Button type="submit" disabled={pending}>Salvar</Button>
      </div>
      <div className="mt-2"><Result state={state} /></div>
    </form>
  );
}

export function StepsForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState<LogState, FormData>(logSteps, {});
  return (
    <form action={action}>
      <div className="flex gap-2">
        <Input
          name="steps"
          type="number"
          inputMode="numeric"
          defaultValue={current ?? ""}
          placeholder="Passos de hoje"
          aria-label="Passos de hoje"
          required
        />
        <Button type="submit" disabled={pending}>Salvar</Button>
      </div>
      <p className="mt-1 text-sm text-muted">Veja o número no app Saúde do iPhone (ou no app do seu celular).</p>
      <div className="mt-2"><Result state={state} /></div>
    </form>
  );
}

export function BloodPressureForm() {
  const [state, action, pending] = useActionState<LogState, FormData>(logBloodPressure, {});
  return (
    <form action={action}>
      <div className="grid grid-cols-3 gap-2">
        <Input name="systolic" type="number" inputMode="numeric" placeholder="Máx." aria-label="Pressão máxima (ex.: 120)" required />
        <Input name="diastolic" type="number" inputMode="numeric" placeholder="Mín." aria-label="Pressão mínima (ex.: 80)" required />
        <Input name="pulse" type="number" inputMode="numeric" placeholder="Pulso" aria-label="Pulso (opcional)" />
      </div>
      <p className="mt-1 text-sm text-muted">Exemplo: 12 por 8 é máxima 120 e mínima 80.</p>
      <Button type="submit" disabled={pending} className="mt-2 w-full">Salvar pressão</Button>
      <div className="mt-2"><Result state={state} /></div>
    </form>
  );
}

export function SymptomForm() {
  const [state, action, pending] = useActionState<LogState, FormData>(logSymptom, {});
  return (
    <form action={action}>
      <Select name="kind" defaultValue="" required aria-label="Sintoma">
        <option value="" disabled>O que você sentiu?</option>
        <option value="dizziness">Tontura</option>
        <option value="fatigue">Cansaço fora do normal</option>
        <option value="nausea">Enjoo</option>
        <option value="headache">Dor de cabeça</option>
        <option value="pain">Dor</option>
        <option value="other">Outro</option>
      </Select>
      <Input name="note" placeholder="Observação (opcional)" className="mt-2" maxLength={500} />
      <Button type="submit" variant="secondary" disabled={pending} className="mt-2 w-full">Registrar</Button>
      <div className="mt-2"><Result state={state} /></div>
    </form>
  );
}
