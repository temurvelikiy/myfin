import Link from "next/link";
import { todayStr } from "@/lib/dates";
import { fmtShort } from "@/lib/format";
import { fill, type Dict } from "@/lib/i18n";

export type DayTotal = { income: number; expense: number; count: number };

// Oy kalendari: har bir kunda daromad va xarajat yig'indisi. Kunni bosish shu kun amallarini ochadi.
export function MonthCalendar({ ym, selected, totals, d }: { ym: string; selected?: string; totals: Map<string, DayTotal>; d: Dict }) {
  const [y, m] = ym.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const today = todayStr();
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400 md:gap-1.5">
        {d.weekShort.map((w, i) => (
          <div key={w} className={`pb-1 ${i > 4 ? "text-slate-300" : ""}`}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const t = totals.get(day);
          const n = Number(day.slice(8));
          const isSel = day === selected;
          const body = (
            <>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  day === today ? "bg-slate-900 text-white" : isSel ? "text-emerald-700" : "text-slate-700"
                }`}
              >
                {n}
              </span>
              <span className="mt-auto w-full space-y-0.5 text-[10px] leading-tight text-slate-600 md:text-[11px]">
                {t && t.income > 0 && (
                  <span className="flex items-center gap-1 truncate">
                    <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-income" />+{fmtShort(t.income, d)}
                  </span>
                )}
                {t && t.expense > 0 && (
                  <span className="flex items-center gap-1 truncate">
                    <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-expense" />−{fmtShort(t.expense, d)}
                  </span>
                )}
              </span>
            </>
          );
          const cls = "flex min-h-[4.25rem] flex-col items-start rounded-xl border p-1.5 md:min-h-[5rem] md:p-2";
          if (day > today)
            return (
              <div key={day} className={`${cls} border-transparent bg-slate-50/50 opacity-40`}>
                {body}
              </div>
            );
          return (
            <Link
              key={day}
              href={isSel ? `/transactions?m=${ym}` : `/transactions?m=${ym}&d=${day}`}
              scroll={false}
              aria-label={t ? fill(d.dayAriaCount, { n, c: t.count }) : fill(d.dayAria, { n })}
              aria-current={isSel ? "date" : undefined}
              className={`${cls} transition ${
                isSel
                  ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                  : t
                    ? "border-slate-200 bg-white hover:border-emerald-400 hover:shadow-sm"
                    : "border-slate-100 bg-slate-50/60 hover:border-slate-300"
              }`}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
