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
          {subtitle && <p className="font-medium text-muted">{subtitle}</p>}
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
      className={cx("rise mb-4 rounded-2xl border border-border bg-surface p-5", className)}
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
  size = "md",
  index = 0,
}: {
  label: string;
  value: number;
  target: number | null;
  unit: string;
  /** "lg" para os números principais do dia. */
  size?: "md" | "lg";
  index?: number;
}) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target ? value > target * 1.1 : false;
  const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
  return (
    <div className={size === "lg" ? "mb-5 last:mb-0" : "mb-4 last:mb-0"}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className={size === "lg" ? "text-lg font-semibold" : "font-medium"}>{label}</span>
        <span className="tabular text-muted">
          <strong className={`font-semibold ${over ? "text-accent" : "text-foreground"}`}>{fmt(value)}</strong>
          {target ? ` de ${fmt(target)}` : ""} {unit}
        </span>
      </div>
      {target ? (
        <div className={`overflow-hidden rounded-full bg-surface-2 ${size === "lg" ? "h-3.5" : "h-2.5"}`} aria-hidden>
          <div
            className="bar-x h-full rounded-full"
            style={{ width: `${pct}%`, background: over ? "var(--accent)" : "var(--primary)", "--i": index } as CSSProperties}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Marca do app: um símbolo simples e o nome. */
export function Brand({ tagline }: { tagline?: string }) {
  return (
    <div className="rise mb-8 flex items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
        <span className="text-2xl font-bold leading-none">S</span>
      </span>
      <div>
        <p className="text-2xl font-bold tracking-tight">Survivor</p>
        {tagline && <p className="text-muted">{tagline}</p>}
      </div>
    </div>
  );
}
