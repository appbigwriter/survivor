"use client";

import { useEffect, useState } from "react";
import { formatDuration, minutesOfDay } from "@/lib/dates";
import { eatingWindow, fastingNow, formatHHMM, MAX_PLAUSIBLE_FAST_H, type ProtocolId } from "@/lib/fasting";

/**
 * Situação do jejum agora: em jejum há quanto tempo (com a meta) ou janela de
 * alimentação aberta até que horas. Atualiza a cada 30 s pelo relógio do aparelho.
 */
export function FastingStatus({
  protocol,
  startMin,
  lastMealAt,
  serverNowMin,
  serverSinceMin,
}: {
  protocol: ProtocolId;
  startMin: number;
  lastMealAt: string | null;
  serverNowMin: number;
  serverSinceMin: number | null;
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

  const f = fastingNow(now.min, now.since, protocol, startMin);
  const w = eatingWindow(protocol, startMin);
  const pct = f.sinceMealMin !== null ? Math.min(100, (f.sinceMealMin / f.targetMin) * 100) : 0;
  const reached = f.sinceMealMin !== null && f.sinceMealMin >= f.targetMin;

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

  if (f.phase === "eating") {
    return (
      <div aria-live="polite">
        <p className="text-muted">Janela de alimentação aberta</p>
        <p className="mb-1 text-3xl font-bold tracking-tight">até as {formatHHMM(w.end)}</p>
        <p className="text-muted">
          Fecha em {formatDuration(f.untilChangeMin)}. Use a janela para chegar perto da sua meta de calorias e de proteína.
        </p>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      <p className="text-muted">Em jejum</p>
      <p className="mb-3 text-3xl font-bold tracking-tight">
        {f.sinceMealMin !== null ? `há ${formatDuration(f.sinceMealMin)}` : "sem refeição recente"}
      </p>
      <div className="mb-1.5 flex justify-between">
        <span className="font-medium">Meta: {f.targetMin / 60} horas</span>
        <span className="text-muted">{reached ? "meta cumprida" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="mb-3 h-3.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="bar-x h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-muted">
        A janela abre às <strong className="text-foreground">{formatHHMM(w.start)}</strong>, em {formatDuration(f.untilChangeMin)}.
        {reached ? " Se tiver fome antes disso, pode comer: a meta já foi." : ""}
      </p>
    </div>
  );
}
