import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccounts, monthStats, trends } from "@/lib/finance";
import { dayStr, monthLabel, shiftYm, shortDay, todayStr, validYm } from "@/lib/dates";
import { change, fmt, pct } from "@/lib/format";
import { fill, tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { QuickEntry } from "@/components/QuickEntry";
import { TrendChart } from "@/components/TrendChart";
import { TxRow, TX_INCLUDE } from "@/components/TxRow";
import { CardHead, Empty, LimitBar, MonthNav, Stat } from "@/components/ui";

const KIND_ICON: Record<string, string> = { CASH: "💵", CARD: "💳", WALLET: "📲" };

export default async function Dashboard({ searchParams }: { searchParams: { m?: string } }) {
  const user = await requireUser();
  const t = getT();
  const ym = validYm(searchParams.m);
  const prevYm = shiftYm(ym, -1);
  const [accounts, stats, prev, trend, categories, recent, debts] = await Promise.all([
    getAccounts(user.id),
    monthStats(user.id, ym),
    monthStats(user.id, prevYm),
    trends(user.id, t),
    prisma.category.findMany({ where: { userId: user.id, archived: false }, orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 7, include: TX_INCLUDE }),
    prisma.debt.findMany({ where: { userId: user.id, status: "OPEN" }, orderBy: { dueDate: "asc" } }),
  ]);

  const uzs = accounts.filter((a) => a.currency === "UZS").reduce((s, a) => s + a.balance, 0);
  const usd = accounts.filter((a) => a.currency === "USD").reduce((s, a) => s + a.balance, 0);
  const limited = stats.categories.filter((c) => c.limit > 0).sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const top = stats.categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 6);
  const prevSpent = new Map(prev.categories.map((c) => [c.id, c.spent]));
  const onTarget = stats.savingsRate >= user.savingsTarget;
  const today = todayStr();

  return (
    <>
      <MonthNav ym={ym} path="/" title={t.navHome} t={t} />

      <QuickEntry
        accounts={accounts.map((a) => ({ id: a.id, name: tn(t, a.name) }))}
        categories={categories.map((c) => ({ id: c.id, kind: c.kind, icon: c.icon, name: tn(t, c.name) }))}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat icon="💰" label={t.totalBalance} value={fmt(uzs + usd * user.usdRate)} hint={`${fmt(uzs)} + ${fmt(usd, "USD")}`} />
        <Stat icon="↘" label={t.monthIncome} value={fmt(stats.income)} delta={change(stats.income, prev.income)} hint={t.vsPrevMonth} />
        <Stat icon="↗" label={t.monthExpense} value={fmt(stats.expense)} delta={change(stats.expense, prev.expense)} upIsGood={false} hint={t.vsPrevMonth} />
        <Stat
          icon="🏦"
          label={fill(t.savingsGoal, { n: user.savingsTarget })}
          value={stats.income > 0 ? `${stats.savingsRate}%` : "—"}
          tone={stats.income > 0 ? (onTarget ? "good" : "bad") : undefined}
          hint={stats.income > 0 ? `${fmt(stats.saved)} · ${onTarget ? t.onTarget : t.belowTarget}` : t.noIncomeMonth}
        />
      </div>

      <TrendChart data={trend} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <CardHead title={fill(t.topSpending, { m: monthLabel(ym, t) })} href={`/reports?m=${ym}`} link={t.report} />
          {top.length ? (
            <div className="space-y-3">
              {top.map((c) => (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{c.icon} {tn(t, c.name)}</span>
                    <span className="num shrink-0">
                      <b>{fmt(c.spent)}</b>
                      <span className="ml-1.5 text-xs text-slate-400">{pct(c.spent, stats.expense)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-expense" style={{ width: `${(c.spent / top[0].spent) * 100}%` }} />
                  </div>
                  <p className="num mt-0.5 text-[11px] text-slate-400">{fill(t.prevMonthAmount, { v: fmt(prevSpent.get(c.id) ?? 0) })}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t.noExpenseMonth}</Empty>
          )}
        </section>

        <div className="space-y-4">
          <section className="card">
            <CardHead title={t.personalVsBusiness} />
            {stats.expense > 0 ? (
              <>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                  <div className="rounded-l-full bg-emerald-500" style={{ width: `${pct(stats.personal, stats.expense)}%` }} />
                  <div className="flex-1 rounded-r-full bg-indigo-500" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500"><i className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500" /> {t.personal} · {pct(stats.personal, stats.expense)}%</p>
                    <p className="num font-semibold">{fmt(stats.personal)}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500"><i className="h-2.5 w-2.5 rounded-[3px] bg-indigo-500" /> {t.business} · {pct(stats.business, stats.expense)}%</p>
                    <p className="num font-semibold">{fmt(stats.business)}</p>
                  </div>
                </div>
              </>
            ) : (
              <Empty>{t.noExpenseMonth}</Empty>
            )}
          </section>

          <section className="card">
            <CardHead title={t.navBudgets} href={`/budgets?m=${ym}`} link={t.setUp} />
            {limited.length ? (
              <div className="space-y-3">
                {limited.slice(0, 4).map((c) => (
                  <LimitBar key={c.id} icon={c.icon} name={tn(t, c.name)} spent={c.spent} limit={c.limit} />
                ))}
              </div>
            ) : (
              <Empty>{t.noLimits}</Empty>
            )}
          </section>
        </div>

        <section className="card">
          <CardHead title={t.recentTx} href="/transactions" link={t.all} />
          {recent.length ? (
            <ul className="divide-y divide-slate-100">
              {recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} d={t} />
              ))}
            </ul>
          ) : (
            <Empty>{t.noTxYet}</Empty>
          )}
        </section>

        <div className="space-y-4">
          <section className="card">
            <CardHead title={t.navAccounts} href="/accounts" link={t.all} />
            <ul className="divide-y divide-slate-100 text-sm">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-sm">{KIND_ICON[a.kind]}</span>
                    {tn(t, a.name)}
                  </span>
                  <span className={`num font-semibold ${a.balance < 0 ? "text-red-600" : ""}`}>{fmt(a.balance, a.currency)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <CardHead title={t.openDebts} href="/debts" link={t.all} />
            {debts.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {debts.slice(0, 5).map((d) => {
                  const overdue = d.dueDate && dayStr(d.dueDate) < today;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="truncate">
                        {d.direction === "GIVEN" ? t.gaveArrow : t.tookArrow} · {d.person}
                        {d.dueDate && (
                          <span className={`ml-2 text-xs ${overdue ? "font-medium text-red-600" : "text-slate-400"}`}>
                            {shortDay(d.dueDate)}
                            {overdue && ` · ${t.overdue}`}
                          </span>
                        )}
                      </span>
                      <span className="num shrink-0 font-semibold">{fmt(d.amount, d.currency)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>{t.noOpenDebts}</Empty>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
