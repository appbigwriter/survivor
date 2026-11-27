"use client";

import { useActionState, useState } from "react";
import { Button, Notice, Textarea } from "@/components/ui";
import { KIND_LABEL, type ActivityKind } from "@/lib/activity";
import { logActivity, savePlan, type ActivityState } from "./actions";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const EFFORT = [
  { value: "3", label: "Leve", hint: "Conversa fácil" },
  { value: "5", label: "Moderado", hint: "Conversa, sem cantar" },
  { value: "7", label: "Forte", hint: "Frases curtas" },
  { value: "9", label: "Muito forte", hint: "Quase sem falar" },
];

function Pill({ on, children, onClick, label }: { on: boolean; children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`min-h-12 rounded-2xl border-2 px-4 font-semibold transition active:scale-[0.97] ${
        on ? "border-primary bg-primary-soft text-foreground" : "border-border bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

/** Registro de uma sessão: tipo, minutos, esforço e anotação. Já chega com o tipo sugerido. */
export function LogForm({ defaultKind }: { defaultKind: ActivityKind }) {
  // React 19 limpa o formulário depois de salvar: os botões ficam controlados.
  const [kind, setKind] = useState<ActivityKind>(defaultKind);
  const [minutes, setMinutes] = useState("");
  const [effort, setEffort] = useState("");
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [state, action, pending] = useActionState<ActivityState, FormData>(async (prev, fd) => {
    const r = await logActivity(prev, fd);
    // Depois de salvar, limpa minutos e esforço para um segundo toque não duplicar o registro.
    if (r.ok) {
      setMinutes("");
      setEffort("");
    }
    return r;
  }, {});

  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="effort" value={effort} />
      <input type="hidden" name="when" value={when} />

      <p className="mb-2 font-semibold">O que você fez?</p>
      <div role="radiogroup" aria-label="Tipo de atividade" className="mb-4 grid grid-cols-2 gap-2">
        {(Object.keys(KIND_LABEL) as ActivityKind[]).map((k) => (
          <Pill key={k} on={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </Pill>
        ))}
      </div>

      <div className="mb-4">
        <p className="mb-2 font-semibold">Quantos minutos?</p>
        <div className="flex flex-wrap gap-2">
          {["15", "30", "45", "60"].map((m) => (
            <Pill key={m} on={minutes === m} onClick={() => setMinutes(m)} label={`${m} minutos`}>
              {m}
            </Pill>
          ))}
          <input
            name="minutes"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
            placeholder="outro"
            aria-label="Minutos"
            className="min-h-12 w-24 rounded-2xl border-2 border-border bg-surface px-3 text-lg outline-none focus:border-primary"
          />
        </div>
      </div>

      <p className="mb-2 font-semibold">Como foi o esforço? <span className="font-normal text-muted">(opcional)</span></p>
      <div role="radiogroup" aria-label="Esforço" className="mb-4 grid grid-cols-2 gap-2">
        {EFFORT.map((e) => (
          <button
            key={e.value}
            type="button"
            role="radio"
            aria-checked={effort === e.value}
            onClick={() => setEffort(effort === e.value ? "" : e.value)}
            className={`min-h-14 rounded-2xl border-2 px-3 py-2 text-left transition active:scale-[0.97] ${
              effort === e.value ? "border-primary bg-primary-soft" : "border-border bg-surface"
            }`}
          >
            <span className="block font-semibold">{e.label}</span>
            <span className="block text-sm text-muted">{e.hint}</span>
          </button>
        ))}
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block font-semibold">Anotação <span className="font-normal text-muted">(opcional)</span></span>
        <Textarea name="notes" rows={2} placeholder="Ex.: leg press com 40 kg" maxLength={500} />
      </label>

      <div role="radiogroup" aria-label="Quando" className="mb-4 grid grid-cols-2 gap-2">
        <Pill on={when === "today"} onClick={() => setWhen("today")}>
          Hoje
        </Pill>
        <Pill on={when === "yesterday"} onClick={() => setWhen("yesterday")}>
          Ontem
        </Pill>
      </div>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && (
        <p role="status" className="pop mb-3 font-semibold text-primary">
          ✓ {state.ok}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando…" : "Registrar atividade"}
      </Button>
    </form>
  );
}

/** Plano da semana: dias de musculação e de calistenia, e minutos de caminhada por dia. */
export function PlanForm({ strengthDays, calisthenicsDays, walkMinutes }: { strengthDays: number[]; calisthenicsDays: number[]; walkMinutes: number }) {
  const [state, action, pending] = useActionState<ActivityState, FormData>(savePlan, {});
  const [strength, setStrength] = useState(strengthDays);
  const [cal, setCal] = useState(calisthenicsDays);
  const [walk, setWalk] = useState(String(walkMinutes));
  const toggle = (list: number[], d: number) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]);

  const Row = ({ title, list, other, onToggle }: { title: string; list: number[]; other: number[]; onToggle: (d: number) => void }) => (
    <fieldset className="mb-4">
      <legend className="mb-2 font-semibold">{title}</legend>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((name, d) => {
          const on = list.includes(d);
          const taken = other.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={`${title}: ${name}`}
              onClick={() => onToggle(d)}
              className={`min-h-12 rounded-xl border-2 text-sm font-semibold transition active:scale-95 ${
                on ? "border-primary bg-primary text-primary-foreground" : taken ? "border-border bg-surface-2 text-muted" : "border-border bg-surface"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <form action={action}>
      {strength.map((d) => (
        <input key={`s${d}`} type="hidden" name="strength_days" value={d} />
      ))}
      {cal.map((d) => (
        <input key={`c${d}`} type="hidden" name="calisthenics_days" value={d} />
      ))}
      <input type="hidden" name="walk_minutes" value={walk} />

      {Row({ title: "Musculação", list: strength, other: cal, onToggle: (d) => setStrength(toggle(strength, d)) })}
      {Row({ title: "Calistenia", list: cal, other: strength, onToggle: (d) => setCal(toggle(cal, d)) })}

      <p className="mb-2 font-semibold">Caminhada, todos os dias</p>
      <div role="radiogroup" aria-label="Minutos de caminhada" className="mb-4 flex flex-wrap gap-2">
        {[...new Set(["0", "20", "30", "45", "60", "90", String(walkMinutes)])].sort((a, b) => Number(a) - Number(b)).map((m) => (
          <Pill key={m} on={walk === m} onClick={() => setWalk(m)}>
            {m === "0" ? "Nenhuma" : `${m} min`}
          </Pill>
        ))}
      </div>
      <p className="mb-4 text-sm text-muted">Deixe ao menos um dia por semana sem musculação nem calistenia para o corpo descansar.</p>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && (
        <p role="status" className="pop mb-3 font-semibold text-primary">
          ✓ {state.ok}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Salvando…" : "Salvar plano"}
      </Button>
    </form>
  );
}
