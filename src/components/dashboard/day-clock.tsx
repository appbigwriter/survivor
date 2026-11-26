"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDuration, minutesOfDay, todayISO } from "@/lib/dates";

export type ClockMeal = {
  id: string;
  minutes: number;
  time: string;
  label: string;
  kcal: number;
  items: string;
};

const SIZE = 280;
const C = SIZE / 2;
const R = 104; // raio da trilha
const TRACK = 22;

const angle = (min: number) => (min / 1440) * 2 * Math.PI - Math.PI / 2; // meia-noite no topo
// Arredondado: o servidor (Node) e o Safari podem divergir na última casa do seno.
const point = (min: number, r: number) =>
  [Number((C + r * Math.cos(angle(min))).toFixed(2)), Number((C + r * Math.sin(angle(min))).toFixed(2))] as const;

function arc(fromMin: number, toMin: number, r: number) {
  let span = toMin - fromMin;
  if (span < 0) span += 1440;
  if (span <= 0) return "";
  const [x1, y1] = point(fromMin, r);
  const [x2, y2] = point(fromMin + span, r);
  const large = span > 720 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * Relógio de 24 horas: a noite, a janela em que a pessoa comeu hoje, o tempo
 * desde a última refeição e cada refeição como um ponto. Tocar num ponto mostra
 * o que foi comido.
 */
export function DayClock({
  meals,
  nowMinutes: serverNow,
  lastMealAgoMinutes: serverAgo,
  lastMealAt,
  day,
  sleep,
}: {
  meals: ClockMeal[];
  nowMinutes: number;
  /** Minutos desde a última refeição na hora em que o servidor montou a tela. */
  lastMealAgoMinutes: number | null;
  /** Hora da última refeição (pode ser de ontem), para recalcular no navegador. */
  lastMealAt: string | null;
  /** Dia (AAAA-MM-DD) a que a tela se refere. */
  day: string;
  /** Sono da noite que terminou hoje, em minutos do dia (deitou, acordou). */
  sleep?: { from: number; to: number } | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const [ago, setAgo] = useState(serverAgo);
  const [selected, setSelected] = useState<string | null>(null);

  // O primeiro desenho usa os números do servidor (evita divergência na
  // hidratação); logo depois, e a cada 30 s, recalcula pelo relógio do aparelho.
  // Isso também corrige a tela que voltou do cache pelo botão "voltar".
  useEffect(() => {
    const tick = () => {
      if (todayISO() !== day) {
        router.refresh(); // passou da meia-noite com o app aberto
        return;
      }
      setNow(minutesOfDay());
      setAgo(lastMealAt ? (Date.now() - Date.parse(lastMealAt)) / 60000 : null);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [day, lastMealAt, router]);

  const first = meals[0];
  const last = meals[meals.length - 1];
  const sel = meals.find((m) => m.id === selected) ?? null;
  const maxKcal = Math.max(300, ...meals.map((m) => m.kcal));
  const [hx, hy] = point(now, R + TRACK / 2 + 6);
  const [hx0, hy0] = point(now, R - TRACK / 2 - 8);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label="Relógio do dia com as refeições de hoje">
          {/* trilha */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={TRACK} />
          {/* noite (22h às 6h) e, se registrado, o sono de verdade */}
          <path d={arc(22 * 60, 6 * 60, R)} fill="none" stroke="var(--night)" strokeOpacity={sleep ? 0.08 : 0.18} strokeWidth={TRACK} />
          {sleep && (
            <path
              className="draw"
              pathLength={1}
              d={arc(sleep.from, sleep.to, R)}
              fill="none"
              stroke="var(--night)"
              strokeOpacity={0.85}
              strokeWidth={TRACK}
              strokeLinecap="round"
            />
          )}
          {/* tempo desde a última refeição até agora */}
          {last && now > last.minutes && (
            <path
              className="draw"
              pathLength={1}
              d={arc(last.minutes, now, R)}
              fill="none"
              stroke="var(--muted)"
              strokeOpacity={0.45}
              strokeWidth={TRACK - 12}
              strokeLinecap="round"
            />
          )}
          {/* janela em que comeu hoje */}
          {first && last && last.minutes > first.minutes && (
            <path
              className="draw"
              pathLength={1}
              d={arc(first.minutes, last.minutes, R)}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity={0.85}
              strokeWidth={TRACK}
              strokeLinecap="round"
            />
          )}

          {/* marcas das horas */}
          {Array.from({ length: 24 }, (_, h) => {
            const major = h % 6 === 0;
            const [x1, y1] = point(h * 60, R - TRACK / 2 - 4);
            const [x2, y2] = point(h * 60, R - TRACK / 2 - (major ? 12 : 7));
            return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeOpacity={major ? 0.8 : 0.35} strokeWidth={major ? 2 : 1} strokeLinecap="round" />;
          })}
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = point(h * 60, R + TRACK / 2 + 16);
            return (
              <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="var(--muted)">
                {h === 0 ? "0h" : `${h}h`}
              </text>
            );
          })}

          {/* ponteiro de agora */}
          <line x1={hx0} y1={hy0} x2={hx} y2={hy} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" />
          <circle className="pulse-dot" cx={hx} cy={hy} r={4} fill="var(--foreground)" />

          {/* refeições */}
          {meals.map((m, i) => {
            const [x, y] = point(m.minutes, R);
            const r = 6 + (m.kcal / maxKcal) * 5;
            const active = m.id === selected;
            return (
              <g key={m.id} className="pop" style={{ "--i": 30 + i * 8, transformOrigin: `${x}px ${y}px` } as CSSProperties}>
                <circle cx={x} cy={y} r={r + 3} fill="var(--surface)" />
                <circle
                  cx={x}
                  cy={y}
                  r={active ? r + 2 : r}
                  fill="var(--ring-kcal)"
                  stroke={active ? "var(--foreground)" : "none"}
                  strokeWidth={2}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelected(active ? null : m.id)}
                />
              </g>
            );
          })}
        </svg>

        <div aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
          {sel ? (
            <div key={sel.id} className="pop">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{sel.label} · {sel.time}</span>
              <span className="block text-2xl font-bold">{Math.round(sel.kcal)} kcal</span>
              <span className="line-clamp-2 block text-xs text-muted">{sel.items}</span>
            </div>
          ) : (
            <>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Última refeição</span>
              <span className="whitespace-nowrap text-xl font-bold leading-tight">{ago === null ? "—" : `há ${formatDuration(ago)}`}</span>
              <span className="text-xs text-muted">
                {meals.length === 0 ? "nenhuma hoje" : `${meals.length} ${meals.length === 1 ? "refeição" : "refeições"} hoje`}
              </span>
            </>
          )}
        </div>
      </div>

      {meals.length > 0 ? (
        <ul className="mt-2 w-full divide-y divide-border" aria-label="Refeições de hoje">
          {meals.map((m) => (
            <li key={m.id}>
              <Link
                href={`/refeicao/${m.id}`}
                onFocus={() => setSelected(m.id)}
                onMouseEnter={() => setSelected(m.id)}
                onMouseLeave={() => setSelected(null)}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 transition ${m.id === selected ? "bg-surface-2" : ""}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-kcal" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {m.label} <span className="font-normal text-muted">{m.time}</span>
                  </span>
                  <span className="block truncate text-sm text-muted">{m.items}</span>
                </span>
                <span className="tabular shrink-0 font-semibold">{Math.round(m.kcal)} kcal</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted">
        <li className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-primary" />comeu</li>
        <li className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-muted/50" />desde a última</li>
        {sleep ? (
          <li className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-night" />dormiu</li>
        ) : (
          <li className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-night/25" />noite</li>
        )}
      </ul>
    </div>
  );
}
