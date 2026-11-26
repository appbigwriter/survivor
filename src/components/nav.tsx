"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

const icons: Record<string, React.ReactNode> = {
  "/hoje": <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
  "/refeicao/nova": <path d="M12 5v14M5 12h14" />,
  "/historico": <path d="M4 19V9M10 19V5M16 19v-7M21 19H3" />,
  "/conta": <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  "/admin": <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Z" />,
};

export function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/hoje", label: "Hoje" },
    { href: "/refeicao/nova", label: "Refeição", accent: true },
    { href: "/historico", label: "Histórico" },
    { href: "/conta", label: "Conta" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <ViewTransition name="bottom-nav">
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className="mx-auto flex max-w-xl justify-around">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/hoje" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-w-16 flex-col items-center gap-0.5 px-2 pb-2 pt-2.5 text-xs font-semibold transition-colors ${
                    active ? "text-primary" : "text-muted"
                  }`}
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                      item.accent ? "bg-primary text-primary-foreground" : active ? "bg-primary-soft" : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={item.accent ? 2.4 : 1.9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {icons[item.href]}
                    </svg>
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </ViewTransition>
  );
}
