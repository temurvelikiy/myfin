import Link from "next/link";
import { monthLabel, shiftYm, currentYm } from "@/lib/dates";
import { fmt, pct } from "@/lib/format";
import type { Dict } from "@/lib/i18n";

export function MonthNav({ ym, path, title, t }: { ym: string; path: string; title: string; t: Dict }) {
  const next = shiftYm(ym, 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="h1">{title}</h1>
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-sm">
        <Link className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" href={`${path}?m=${shiftYm(ym, -1)}`} aria-label={t.prevMonth}>
          ←
        </Link>
        <span className="min-w-[8rem] text-center font-semibold">{monthLabel(ym, t)}</span>
        {next <= currentYm() ? (
          <Link className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" href={`${path}?m=${next}`} aria-label={t.nextMonth}>
            →
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center text-slate-300">→</span>
        )}
      </div>
    </div>
  );
}

// O'zgarish belgisi: yo'nalish strelka bilan, yaxshi/yomonligi rang bilan ko'rsatiladi.
export function Delta({ value, upIsGood = true }: { value: number | null; upIsGood?: boolean }) {
  if (value === null) return null;
  const good = value === 0 ? null : value > 0 === upIsGood;
  const tone = good === null ? "bg-slate-100 text-slate-500" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  return (
    <span className={`num inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>
      {value > 0 ? "▲" : value < 0 ? "▼" : "•"} {Math.abs(value)}%
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
  delta,
  upIsGood,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
  icon?: string;
  delta?: number | null;
  upIsGood?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-sm">{icon}</span>}
      </div>
      <p className={`num mt-2 whitespace-nowrap text-lg font-bold tracking-tight sm:text-xl ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : ""}`}>{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {delta !== undefined && <Delta value={delta} upIsGood={upIsGood} />}
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

// Limit chizig'i: 80% dan sariq, 100% dan qizil.
export function LimitBar({ icon, name, spent, limit }: { icon: string; name: string; spent: number; limit: number }) {
  const p = pct(spent, limit);
  const color = p > 100 ? "bg-red-500" : p >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="truncate">
          {icon} {name}
        </span>
        <span className={`num shrink-0 ${p > 100 ? "font-medium text-red-600" : "text-slate-500"}`}>
          {fmt(spent)} / {fmt(limit)} · {p}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-400">{children}</p>;
}

export function CardHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {href && (
        <Link href={href} className="text-xs font-medium text-emerald-700 hover:underline">
          {link} →
        </Link>
      )}
    </div>
  );
}
