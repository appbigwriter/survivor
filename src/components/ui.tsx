import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Page({ title, back, children }: { title: string; back?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center gap-3">
        {back && (
          <Link href={back} className="rounded-lg px-2 py-1 text-primary underline-offset-4 hover:underline">
            ← Voltar
          </Link>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>
      {children}
    </main>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mb-4 rounded-2xl border border-border bg-surface p-4", className)}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "min-h-12 rounded-xl px-5 font-semibold transition disabled:opacity-50",
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
        "inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-semibold",
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
  "w-full min-h-12 rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-primary";

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
        "mb-4 rounded-xl px-4 py-3",
        tone === "warning" && "bg-warning-bg text-warning-fg",
        tone === "error" && "border border-danger text-danger",
        tone === "info" && "border border-border bg-surface text-muted",
      )}
    >
      {children}
    </div>
  );
}

export function Progress({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {Math.round(value)} {target ? `de ${target}` : ""} {unit}
        </span>
      </div>
      {target ? (
        <div className="h-3 overflow-hidden rounded-full bg-border" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const items = [
    { href: "/hoje", label: "Hoje" },
    { href: "/refeicao/nova", label: "Refeição" },
    { href: "/historico", label: "Histórico" },
    { href: "/conta", label: "Conta" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl justify-around">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block px-3 py-3 font-medium">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
