"use client";

import { useEffect, useRef } from "react";

const format = (n: number, decimals: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * Mostra um número e, quando ele muda (depois de um registro), conta do valor
 * antigo até o novo. Na primeira renderização mostra o valor final direto,
 * para não piscar entre o HTML do servidor e o navegador. A animação escreve
 * direto no nó de texto, sem re-renderizar o React a cada quadro.
 */
export function CountUp({ value, decimals = 0, duration = 800 }: { value: number; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    // Escreve no próprio nó de texto que o React controla, sem trocá-lo.
    const text = ref.current?.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE || from === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      text.nodeValue = format(value, decimals);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      text.nodeValue = format(from + (value - from) * eased, decimals);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      text.nodeValue = format(value, decimals);
    };
  }, [value, decimals, duration]);

  return (
    <span ref={ref} className="tabular">
      {format(value, decimals)}
    </span>
  );
}
