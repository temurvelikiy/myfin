import { addDebt, closeDebt, deleteDebt } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccounts } from "@/lib/finance";
import { dayStr, shortDay, todayStr } from "@/lib/dates";
import { fmt } from "@/lib/format";
import { fill, tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { StateForm, Submit } from "@/components/StateForm";
import { Empty } from "@/components/ui";

export default async function Debts() {
  const user = await requireUser();
  const t = getT();
  const [debts, accounts] = await Promise.all([
    prisma.debt.findMany({ where: { userId: user.id }, orderBy: [{ status: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
    getAccounts(user.id),
  ]);
  const today = todayStr();
  const open = debts.filter((d) => d.status === "OPEN");
  const closed = debts.filter((d) => d.status === "CLOSED");
  const total = (dir: string, cur: string) => open.filter((d) => d.direction === dir && d.currency === cur).reduce((s, d) => s + d.amount, 0);

  const Group = ({ dir, title }: { dir: string; title: string }) => {
    const list = open.filter((d) => d.direction === dir);
    return (
      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="h2">{title}</h2>
          <p className="num text-xs text-slate-500">
            {fmt(total(dir, "UZS"))}{total(dir, "USD") > 0 && ` + ${fmt(total(dir, "USD"), "USD")}`}
          </p>
        </div>
        {list.length ? (
          <ul className="divide-y divide-slate-100">
            {list.map((d) => {
              const overdue = d.dueDate && dayStr(d.dueDate) < today;
              return (
                <li key={d.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.person}</p>
                      <p className={`text-xs ${overdue ? "font-medium text-red-600" : "text-slate-400"}`}>
                        {d.dueDate ? `${fill(t.dueOn, { d: shortDay(d.dueDate) })}${overdue ? ` · ${t.overduePast}` : ""}` : t.noDue}
                        {d.note && <span className="text-slate-400"> · {d.note}</span>}
                      </p>
                    </div>
                    <span className="num shrink-0 font-semibold">{fmt(d.amount, d.currency)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StateForm action={closeDebt} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <select name="accountId" className="input h-8 w-auto py-0 text-xs" aria-label={t.viaAccount}>
                        <option value="">{t.noAccount}</option>
                        {accounts.filter((a) => a.currency === d.currency).map((a) => (
                          <option key={a.id} value={a.id}>{dir === "GIVEN" ? "→ " : "← "}{tn(t, a.name)}</option>
                        ))}
                      </select>
                      <Submit className="btn-ghost h-8 text-xs">✓ {dir === "GIVEN" ? t.gotBack : t.paidBack}</Submit>
                    </StateForm>
                    <form action={deleteDebt}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-xs text-slate-400 hover:text-red-600">{t.delete}</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{t.none}</Empty>
        )}
      </section>
    );
  };

  return (
    <>
      <h1 className="h1">{t.navDebts}</h1>

      <section className="card">
        <h2 className="h2">{t.newDebt}</h2>
        <StateForm action={addDebt} resetOnOk className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="label">{t.direction}</label>
            <select name="direction" className="input">
              <option value="GIVEN">{t.iGave}</option>
              <option value="TAKEN">{t.iTook}</option>
            </select>
          </div>
          <div>
            <label className="label">{t.who}</label>
            <input name="person" className="input" required maxLength={80} />
          </div>
          <div>
            <label className="label">{t.amount}</label>
            <input name="amount" className="input num" inputMode="decimal" required placeholder="0" />
          </div>
          <div>
            <label className="label">{t.currency}</label>
            <select name="currency" className="input">
              <option>UZS</option>
              <option>USD</option>
            </select>
          </div>
          <div>
            <label className="label">{t.viaAccount}</label>
            <select name="accountId" className="input">
              <option value="">{t.noAccount}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{tn(t, a.name)} ({a.currency})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t.dueDate}</label>
            <input name="dueDate" type="date" className="input" min={today} />
          </div>
          <div className="col-span-2">
            <label className="label">{t.note}</label>
            <input name="note" className="input" maxLength={200} />
          </div>
          <div className="col-span-full">
            <Submit>{t.write}</Submit>
          </div>
        </StateForm>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Group dir="GIVEN" title={t.givenTitle} />
        <Group dir="TAKEN" title={t.takenTitle} />
      </div>

      {closed.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-slate-500">{fill(t.closedDebts, { n: closed.length })}</summary>
          <ul className="mt-2 divide-y divide-slate-100 text-sm text-slate-500">
            {closed.map((d) => (
              <li key={d.id} className="flex justify-between py-1.5">
                <span>{d.direction === "GIVEN" ? t.gave : t.took} · {d.person}{d.closedAt && ` · ${fill(t.closedOn, { d: shortDay(d.closedAt) })}`}</span>
                <span className="num">{fmt(d.amount, d.currency)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
