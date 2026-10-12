import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthStats } from "@/lib/finance";
import { dayStr, monthLabel, monthRange, shiftYm, validYm } from "@/lib/dates";
import { fmt, group, pct } from "@/lib/format";
import { Empty, MonthNav, Stat } from "@/components/ui";

export default async function Reports({ searchParams }: { searchParams: { m?: string } }) {
  const user = await requireUser();
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
  for (const t of txs) daily[Number(dayStr(t.date).slice(8)) - 1] += t.amountBase;
  const dayMax = Math.max(...daily, 1);

  const delta = prev.expense > 0 ? Math.round(((stats.expense - prev.expense) / prev.expense) * 100) : null;
  const onTarget = stats.savingsRate >= user.savingsTarget;
  const botShare = pct(txs.filter((t) => t.source === "BOT").length, txs.length);

  return (
    <>
      <MonthNav ym={ym} path="/reports" title="Oylik hisobot" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Daromad" value={fmt(stats.income)} tone="good" hint={`O'tgan oy: ${fmt(prev.income)}`} />
        <Stat
          label="Xarajat"
          value={fmt(stats.expense)}
          tone="bad"
          hint={delta === null ? "O'tgan oyda xarajat yo'q" : `O'tgan oyga nisbatan ${delta > 0 ? "+" : ""}${delta}%`}
        />
        <Stat
          label="Jamg'arma"
          value={stats.income > 0 ? `${stats.savingsRate}%` : "—"}
          tone={stats.income > 0 ? (onTarget ? "good" : "bad") : undefined}
          hint={`${fmt(stats.saved)} · maqsad ${user.savingsTarget}%`}
        />
        <Stat
          label="Limitdan oshgan kategoriyalar"
          value={`${stats.overLimit.length} ta`}
          tone={stats.overLimit.length >= 2 ? "bad" : "good"}
          hint="Maqsad: oyiga 2 tadan kam"
        />
      </div>

      {stats.overLimit.length > 0 && (
        <section className="card border-red-200 bg-red-50">
          <h2 className="h2 text-red-700">🚨 Limitdan oshganlar</h2>
          <ul className="space-y-1 text-sm">
            {stats.overLimit.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>{c.icon} {c.name}</span>
                <span className="num">
                  {fmt(c.spent)} / {fmt(c.limit)} · <b className="text-red-700">+{fmt(c.spent - c.limit)}</b>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="h2">Pul qayerga ketdi</h2>
        {cats.length ? (
          <div className="space-y-3">
            {cats.map((c) => {
              const before = prevSpent.get(c.id) ?? 0;
              return (
                <div key={c.id}>
                  <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                    <span>{c.icon} {c.name} <span className="text-xs text-slate-400">{pct(c.spent, stats.expense)}%</span></span>
                    <span className="num">
                      <b>{fmt(c.spent)}</b>
                      <span className="ml-2 text-xs text-slate-400">o&apos;tgan oy {group(Math.round(before))}</span>
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
          <Empty>Bu oyda xarajat yo&apos;q</Empty>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Shaxsiy va biznes</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-1 text-left font-medium" />
                <th className="pb-1 text-right font-medium">{monthLabel(ym)}</th>
                <th className="pb-1 text-right font-medium">{monthLabel(prevYm)}</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-slate-100">
              <tr>
                <td className="py-1.5">🟢 Shaxsiy xarajat</td>
                <td className="text-right">{fmt(stats.personal)}</td>
                <td className="text-right text-slate-500">{fmt(prev.personal)}</td>
              </tr>
              <tr>
                <td className="py-1.5">🟣 Biznes xarajat</td>
                <td className="text-right">{fmt(stats.business)}</td>
                <td className="text-right text-slate-500">{fmt(prev.business)}</td>
              </tr>
              <tr>
                <td className="py-1.5">Biznes daromad</td>
                <td className="text-right">{fmt(stats.businessIncome)}</td>
                <td className="text-right text-slate-500">{fmt(prev.businessIncome)}</td>
              </tr>
              <tr className="font-medium">
                <td className="py-1.5">Biznes natijasi</td>
                <td className="text-right">{fmt(stats.businessIncome - stats.business)}</td>
                <td className="text-right text-slate-500">{fmt(prev.businessIncome - prev.business)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">Biznes daromadi — «Biznes» belgisi bilan kiritilgan daromadlar.</p>
        </section>

        <section className="card">
          <h2 className="h2">Kunlik xarajat</h2>
          <div className="flex h-32 items-end gap-px">
            {daily.map((v, i) => (
              <div key={i} className="flex-1 rounded-t bg-emerald-500/80 hover:bg-emerald-600" style={{ height: `${Math.max((v / dayMax) * 100, v > 0 ? 3 : 0)}%` }} title={`${i + 1}-kun: ${fmt(v)}`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>1</span>
            <span>{Math.ceil(days / 2)}</span>
            <span>{days}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {txs.length} ta xarajat yozuvi · {botShare}% i Telegram bot orqali
          </p>
        </section>
      </div>
    </>
  );
}
