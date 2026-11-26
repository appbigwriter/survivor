"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration, todayISO } from "@/lib/dates";

/**
 * "Há 3 h 10 min": tempo desde a última refeição, atualizado a cada 30 s pelo
 * relógio do aparelho. O primeiro desenho usa o valor do servidor (sem
 * divergência na hidratação). Passando da meia-noite, recarrega a tela.
 */
export function SinceLastMeal({ lastMealAt, serverMinutes, day }: { lastMealAt: string | null; serverMinutes: number | null; day: string }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(serverMinutes);
  const refreshed = useRef(false);

  useEffect(() => {
    const tick = () => {
      // Virou o dia: recarrega uma vez. Se o relógio do aparelho estiver errado, não fica em laço.
      if (todayISO() !== day && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
        return;
      }
      setMinutes(lastMealAt ? (Date.now() - Date.parse(lastMealAt)) / 60000 : null);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [day, lastMealAt, router]);

  if (minutes === null) return <>sem refeições registradas nos últimos dias</>;
  return <>há {formatDuration(minutes)}</>;
}
