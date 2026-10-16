import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debtLeft, getAccounts, getCredits, typeLabel } from "@/lib/finance";
import { dayLabel, dayRange, dayStr, monthLabel, monthRange, todayStr, validDay, validYm } from "@/lib/dates";
import { fmt } from "@/lib/format";
import { fill, tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { MonthCalendar, type DayTotal } from "@/components/MonthCalendar";
import { TxForm } from "@/components/TxForm";
import { TxRow, TX_INCLUDE } from "@/components/TxRow";
import { Empty, MonthNav } from "@/components/ui";

type Search = { m?: string; d?: string; scope?: string; type?: string; acc?: string; cat?: string };

export default async function Transactions({ searchParams: q }: { searchParams: Search }) {
  const user = await requireUser();
  const t = getT();
  const ym = validYm(q.m);
  const today = todayStr();
  // Tanlangan kun faqat shu oyga tegishli bo'lsa hisobga olinadi.
  const day = validDay(q.d) && q.d!.startsWith(ym) && q.d! <= today ? q.d! : undefined;
  const month = monthRange(ym);
  const range = day ? dayRange(day) : month;

  const [accounts, categories, openDebts, credits, monthTxs, txs] = await Promise.all([
    getAccounts(user.id),
    prisma.category.findMany({ where: { userId: user.id, archived: false }, orderBy: { name: "asc" } }),
    prisma.debt.findMany({ where: { userId: user.id, status: "OPEN" }, orderBy: { createdAt: "desc" } }),
    getCredits(user.id),
    prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ["EXPENSE", "INCOME"] }, date: { gte: month.start, lt: month.end } },
      select: { date: true, type: true, amountBase: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: range.start, lt: range.end },
        ...(q.scope ? { scope: q.scope } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.cat ? { categoryId: q.cat } : {}),
        ...(q.acc ? { OR: [{ accountId: q.acc }, { toAccountId: q.acc }] } : {}),
      },
      orderBy: { date: "desc" },
      take: 500,
      include: TX_INCLUDE,
    }),
  ]);

  const totals = new Map<string, DayTotal>();
  let monthIncome = 0, monthExpense = 0;
  for (const tx of monthTxs) {
    const key = dayStr(tx.date);
    const d = totals.get(key) ?? { income: 0, expense: 0, count: 0 };
    if (tx.type === "INCOME") (d.income += tx.amountBase), (monthIncome += tx.amountBase);
    else (d.expense += tx.amountBase), (monthExpense += tx.amountBase);
    d.count++;
    totals.set(key, d);
  }

  const sum = (type: string) => txs.filter((x) => x.type === type).reduce((s, x) => s + x.amountBase, 0);
  const filtered = q.scope || q.type || q.acc || q.cat;
  const base = `/transactions?m=${ym}`;
  const accs = accounts.map((a) => ({ id: a.id, currency: a.currency, name: tn(t, a.name) }));
  const cats = categories.map((c) => ({ id: c.id, kind: c.kind, icon: c.icon, name: tn(t, c.name) }));

  return (
    <>
      <MonthNav ym={ym} path="/transactions" title={t.navTx} t={t} />
      <TxForm
        accounts={accs}
        categories={cats}
        debts={openDebts.map((d) => ({ id: d.id, person: d.person, direction: d.direction, left: debtLeft(d), currency: d.currency }))}
        credits={credits.filter((c) => c.status === "OPEN").map((c) => ({ id: c.id, name: c.name, next: c.next?.payment ?? null, currency: c.currency }))}
        day={day ?? (ym === today.slice(0, 7) ? today : `${ym}-01`)} today={today} />

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-slate-800">{t.calendar} · {monthLabel(ym, t)}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-income" /> {t.income} <b className="num text-slate-900">{fmt(monthIncome)}</b></span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-expense" /> {t.expense} <b className="num text-slate-900">{fmt(monthExpense)}</b></span>
          </div>
        </div>
        <MonthCalendar ym={ym} selected={day} totals={totals} d={t} />
        <p className="mt-2 text-xs text-slate-400">{t.calendarHint}</p>
      </section>

      <section className="card" id="list">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{day ? dayLabel(day, t) : fill(t.allMonthTx, { m: monthLabel(ym, t) })}</h2>
          {day && (
            <Link href={base} scroll={false} className="btn-ghost h-8 text-xs">
              {t.showWholeMonth}
            </Link>
          )}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-peach-50 px-3 py-2">
            <p className="text-xs text-slate-500">{t.navTx}</p>
            <p className="num font-semibold">{fill(t.countUnit, { n: txs.length })}</p>
          </div>
          <div className="rounded-xl bg-peach-50 px-3 py-2">
            <p className="text-xs text-slate-500">{t.income}</p>
            <p className="num font-semibold text-blue-600">+{fmt(sum("INCOME"))}</p>
          </div>
          <div className="rounded-xl bg-peach-50 px-3 py-2">
            <p className="text-xs text-slate-500">{t.expense}</p>
            <p className="num font-semibold text-red-600">−{fmt(sum("EXPENSE"))}</p>
          </div>
        </div>

        <form className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <input type="hidden" name="m" value={ym} />
          {day && <input type="hidden" name="d" value={day} />}
          <select name="type" defaultValue={q.type ?? ""} className="input" aria-label={t.kind}>
            <option value="">{t.allTypes}</option>
            {Object.entries(typeLabel(t)).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select name="scope" defaultValue={q.scope ?? ""} className="input" aria-label={t.personalPlusBusiness}>
            <option value="">{t.personalPlusBusiness}</option>
            <option value="PERSONAL">{t.personal}</option>
            <option value="BUSINESS">{t.business}</option>
          </select>
          <select name="acc" defaultValue={q.acc ?? ""} className="input" aria-label={t.account}>
            <option value="">{t.allAccounts}</option>
            {accs.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select name="cat" defaultValue={q.cat ?? ""} className="input" aria-label={t.category}>
            <option value="">{t.allCategories}</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <button className="btn-ghost h-10 flex-1">{t.filter}</button>
            {filtered && (
              <Link href={day ? `${base}&d=${day}` : base} scroll={false} className="btn-ghost h-10" aria-label={t.clearFilter}>
                ✕
              </Link>
            )}
          </div>
        </form>

        {txs.length ? (
          <ul className="divide-y divide-slate-100">
            {txs.map((tx) => (
              <TxRow key={tx.id} tx={tx} d={t} withDelete />
            ))}
          </ul>
        ) : (
          <Empty>{day ? t.noTxDay : t.noTxMonth}</Empty>
        )}
      </section>
    </>
  );
}
