import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccounts, TYPE_LABEL } from "@/lib/finance";
import { dayLabel, dayRange, dayStr, monthLabel, monthRange, todayStr, validDay, validYm } from "@/lib/dates";
import { fmt } from "@/lib/format";
import { MonthCalendar, type DayTotal } from "@/components/MonthCalendar";
import { TxForm } from "@/components/TxForm";
import { TxRow, TX_INCLUDE } from "@/components/TxRow";
import { Empty, MonthNav } from "@/components/ui";

type Search = { m?: string; d?: string; scope?: string; type?: string; acc?: string; cat?: string };

export default async function Transactions({ searchParams: q }: { searchParams: Search }) {
  const user = await requireUser();
  const ym = validYm(q.m);
  const today = todayStr();
  // Tanlangan kun faqat shu oyga tegishli bo'lsa hisobga olinadi.
  const day = validDay(q.d) && q.d!.startsWith(ym) && q.d! <= today ? q.d! : undefined;
  const month = monthRange(ym);
  const range = day ? dayRange(day) : month;

  const [accounts, categories, monthTxs, txs] = await Promise.all([
    getAccounts(user.id),
    prisma.category.findMany({ where: { userId: user.id, archived: false }, orderBy: { name: "asc" } }),
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
  for (const t of monthTxs) {
    const key = dayStr(t.date);
    const d = totals.get(key) ?? { income: 0, expense: 0, count: 0 };
    if (t.type === "INCOME") (d.income += t.amountBase), (monthIncome += t.amountBase);
    else (d.expense += t.amountBase), (monthExpense += t.amountBase);
    d.count++;
    totals.set(key, d);
  }

  const sum = (type: string) => txs.filter((t) => t.type === type).reduce((s, t) => s + t.amountBase, 0);
  const filtered = q.scope || q.type || q.acc || q.cat;
  const base = `/transactions?m=${ym}`;

  return (
    <>
      <MonthNav ym={ym} path="/transactions" title="Amallar" />
      <TxForm accounts={accounts} categories={categories} day={day ?? (ym === today.slice(0, 7) ? today : `${ym}-01`)} today={today} />

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-slate-800">Kalendar · {monthLabel(ym)}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-income" /> Daromad <b className="num text-slate-900">{fmt(monthIncome)}</b></span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-expense" /> Xarajat <b className="num text-slate-900">{fmt(monthExpense)}</b></span>
          </div>
        </div>
        <MonthCalendar ym={ym} selected={day} totals={totals} />
        <p className="mt-2 text-xs text-slate-400">Kunni bosing — o&apos;sha kunning amallari pastda ochiladi.</p>
      </section>

      <section className="card" id="list">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{day ? dayLabel(day) : `${monthLabel(ym)} — barcha amallar`}</h2>
          {day && (
            <Link href={base} scroll={false} className="btn-ghost h-8 text-xs">
              ✕ Butun oyni ko&apos;rsatish
            </Link>
          )}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Amallar</p>
            <p className="num font-semibold">{txs.length} ta</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Daromad</p>
            <p className="num font-semibold text-emerald-600">+{fmt(sum("INCOME"))}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Xarajat</p>
            <p className="num font-semibold text-red-600">−{fmt(sum("EXPENSE"))}</p>
          </div>
        </div>

        <form className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <input type="hidden" name="m" value={ym} />
          {day && <input type="hidden" name="d" value={day} />}
          <select name="type" defaultValue={q.type ?? ""} className="input" aria-label="Amal turi">
            <option value="">Barcha turlar</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select name="scope" defaultValue={q.scope ?? ""} className="input" aria-label="Shaxsiy yoki biznes">
            <option value="">Shaxsiy + biznes</option>
            <option value="PERSONAL">Shaxsiy</option>
            <option value="BUSINESS">Biznes</option>
          </select>
          <select name="acc" defaultValue={q.acc ?? ""} className="input" aria-label="Hisob">
            <option value="">Barcha hisoblar</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select name="cat" defaultValue={q.cat ?? ""} className="input" aria-label="Kategoriya">
            <option value="">Barcha kategoriyalar</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <button className="btn-ghost h-10 flex-1">Filtrlash</button>
            {filtered && (
              <Link href={day ? `${base}&d=${day}` : base} scroll={false} className="btn-ghost h-10" aria-label="Filtrni tozalash">
                ✕
              </Link>
            )}
          </div>
        </form>

        {txs.length ? (
          <ul className="divide-y divide-slate-100">
            {txs.map((t) => (
              <TxRow key={t.id} t={t} withDelete />
            ))}
          </ul>
        ) : (
          <Empty>{day ? "Bu kunda amal yo'q" : "Bu oyda amal topilmadi"}</Empty>
        )}
      </section>
    </>
  );
}
