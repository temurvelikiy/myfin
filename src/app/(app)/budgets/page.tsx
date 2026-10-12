import { saveBudgets } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { monthStats } from "@/lib/finance";
import { monthLabel, shiftYm, validYm } from "@/lib/dates";
import { fmt, pct } from "@/lib/format";
import { StateForm, Submit } from "@/components/StateForm";
import { MonthNav } from "@/components/ui";

export default async function Budgets({ searchParams }: { searchParams: { m?: string } }) {
  const user = await requireUser();
  const ym = validYm(searchParams.m);
  const prevYm = shiftYm(ym, -1);
  const [stats, prev] = await Promise.all([monthStats(user.id, ym), monthStats(user.id, prevYm)]);
  const prevSpent = new Map(prev.categories.map((c) => [c.id, c.spent]));
  const rows = stats.categories.filter((c) => !c.archived && c.name !== "Tuzatish");
  const totalLimit = rows.reduce((s, c) => s + c.limit, 0);

  return (
    <>
      <MonthNav ym={ym} path="/budgets" title="Oylik limitlar" />
      <p className="text-sm text-slate-500">
        Limit shu oydan boshlab amal qiladi va o&apos;zgartirilmaguncha keyingi oylarga o&apos;tadi. 80% ga yetganda ogohlantirish chiqadi.
      </p>

      <StateForm action={saveBudgets} className="card">
        <input type="hidden" name="month" value={ym} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Kategoriya</th>
                <th className="pb-2 text-right font-medium">{monthLabel(prevYm)}</th>
                <th className="pb-2 text-right font-medium">{monthLabel(ym)}</th>
                <th className="w-24 pb-2 pl-3 font-medium">Holat</th>
                <th className="w-36 pb-2 pl-3 font-medium">Limit (so&apos;m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const p = pct(c.spent, c.limit);
                return (
                  <tr key={c.id}>
                    <td className="py-2">{c.icon} {c.name}</td>
                    <td className="num py-2 text-right text-slate-500">{fmt(prevSpent.get(c.id) ?? 0)}</td>
                    <td className={`num py-2 text-right font-medium ${c.limit > 0 && p > 100 ? "text-red-600" : ""}`}>{fmt(c.spent)}</td>
                    <td className="py-2 pl-3">
                      {c.limit > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full ${p > 100 ? "bg-red-500" : p >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(p, 100)}%` }} />
                          </div>
                          <span className="num text-xs text-slate-500">{p}%</span>
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pl-3">
                      <input name={`limit_${c.id}`} className="input num" inputMode="numeric" defaultValue={c.limit || ""} placeholder="limitsiz" aria-label={`${c.name} limiti`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 text-sm font-medium">
              <tr>
                <td className="pt-2">Jami</td>
                <td className="num pt-2 text-right">{fmt(prev.expense)}</td>
                <td className="num pt-2 text-right">{fmt(stats.expense)}</td>
                <td />
                <td className="num pt-2 pl-3">{fmt(totalLimit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-3">
          <Submit>Limitlarni saqlash</Submit>
        </div>
      </StateForm>
    </>
  );
}
