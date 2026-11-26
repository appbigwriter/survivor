import Link from "next/link";
import { ViewTransition, type ComponentProps, type CSSProperties, type ReactNode } from "react";

export { BottomNav } from "./nav";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Page({
  title,
  subtitle,
  back,
  hero,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  /** Algo acima do título, como a marca nas telas de entrada. */
  hero?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ViewTransition>
      <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-6">
        {hero}
        <header className="rise mb-5">
          {back && (
            <Link href={back} className="-ml-2 mb-1 inline-block rounded-lg px-2 py-1 text-primary underline-offset-4 hover:underline">
              ← Voltar
            </Link>
          )}
          {subtitle && <p className="text-sm font-medium text-muted">{subtitle}</p>}
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight">{title}</h1>
        </header>
        {children}
      </main>
    </ViewTransition>
  );
}

export function Card({
  title,
  action,
  children,
  className,
  index,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Ordem na tela, para a entrada em cascata. */
  index?: number;
}) {
  return (
    <section
      className={cx("rise mb-4 rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow)]", className)}
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
    >
      {(title || action) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {action && <div className="text-sm">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "min-h-12 rounded-2xl px-5 font-semibold transition active:scale-[0.97] disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "secondary" && "border border-border bg-surface",
        variant === "danger" && "border border-danger text-danger",
        className,
      )}
    />
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex min-h-12 items-center justify-center rounded-2xl px-5 font-semibold transition active:scale-[0.97]",
        variant === "primary" ? "bg-primary text-primary-foreground" : "border border-border bg-surface",
      )}
    >
      {children}
    </Link>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full min-h-12 rounded-2xl border border-border bg-surface px-3 py-2 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(inputClass, "min-h-28", props.className)} />;
}

export function Notice({ tone = "warning", children }: { tone?: "warning" | "error" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cx(
        "pop mb-4 rounded-2xl px-4 py-3",
        tone === "warning" && "bg-warning-bg text-warning-fg",
        tone === "error" && "border border-danger text-danger",
        tone === "info" && "border border-border bg-surface text-muted",
      )}
    >
      {children}
    </div>
  );
}

export function Progress({
  label,
  value,
  target,
  unit,
  color = "var(--primary)",
  index = 0,
}: {
  label: string;
  value: number;
  target: number | null;
  unit: string;
  color?: string;
  index?: number;
}) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target ? value > target * 1.1 : false;
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted">
          {Math.round(value)} {target ? `de ${target}` : ""} {unit}
        </span>
      </div>
      {target ? (
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div
            className="bar-x h-full rounded-full"
            style={{ width: `${pct}%`, background: over ? "var(--ring-kcal)" : color, "--i": index } as CSSProperties}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Marca do app: três anéis (calorias, proteína, passos) que se desenham ao abrir. */
export function Brand({ tagline }: { tagline?: string }) {
  const rings = [
    { r: 26, color: "var(--ring-kcal)", pct: 0.78 },
    { r: 18, color: "var(--ring-protein)", pct: 0.62 },
    { r: 10, color: "var(--ring-steps)", pct: 0.9 },
  ];
  return (
    <div className="rise mb-6 flex items-center gap-4">
      <svg viewBox="0 0 64 64" width={64} height={64} className="-rotate-90 shrink-0" aria-hidden>
        {rings.map((ring, i) => {
          const c = 2 * Math.PI * ring.r;
          return (
            <g key={ring.r}>
              <circle cx={32} cy={32} r={ring.r} fill="none" stroke={ring.color} strokeOpacity={0.18} strokeWidth={6} />
              <circle
                className="ring-arc"
                cx={32}
                cy={32}
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - ring.pct)}
                style={{ "--ring-c": c, "--i": i } as CSSProperties}
              />
            </g>
          );
        })}
      </svg>
      <div>
        <p className="text-2xl font-bold tracking-tight">Survivor</p>
        {tagline && <p className="text-sm text-muted">{tagline}</p>}
      </div>
    </div>
  );
}
