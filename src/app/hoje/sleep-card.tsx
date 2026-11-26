"use client";

import Link from "next/link";
import { useActionState, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Notice } from "@/components/ui";
import { formatDuration } from "@/lib/dates";
import { AWAKE_OPTIONS, LATENCY_OPTIONS, nightVerdict, QUALITY_LABELS } from "@/lib/sleep";
import { logSleep, type SleepState } from "../sono/actions";

export type NightSummary = {
  night: string;
  weekday: string;
  bed: string;
  wake: string;
  asleepMin: number;
  inBedMin: number;
  efficiency: number;
  quality: number | null;
  latency: number;
  awake: number;
};

// Como acordou: ruim em âmbar, regular em cinza, boa em verde.
const QUALITY_COLOR = ["var(--accent)", "var(--accent)", "var(--chart-muted)", "var(--primary)", "var(--primary)"];

// Controlado: o React 19 limpa o formulário depois de cada envio, e um erro não
// deve apagar o que a pessoa já escolheu.
function Pills({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly { value: number; label: string }[];
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
            required
          />
          <span className="flex min-h-12 items-center rounded-xl border border-border bg-surface px-4 font-medium transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

function minutesBetween(bed: string, wake: string) {
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  if ([bh, bm, wh, wm].some((n) => Number.isNaN(n))) return null;
  let d = wh * 60 + wm - (bh * 60 + bm);
  if (d <= 0) d += 1440;
  return d;
}

function SleepForm({
  initial,
  defaultNight,
  onSaved,
  onCancel,
}: {
  initial: NightSummary | null;
  defaultNight: "today" | "yesterday";
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState<SleepState, FormData>(async (prev, fd) => {
    const r = await logSleep(prev, fd);
    if (r.ok) onSaved();
    return r;
  }, {});
  const [night, setNight] = useState(defaultNight);
  const [bed, setBed] = useState(initial?.bed ?? "23:00");
  const [wake, setWake] = useState(initial?.wake ?? "07:00");
  const [latency, setLatency] = useState<number | undefined>(initial?.latency ?? 10);
  const [awake, setAwake] = useState<number | undefined>(initial?.awake ?? 0);
  const [quality, setQuality] = useState<number | undefined>(initial?.quality ?? undefined);
  const inBed = minutesBetween(bed, wake);

  return (
    <form action={action}>
      <input type="hidden" name="night" value={night} />
      <div role="radiogroup" aria-label="Qual noite" className="mb-4 flex gap-1 rounded-2xl bg-surface-2 p-1">
        {([
          ["today", "Noite passada"],
          ["yesterday", "Noite anterior"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={night === v}
            onClick={() => setNight(v)}
            className={`min-h-11 flex-1 rounded-lg font-semibold transition ${night === v ? "bg-surface text-foreground ring-1 ring-border" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mb-1 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-medium">Deitei às</span>
          <input
            type="time"
            name="bed"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
            required
            className="tabular w-full min-h-12 rounded-2xl border border-border bg-surface px-2 text-base font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Acordei às</span>
          <input
            type="time"
            name="wake"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            required
            className="tabular w-full min-h-12 rounded-2xl border border-border bg-surface px-2 text-base font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </label>
      </div>
      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {inBed ? `${formatDuration(inBed)} na cama` : " "}
      </p>

      <Question title="Quanto tempo demorou para pegar no sono?">
        <Pills name="latency" options={LATENCY_OPTIONS} value={latency} onChange={setLatency} />
      </Question>
      <Question title="Ficou acordado no meio da noite?">
        <Pills name="awake" options={AWAKE_OPTIONS} value={awake} onChange={setAwake} />
      </Question>
      <Question title="Como você acordou?">
        <Pills
          name="quality"
          options={QUALITY_LABELS.map((label, i) => ({ value: i + 1, label }))}
          value={quality}
          onChange={setQuality}
        />
      </Question>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Salvando…" : "Salvar noite"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

function NightBars({ nights }: { nights: (NightSummary | null)[] }) {
  const maxH = 10 * 60;
  return (
    <div className="flex h-28 items-end justify-between gap-1.5" role="img" aria-label="Horas de sono nas últimas 7 noites">
      {nights.map((n, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative flex h-20 w-full items-end justify-center">
            {/* faixa de 7 a 9 horas */}
            <div className="absolute inset-x-0 rounded bg-surface-2" style={{ bottom: `${(7 * 60 * 100) / maxH}%`, height: `${(2 * 60 * 100) / maxH}%` }} />
            {n ? (
              <div
                className="bar-y relative w-full max-w-5 rounded-md"
                style={{
                  height: `${Math.min(100, (n.asleepMin * 100) / maxH)}%`,
                  background: n.quality ? QUALITY_COLOR[n.quality - 1] : "var(--chart-muted)",
                  transformOrigin: "bottom",
                  "--i": i,
                } as CSSProperties}
                title={`${formatDuration(n.asleepMin)}`}
              />
            ) : (
              <div className="relative h-1 w-1 rounded-full bg-muted/40" />
            )}
          </div>
          <span className="text-sm font-semibold text-muted">{n?.weekday ?? "·"}</span>
        </div>
      ))}
    </div>
  );
}

export function SleepCard({
  today,
  last,
  week,
  insight,
  apnea,
  defaultNight,
}: {
  today: NightSummary | null;
  /** Última noite registrada, para sugerir os horários. */
  last: NightSummary | null;
  week: (NightSummary | null)[];
  insight: string | null;
  apnea: { risk: "low" | "intermediate" | "high"; label: string } | null;
  /** De madrugada, antes de dormir, a noite a registrar é a anterior. */
  defaultNight: "today" | "yesterday";
}) {
  const [editing, setEditing] = useState(false);

  if (!today || editing) {
    return (
      <div>
        {!today && <p className="mb-4 text-muted">Como foi a noite? Leva meio minuto.</p>}
        <SleepForm
          initial={today ?? last}
          defaultNight={defaultNight}
          onSaved={() => setEditing(false)}
          onCancel={today ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const efficiencyPct = Math.round(today.efficiency * 100);
  const verdict = nightVerdict({ asleepMin: today.asleepMin, inBedMin: today.inBedMin, efficiency: today.efficiency });
  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight">{formatDuration(today.asleepMin)}</p>
          <p className="text-sm text-muted">
            dormindo · {today.bed} → {today.wake}
          </p>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="rounded-xl px-2 py-1 text-sm font-semibold text-primary">
          Editar
        </button>
      </div>
      <div className="mb-4 mt-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-border px-3 py-1">
          <strong>{efficiencyPct}%</strong> do tempo na cama dormindo
        </span>
        {today.quality && (
          <span className="rounded-full border border-border px-3 py-1 font-medium">
            Acordou: {QUALITY_LABELS[today.quality - 1].toLowerCase()}
          </span>
        )}
      </div>

      <p className={`mb-4 border-l-4 py-1 pl-4 ${verdict.tone === "good" ? "border-primary" : verdict.tone === "low" ? "border-accent" : "border-border"}`}>
        {verdict.text}
      </p>

      <NightBars nights={week} />
      <p className="mt-2 text-sm text-muted">Faixa cinza: 7 a 9 horas. Verde: acordou bem; âmbar: acordou mal.</p>

      {insight && <p className="rise mt-4 border-l-4 border-primary py-1 pl-4">{insight}</p>}

      <div className="mt-4 border-t border-border pt-3 text-sm">
        {apnea ? (
          <Link href="/sono/apneia" className="flex items-center justify-between gap-3">
            <span>
              Teste de apneia: <strong className={apnea.risk === "high" ? "text-danger" : ""}>{apnea.label}</strong>
            </span>
            <span className="text-primary">ver</span>
          </Link>
        ) : (
          <Link href="/sono/apneia" className="flex items-center justify-between gap-3 font-medium">
            <span>Você ronca ou acorda cansado? Faça o teste de apneia (8 perguntas).</span>
            <span className="shrink-0 text-primary">fazer</span>
          </Link>
        )}
      </div>
    </div>
  );
}
