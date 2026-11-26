"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { RISK_TEXT, STOP_BANG, type StopBangAnswers } from "@/lib/sleep";
import { saveStopBang, type StopBangState } from "../actions";

const HELP: Partial<Record<keyof StopBangAnswers, string>> = {
  neck: "Use uma fita métrica. Sem fita: colarinho de camisa número 42 ou maior conta como sim.",
  bmi: "Calculado com sua altura e o último peso registrado.",
  pressure: "Conta como sim se você toma remédio para pressão.",
};

export function StopBangForm({ prefill }: { prefill: Partial<StopBangAnswers> }) {
  const [state, action, pending] = useActionState<StopBangState, FormData>(saveStopBang, {});
  // Controlado: um erro ao salvar não pode apagar as 8 respostas.
  const [answers, setAnswers] = useState<Partial<StopBangAnswers>>(prefill);

  if (state.risk) {
    const r = RISK_TEXT[state.risk];
    return (
      <div className="pop">
        <div
          className={`mb-4 rounded-3xl p-5 ${
            state.risk === "high" ? "bg-warning-bg text-warning-fg" : state.risk === "intermediate" ? "bg-surface-2" : "bg-primary-soft"
          }`}
          role="status"
        >
          <p className="text-sm font-semibold uppercase tracking-wide opacity-80">{state.score} de 8 pontos</p>
          <p className="mb-2 text-2xl font-bold">{r.title}</p>
          <p>{r.text}</p>
        </div>
        <p className="mb-4 text-sm text-muted">
          Este questionário não dá diagnóstico: ele só indica quem deve ser avaliado. Quem confirma apneia é o exame do sono.
        </p>
        <Link href="/hoje" className="font-semibold text-primary">
          Voltar para Hoje
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <ol className="mb-4 space-y-5">
        {STOP_BANG.map((q, i) => (
          <li key={q.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
            <fieldset>
              <legend className="mb-2 font-medium">
                <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-muted">
                  {q.short}
                </span>
                {q.text}
              </legend>
              {HELP[q.id] && <p className="mb-2 text-sm text-muted">{HELP[q.id]}</p>}
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((v) => (
                  <label key={v} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      value={v}
                      required
                      checked={answers[q.id] !== undefined && answers[q.id] === (v === "yes")}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: v === "yes" }))}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-12 items-center justify-center rounded-2xl border border-border bg-surface font-semibold transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30">
                      {v === "yes" ? "Sim" : "Não"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Calculando…" : "Ver resultado"}
      </Button>
    </form>
  );
}
