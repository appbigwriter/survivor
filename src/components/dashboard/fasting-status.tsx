"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { formatDuration, formatTime, minutesOfDay } from "@/lib/dates";
import {
  eatingWindow,
  fastingNow,
  formatHHMM,
  MAX_PLAUSIBLE_FAST_H,
  phasesFor,
  protocolById,
  type FastDay,
  type ProtocolId,
} from "@/lib/fasting";
import { Arc } from "./arc";

const hoursText = (h: number) => h.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const WEEKDAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Jejum do dia: em jejum, o arco mostra as horas desde a última refeição contra
 * a meta; com a janela aberta, mostra o jejum que terminou hoje de manhã. As
 * marcas no arco são as fases, e embaixo vem a constância dos últimos 7 dias.
 * Atualiza a cada 30 s pelo relógio do aparelho.
 */
export function FastingStatus({
  protocol,
  startMin,
  lastMealAt,
  lastMealStartsFast = false,
  serverNowMin,
  serverSinceMin,
  todayFastH,
  stats,
}: {
  protocol: ProtocolId;
  startMin: number;
  lastMealAt: string | null;
  /** A última refeição foi marcada como a última do dia: o jejum já começou. */
  lastMealStartsFast?: boolean;
  serverNowMin: number;
  serverSinceMin: number | null;
  /** Jejum que terminou com a primeira refeição de hoje, em horas (null se ainda não comeu hoje). */
  todayFastH: number | null;
  stats: { last7: FastDay[]; onTarget7: number; measured7: number; streak: number; avg7: number | null };
}) {
  const [now, setNow] = useState({ min: serverNowMin, since: serverSinceMin });

  useEffect(() => {
    const tick = () =>
      setNow({ min: minutesOfDay(), since: lastMealAt ? (Date.now() - Date.parse(lastMealAt)) / 60000 : null });
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [lastMealAt]);

  const p = protocolById(protocol);
  const f = fastingNow(now.min, now.since, protocol, startMin, lastMealStartsFast);
  const w = eatingWindow(protocol, startMin);
  const phases = phasesFor(p.fastH);

  // Muito tempo sem refeição registrada: provavelmente esqueceu de registrar.
  if (f.sinceMealMin !== null && f.sinceMealMin > MAX_PLAUSIBLE_FAST_H * 60) {
    return (
      <div aria-live="polite">
        <p className="mb-2 text-xl font-bold">Faz mais de {MAX_PLAUSIBLE_FAST_H} horas sem refeição registrada</p>
        <p className="text-muted">
          Você registrou suas refeições? Se está mesmo há tanto tempo sem comer, coma algo agora: o jejum do app nunca passa de 16
          horas.
        </p>
      </div>
    );
  }

  const fasting = f.phase === "fasting";
  // Em jejum: horas desde a última refeição. Na janela: o jejum que terminou hoje.
  const hours = fasting ? (f.sinceMealMin ?? 0) / 60 : (todayFastH ?? 0);
  const reached = hours >= p.fastH;
  const done = phases.filter((ph) => hours >= ph.h);
  const nextPhase = phases.find((ph) => hours < ph.h);

  return (
    <div>
      <Arc
        value={hours / p.fastH}
        label={`${hoursText(hours)} de ${p.fastH} horas de jejum`}
        marks={phases.map((ph) => ({ at: ph.h / p.fastH, reached: hours >= ph.h }))}
      >
        <p className="text-[2.3rem] font-bold leading-none tracking-tight">
          {fasting ? (f.sinceMealMin !== null ? formatDuration(f.sinceMealMin) : "—") : todayFastH !== null ? formatDuration(todayFastH * 60) : "—"}
        </p>
        <p className="mt-1 font-medium text-muted">{fasting ? "em jejum" : "jejum de hoje"}</p>
      </Arc>

      <div className="mb-5 flex justify-between px-1">
        <div>
          <p className="tabular text-xl font-bold">{p.fastH} h</p>
          <p className="text-sm text-muted">Meta</p>
        </div>
        <div className="text-right">
          <p className="tabular text-xl font-bold">{f.reason === "window" || f.reason === "waiting" ? formatHHMM(w.start) : f.reason === "closed" && lastMealAt ? formatTime(lastMealAt) : formatHHMM(w.end)}</p>
          <p className="text-sm text-muted">
            {f.reason === "window"
              ? `Janela abre em ${formatDuration(f.untilChangeMin)}`
              : f.reason === "waiting"
                ? "Janela aberta"
                : f.reason === "closed"
                  ? "Você encerrou o dia"
                  : `Janela fecha em ${formatDuration(f.untilChangeMin)}`}
          </p>
        </div>
      </div>

      <p className="mb-2 font-semibold">{fasting ? "Fases de agora" : "Fases conquistadas hoje"}</p>
      <ul className="mb-5 space-y-2">
        {phases.map((ph, i) => {
          const ok = hours >= ph.h;
          const isNext = ph === nextPhase;
          return (
            <li key={ph.h} className={`flex items-start gap-3 ${ok || isNext ? "" : "opacity-55"}`}>
              <span
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  ok ? "pop bg-primary text-primary-foreground" : "border-2 border-border text-muted"
                }`}
                style={{ "--i": 30 + i * 8 } as CSSProperties}
                aria-hidden
              >
                {ok ? "✓" : ph.h}
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">
                  {ph.title} <span className="font-normal text-muted">· {ph.h} h</span>
                </p>
                <p className="text-sm text-muted">
                  {ok ? ph.text : isNext && fasting ? `Faltam ${formatDuration((ph.h - hours) * 60)}.` : ph.text}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {reached && fasting && <p className="mb-5 border-l-4 border-primary py-1 pl-4">Meta cumprida. Se tiver fome antes da janela abrir, pode comer.</p>}
      {f.reason === "waiting" && !reached && (
        <p className="mb-5 text-muted">A janela já abriu. O jejum termina quando você registrar a primeira refeição.</p>
      )}
      {!fasting && done.length === 0 && todayFastH === null && (
        <p className="mb-5 text-muted">O jejum de hoje aparece quando você registrar a primeira refeição do dia.</p>
      )}

      <FastingWeek stats={stats} target={p.fastH} />
      <p className="mt-3 text-sm text-muted">As fases são aproximadas e variam de pessoa para pessoa.</p>
    </div>
  );
}

function FastingWeek({ stats, target }: { stats: { last7: FastDay[]; onTarget7: number; measured7: number; streak: number; avg7: number | null }; target: number }) {
  const max = Math.max(target * 1.3, ...stats.last7.map((d) => d.hours ?? 0));
  const targetY = 100 - (target / max) * 100;
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={`${stats.onTarget7}/7`} label="dias na meta" />
        <Stat value={String(stats.streak)} label={stats.streak === 1 ? "dia seguido" : "dias seguidos"} />
        <Stat value={stats.avg7 !== null ? `${hoursText(stats.avg7)} h` : "—"} label="média" />
      </div>
      <div className="relative h-20" aria-hidden>
        <div className="absolute inset-x-0 border-t border-dashed border-muted/50" style={{ top: `${targetY}%` }} />
        <div className="flex h-full items-end gap-2">
          {stats.last7.map((d, i) => (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end">
              <div
                className="bar-y w-full max-w-7 rounded-t-md"
                style={
                  {
                    height: d.hours ? `${(d.hours / max) * 100}%` : "4%",
                    background: d.ok ? "var(--primary)" : d.hours ? "var(--chart-muted)" : "var(--border)",
                    "--i": i,
                  } as CSSProperties
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-2 text-center text-sm text-muted" aria-hidden>
        {stats.last7.map((d) => (
          <span key={d.day} className="flex-1">
            {WEEKDAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}
          </span>
        ))}
      </div>
      <p className="sr-only">
        Nos últimos 7 dias, {stats.onTarget7} dias chegaram à meta de {target} horas.
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="tabular text-xl font-bold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
