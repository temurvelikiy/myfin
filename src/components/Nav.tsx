"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";

const LINKS = [
  ["/", "🏠", "navHome"],
  ["/transactions", "🧾", "navTx"],
  ["/accounts", "💳", "navAccounts"],
  ["/budgets", "🎯", "navBudgets"],
  ["/debts", "🤝", "navDebts"],
  ["/reports", "📊", "navReports"],
  ["/settings", "⚙️", "navSettings"],
] as const;

// mobile: oq pastki panel; aks holda ko'k yon menyudagi ro'yxat.
export function Nav({ mobile }: { mobile?: boolean }) {
  const path = usePathname();
  const t = useT();
  return (
    <nav className={mobile ? "flex" : "flex flex-col gap-1"}>
      {LINKS.map(([href, icon, key]) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return mobile ? (
          <Link
            key={href}
            href={href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "font-semibold text-blue-700" : "text-slate-500"}`}
          >
            <span className={`flex h-7 w-10 items-center justify-center rounded-full text-base ${active ? "bg-peach-100" : ""}`}>{icon}</span>
            <span className="w-full truncate text-center">{t[key]}</span>
          </Link>
        ) : (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active ? "bg-card font-semibold text-blue-700 shadow-lg shadow-blue-950/20" : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-peach-100" : "bg-white/10"}`}>{icon}</span>
            {t[key]}
          </Link>
        );
      })}
    </nav>
  );
}
