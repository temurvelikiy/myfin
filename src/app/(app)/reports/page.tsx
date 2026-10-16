import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthStats } from "@/lib/finance";
import { dayStr, monthLabel, monthRange, shiftYm, validYm } from "@/lib/dates";
import { fmt, group, pct } from "@/lib/format";
import { fill, tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { Empty, MonthNav, Stat } from "@/components/ui";

export default async function Reports({ searchParams }: { searchParams: { m?: string } }) {
  const user = await requireUser();
  const t = getT();
  const ym = validYm(searchParams.m);
  const prevYm = shiftYm(ym, -1);
  const { start, end } = monthRange(ym);
  const [stats, prev, txs] = await Promise.all([
    monthStats(user.id, ym),
    monthStats(user.id, prevYm),
    prisma.transaction.findMany({
      where: { userId: user.id, type: "EXPENSE", date: { gte: start, lt: end } },
      select: { date: true, amountBase: true, source: true },
    }),
  ]);

  const prevSpent = new Map(prev.categories.map((c) => [c.id, c.spent]));
  const cats = stats.categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const max = cats[0]?.spent ?? 0;

  const days = Math.round((end.getTime() - start.getTime()) / 864e5);
  const daily = Array.from({ length: days }, () => 0);
  for (const tx of txs) daily[Number(dayStr(tx.date).slice(8)) - 1] += tx.amountBase;
  const dayMax = Math.max(...daily, 1);

  const delta = prev.expense > 0 ? Math.round(((stats.expense - prev.expense) / prev.expense) * 100) : null;
  const onTarget = stats.savingsRate >= user.savingsTarget;
  const botShare = pct(txs.filter((tx) => tx.source === "BOT").length, txs.length);

  return (
    <>
      <MonthNav ym={ym} path="/reports" title={t.reportTitle} t={t} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.income} value={fmt(stats.income)} tone="good" hint={fill(t.prevMonthAmount, { v: fmt(prev.income) })} />
        <Stat
          label={t.expense}
          value={fmt(stats.expense)}
          tone="bad"
          hint={delta === null ? t.noExpensePrev : fill(t.vsPrevPct, { v: `${delta > 0 ? "+" : ""}${delta}` })}
        />
        <Stat
          label={t.savings}
          value={stats.income > 0 ? `${stats.savingsRate}%` : "—"}
          tone={stats.income > 0 ? (onTarget ? "good" : "bad") : undefined}
          hint={fill(t.goalHint, { v: fmt(stats.saved), n: user.savingsTarget })}
        />
        <Stat
          label={t.overLimitCount}
          value={fill(t.countUnit, { n: stats.overLimit.length })}
          tone={stats.overLimit.length >= 2 ? "bad" : "good"}
          hint={t.goalLess2}
        />
      </div>

      {stats.overLimit.length > 0 && (
        <section className="card border-red-200 bg-red-50">
          <h2 className="h2 text-red-700">{t.overLimitTitle}</h2>
          <ul className="space-y-1 text-sm">
            {stats.overLimit.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>{c.icon} {tn(t, c.name)}</span>
                <span className="num">
                  {fmt(c.spent)} / {fmt(c.limit)} · <b className="text-red-700">+{fmt(c.spent - c.limit)}</b>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="h2">{t.whereMoney}</h2>
        {cats.length ? (
          <div className="space-y-3">
            {cats.map((c) => {
              const before = prevSpent.get(c.id) ?? 0;
              return (
                <div key={c.id}>
                  <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                    <span>{c.icon} {tn(t, c.name)} <span className="text-xs text-slate-400">{pct(c.spent, stats.expense)}%</span></span>
                    <span className="num">
                      <b>{fmt(c.spent)}</b>
                      <span className="ml-2 text-xs text-slate-400">{fill(t.prevMonthShort, { v: group(Math.round(before)) })}</span>
                    </span>
                  </div>
                  {/* Yashil — shaxsiy, binafsha — biznes */}
                  <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${(c.personal / max) * 100}%` }} />
                    <div className="bg-indigo-500" style={{ width: `${(c.business / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>{t.noExpenseMonth}</Empty>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">{t.personalAndBusiness}</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-1 text-left font-medium" />
                <th className="pb-1 text-right font-medium">{monthLabel(ym, t)}</th>
                <th className="pb-1 text-right font-medium">{monthLabel(prevYm, t)}</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-slate-100">
              <tr>
                <td className="py-1.5">{t.personalExpense}</td>
                <td className="text-right">{fmt(stats.personal)}</td>
                <td className="text-right text-slate-500">{fmt(prev.personal)}</td>
              </tr>
              <tr>
                <td className="py-1.5">{t.businessExpense}</td>
                <td className="text-right">{fmt(stats.business)}</td>
                <td className="text-right text-slate-500">{fmt(prev.business)}</td>
              </tr>
              <tr>
                <td className="py-1.5">{t.businessIncome}</td>
                <td className="text-right">{fmt(stats.businessIncome)}</td>
                <td className="text-right text-slate-500">{fmt(prev.businessIncome)}</td>
              </tr>
              <tr className="font-medium">
                <td className="py-1.5">{t.businessResult}</td>
                <td className="text-right">{fmt(stats.businessIncome - stats.business)}</td>
                <td className="text-right text-slate-500">{fmt(prev.businessIncome - prev.business)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">{t.businessIncomeHint}</p>
        </section>

        <section className="card">
          <h2 className="h2">{t.dailyExpense}</h2>
          <div className="flex h-32 items-end gap-px">
            {daily.map((v, i) => (
              <div key={i} className="flex-1 rounded-t bg-emerald-500/80 hover:bg-emerald-600" style={{ height: `${Math.max((v / dayMax) * 100, v > 0 ? 3 : 0)}%` }} title={fill(t.dayTooltip, { d: i + 1, v: fmt(v) })} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>1</span>
            <span>{Math.ceil(days / 2)}</span>
            <span>{days}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{fill(t.expenseRecords, { n: txs.length, p: botShare })}</p>
        </section>
      </div>
    </>
  );
}
