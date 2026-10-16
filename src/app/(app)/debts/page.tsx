import { addCredit, addDebt, closeDebt, deleteCredit, deleteDebt, payCreditAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debtLeft, getAccounts, getCredits } from "@/lib/finance";
import { dayStr, shortDay, todayStr } from "@/lib/dates";
import { fmt, pct } from "@/lib/format";
import { fill, tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { StateForm, Submit } from "@/components/StateForm";
import { Empty } from "@/components/ui";

const ddmm = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export default async function Debts() {
  const user = await requireUser();
  const t = getT();
  const [debts, accounts, credits] = await Promise.all([
    prisma.debt.findMany({ where: { userId: user.id }, orderBy: [{ status: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
    getAccounts(user.id),
    getCredits(user.id),
  ]);
  const today = todayStr();
  const open = debts.filter((d) => d.status === "OPEN");
  const closed = debts.filter((d) => d.status === "CLOSED");
  const openCredits = credits.filter((c) => c.status === "OPEN");
  const closedCredits = credits.filter((c) => c.status === "CLOSED");
  const total = (dir: string, cur: string) => open.filter((d) => d.direction === dir && d.currency === cur).reduce((s, d) => s + debtLeft(d), 0);

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
                    <div className="shrink-0 text-right">
                      <span className="num font-semibold">{fmt(debtLeft(d), d.currency)}</span>
                      {d.paid > 0 && <p className="num text-[11px] text-slate-400">{fill(t.paidLabel, { v: fmt(d.paid, d.currency) })} / {fmt(d.amount, d.currency)}</p>}
                    </div>
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

      {/* ---------------- Kreditlar ---------------- */}
      <h2 className="h1 pt-2">🏦 {t.creditsTitle}</h2>

      <section className="card">
        <h2 className="h2">{t.newCredit}</h2>
        <StateForm action={addCredit} resetOnOk className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2">
            <label className="label">{t.creditName}</label>
            <input name="name" className="input" placeholder={t.creditNamePlaceholder} required maxLength={80} />
          </div>
          <div>
            <label className="label">{t.creditPrincipal}</label>
            <input name="principal" className="input num" inputMode="decimal" required placeholder="0" />
          </div>
          <div>
            <label className="label">{t.currency}</label>
            <select name="currency" className="input">
              <option>UZS</option>
              <option>USD</option>
            </select>
          </div>
          <div>
            <label className="label">{t.creditRate}</label>
            <input name="rate" className="input num" inputMode="decimal" placeholder="0" defaultValue="0" />
          </div>
          <div>
            <label className="label">{t.creditTerm}</label>
            <input name="termMonths" className="input num" inputMode="numeric" required placeholder="12" />
          </div>
          <div>
            <label className="label">{t.creditKind}</label>
            <select name="kind" className="input">
              <option value="ANNUITY">{t.kindAnnuity}</option>
              <option value="DIFFERENTIATED">{t.kindDiff}</option>
            </select>
          </div>
          <div>
            <label className="label">{t.creditPayDay}</label>
            <input name="payDay" className="input num" inputMode="numeric" min={1} max={31} defaultValue={Number(today.slice(8))} required />
          </div>
          <div>
            <label className="label">{t.creditStart}</label>
            <input name="startDate" type="date" className="input" defaultValue={today} max={today} />
          </div>
          <div>
            <label className="label">{t.creditToAccount}</label>
            <select name="accountId" className="input">
              <option value="">{t.creditNoAccount}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{tn(t, a.name)} ({a.currency})</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">{t.note}</label>
            <input name="note" className="input" maxLength={200} />
          </div>
          <div className="col-span-full">
            <Submit>{t.creditAdd}</Submit>
          </div>
        </StateForm>
      </section>

      {openCredits.length === 0 && (
        <section className="card">
          <Empty>{t.noCredits}</Empty>
        </section>
      )}

      {openCredits.map((c) => {
        const progress = pct(c.paid, c.total);
        const late = c.next && c.next.due < today;
        return (
          <section key={c.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">🏦 {c.name}</h3>
                <p className="text-xs text-slate-500">
                  {fmt(c.principal, c.currency)} · {c.rate}% · {c.termMonths} {t.monthsShort} · {c.kind === "ANNUITY" ? t.kindAnnuity : t.kindDiff}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{t.creditNext}</p>
                {c.next ? (
                  <p className={`num font-semibold ${late ? "text-red-600" : ""}`}>
                    {fmt(c.next.payment, c.currency)} · {ddmm(c.next.due)}
                    {late && <span className="ml-1 text-xs font-medium"> {t.creditOverdue}</span>}
                  </p>
                ) : (
                  <p className="font-semibold text-blue-700">{t.creditDone}</p>
                )}
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <div className="num mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-slate-500">
              <span>{fill(t.creditPaidOf, { p: fmt(c.paid, c.currency), t: fmt(c.total, c.currency) })}</span>
              <span>{fill(t.creditLeft, { v: fmt(c.left, c.currency) })}</span>
              <span>{fill(t.creditInterestTotal, { v: fmt(c.interestTotal, c.currency) })}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StateForm action={payCreditAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <select name="accountId" className="input h-9 w-auto text-xs" aria-label={t.payAccount}>
                  {accounts.filter((a) => a.currency === c.currency).map((a) => (
                    <option key={a.id} value={a.id}>{tn(t, a.name)}</option>
                  ))}
                </select>
                <input
                  name="amount"
                  className="input num h-9 w-36 text-sm"
                  inputMode="decimal"
                  defaultValue={c.next ? String(Math.round(c.next.payment * 100) / 100) : ""}
                  aria-label={t.payAmount}
                  required
                />
                <Submit className="btn h-9 px-4">{t.payInstallment}</Submit>
              </StateForm>
              <form action={deleteCredit}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs text-slate-400 hover:text-red-600">{t.delete}</button>
              </form>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-blue-700">{t.creditSchedule}</summary>
              <div className="mt-2 max-h-72 overflow-auto">
                <table className="num w-full text-xs">
                  <thead className="sticky top-0 bg-card text-left text-slate-400">
                    <tr>
                      <th className="py-1 font-medium">{t.scheduleNo}</th>
                      <th className="py-1 font-medium">{t.scheduleDue}</th>
                      <th className="py-1 text-right font-medium">{t.schedulePayment}</th>
                      <th className="py-1 text-right font-medium">{t.schedulePrincipal}</th>
                      <th className="py-1 text-right font-medium">{t.scheduleInterest}</th>
                      <th className="py-1 text-right font-medium">{t.scheduleBalance}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.rows.map((r) => {
                      const paid = r.n <= c.done;
                      return (
                        <tr key={r.n} className={paid ? "text-slate-400 line-through decoration-slate-300" : r.due < today ? "text-red-600" : ""}>
                          <td className="py-1">{paid ? "✓" : r.n}</td>
                          <td className="py-1">{ddmm(r.due)}</td>
                          <td className="py-1 text-right">{fmt(r.payment, c.currency)}</td>
                          <td className="py-1 text-right">{fmt(r.principal, c.currency)}</td>
                          <td className="py-1 text-right">{fmt(r.interest, c.currency)}</td>
                          <td className="py-1 text-right">{fmt(r.balance, c.currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        );
      })}

      {closedCredits.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-slate-500">{fill(t.closedCredits, { n: closedCredits.length })}</summary>
          <ul className="mt-2 divide-y divide-slate-100 text-sm text-slate-500">
            {closedCredits.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>🏦 {c.name}</span>
                <span className="num">{fmt(c.principal, c.currency)}</span>
                <form action={deleteCredit}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-slate-400 hover:text-red-600">{t.delete}</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
