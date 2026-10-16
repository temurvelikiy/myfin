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

// mobile: pastki panel (ikonka ustida, yozuv ostida); aks holda yon menyu.
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
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "font-semibold text-emerald-400" : "text-slate-400"}`}
          >
            <span className={`flex h-7 w-10 items-center justify-center rounded-full text-base ${active ? "bg-emerald-500/15" : ""}`}>{icon}</span>
            <span className="w-full truncate text-center">{t[key]}</span>
          </Link>
        ) : (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active ? "bg-emerald-500/15 font-semibold text-emerald-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{icon}</span>
            {t[key]}
          </Link>
        );
      })}
    </nav>
  );
}
