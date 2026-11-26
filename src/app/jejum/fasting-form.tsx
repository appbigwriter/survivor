"use client";

import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { eatingWindow, fastingEligibility, formatHHMM, parseHHMM, PROTOCOLS, startLimits, type ProtocolId } from "@/lib/fasting";
import type { FastingAnswers, FastingSettings, KnownFacts } from "@/lib/fasting-server";
import { disableFasting, saveFasting, type DisableState, type FastingState } from "./actions";

const QUESTIONS: { id: keyof FastingAnswers; text: string; notMale?: boolean }[] = [
  { id: "pregnant", text: "Você está grávida ou amamentando?", notMale: true },
  { id: "eatingDisorder", text: "Você já teve anorexia, bulimia ou compulsão alimentar?" },
  { id: "type1Diabetes", text: "Você tem diabetes tipo 1?" },
  { id: "diabetes", text: "Você tem diabetes (de qualquer tipo)?" },
  { id: "glucoseLoweringDrug", text: "Você usa insulina ou algum remédio que pode baixar demais o açúcar do sangue?" },
];

function YesNo({ name, value, onChange }: { name: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {([true, false] as const).map((v) => (
        <label key={String(v)} className="flex-1 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={v ? "yes" : "no"}
            checked={value === v}
            onChange={() => onChange(v)}
            required
            className="peer sr-only"
          />
          <span className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-semibold transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30">
            {v ? "Sim" : "Não"}
          </span>
        </label>
      ))}
    </div>
  );
}

export function FastingForm({ facts, settings }: { facts: KnownFacts; settings: FastingSettings | null }) {
  const [state, action, pending] = useActionState<FastingState, FormData>(saveFasting, {});
  // Controlado: um erro não pode apagar o que já foi respondido.
  const [answers, setAnswers] = useState<Partial<FastingAnswers>>(settings?.answers ?? {});
  const [protocol, setProtocol] = useState<ProtocolId>(settings?.protocol ?? "12:12");
  const [start, setStart] = useState((settings?.eating_start ?? "08:00").slice(0, 5));
  const [clearance, setClearance] = useState(settings?.medical_clearance ?? false);

  const questions = QUESTIONS.filter((q) => !q.notMale || facts.sex !== "male");
  const answered = questions.every((q) => answers[q.id] !== undefined);
  const preview = answered
    ? fastingEligibility({
        ...facts,
        pregnant: Boolean(answers.pregnant),
        eatingDisorder: Boolean(answers.eatingDisorder),
        type1Diabetes: Boolean(answers.type1Diabetes),
        diabetes: Boolean(answers.diabetes || answers.type1Diabetes),
        glucoseLoweringDrug: Boolean(answers.glucoseLoweringDrug),
      })
    : null;
  const startMin = parseHHMM(start);
  const limits = startLimits(protocol);
  const startOk = startMin !== null && startMin >= limits.min && startMin <= limits.max;
  const w = startOk ? eatingWindow(protocol, startMin) : null;

  if (state.blocked) {
    return (
      <div className="pop" role="status">
        <p className="mb-2 text-xl font-bold">Jejum não indicado para você</p>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          {state.blocked.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="text-muted">
          Você pode seguir com o resto do Survivor normalmente: comer dentro da meta funciona do mesmo jeito para emagrecer.
        </p>
      </div>
    );
  }

  return (
    <form action={action}>
      <h3 className="mb-3 text-lg font-semibold">Antes de começar</h3>
      <ol className="mb-6 space-y-5">
        {questions.map((q) => (
          <li key={q.id}>
            <fieldset>
              <legend className="mb-2 font-medium">{q.text}</legend>
              <YesNo name={q.id} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            </fieldset>
          </li>
        ))}
      </ol>

      {preview?.status === "blocked" && (
        <div className="pop mb-6 border-l-4 border-accent py-1 pl-4">
          <p className="mb-1 font-semibold">O jejum não é indicado para você.</p>
          <ul className="list-disc space-y-1 pl-5">
            {preview.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && preview.status !== "blocked" && (
        <>
          <h3 className="mb-3 text-lg font-semibold">Quanto tempo de jejum</h3>
          <div className="mb-6 space-y-2" role="radiogroup" aria-label="Tempo de jejum">
            {PROTOCOLS.map((p) => (
              <label key={p.id} className="block cursor-pointer">
                <input
                  type="radio"
                  name="protocol"
                  value={p.id}
                  checked={protocol === p.id}
                  onChange={() => setProtocol(p.id)}
                  className="peer sr-only"
                />
                <span className="block rounded-xl border border-border bg-surface px-4 py-3 transition peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{p.label}</span>
                    <span className="tabular text-muted">{p.id}</span>
                  </span>
                  <span className="block text-muted">{p.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <label className="mb-2 block">
            <span className="mb-1 block text-lg font-semibold">A que horas você começa a comer?</span>
            <input
              type="time"
              name="eating_start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
              min={formatHHMM(limits.min)}
              max={formatHHMM(limits.max)}
              className="tabular w-40 min-h-12 rounded-xl border border-border bg-surface px-3 text-lg font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </label>
          {!startOk && (
            <p className="mb-4 text-accent">
              Escolha um horário entre {formatHHMM(limits.min)} e {formatHHMM(limits.max)}, para a janela terminar até a meia-noite.
            </p>
          )}
          {w && (
            <p className="mb-6" aria-live="polite">
              Você come das <strong>{formatHHMM(w.start)}</strong> às <strong>{formatHHMM(w.end)}</strong> e fica em jejum das{" "}
              <strong>{formatHHMM(w.end)}</strong> às <strong>{formatHHMM(w.start)}</strong> do dia seguinte.
            </p>
          )}

          {preview.status === "needs_clearance" && (
            <div className="mb-6 border-l-4 border-accent py-1 pl-4">
              <p className="mb-1 font-semibold">Converse com seu médico antes.</p>
              <ul className="mb-3 list-disc space-y-1 pl-5">
                {preview.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="clearance"
                  checked={clearance}
                  onChange={(e) => setClearance(e.target.checked)}
                  className="mt-1 size-6 shrink-0"
                />
                <span>Meu médico sabe dos meus remédios e liberou o jejum.</span>
              </label>
            </div>
          )}
        </>
      )}

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="info">{state.ok}</Notice>}
      <Button type="submit" disabled={pending || !answered} className="w-full">
        {pending
          ? "Salvando…"
          : preview?.status === "blocked"
            ? "Salvar respostas"
            : preview?.status === "needs_clearance" && !clearance
              ? "Salvar sem ativar"
              : "Ativar jejum"}
      </Button>
    </form>
  );
}

export function DisableFastingButton() {
  const [state, action, pending] = useActionState<DisableState, FormData>(() => disableFasting(), {});
  return (
    <form action={action}>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Desativando…" : "Desativar jejum"}
      </Button>
    </form>
  );
}
