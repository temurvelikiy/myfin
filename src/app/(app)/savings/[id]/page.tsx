import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteGoalAndBack, goalMoneyAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccounts, getGoals, typeLabel } from "@/lib/finance";
import { dayStr, shortDay, todayStr } from "@/lib/dates";
import { fmt } from "@/lib/format";
import { tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { GoalCover, GoalProgress } from "@/components/GoalCard";
import { GoalForm } from "@/components/GoalForm";
import { StateForm, Submit } from "@/components/StateForm";
import { Empty } from "@/components/ui";

export default async function GoalPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = getT();
  const goal = (await getGoals(user.id)).find((g) => g.id === params.id);
  if (!goal) notFound();

  const [accounts, txs] = await Promise.all([
    getAccounts(user.id),
    prisma.transaction.findMany({
      where: { userId: user.id, goalId: goal.id },
      orderBy: { date: "desc" },
      include: { account: { select: { name: true } } },
    }),
  ]);
  const accs = accounts.filter((a) => a.currency === goal.currency);

  return (
    <>
      <Link href="/savings" className="text-sm font-medium text-blue-700 hover:underline">
        {t.goalBack}
      </Link>

      <section className="card overflow-hidden p-0 md:p-0">
        <GoalCover image={goal.image} icon={goal.icon} className="h-48 md:h-64" />
        <div className="p-4 md:p-5">
          <h1 className="h1 mb-3">{goal.name}</h1>
          {goal.note && <p className="mb-3 text-sm text-slate-500">{goal.note}</p>}
          <GoalProgress g={goal} t={t} big />
        </div>
      </section>

      <section className="card">
        <h2 className="h2">{t.goalAddMoney}</h2>
        {accs.length ? (
          <StateForm action={goalMoneyAction} resetOnOk className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <input type="hidden" name="id" value={goal.id} />
            <div>
              <label className="label">{t.savingKind}</label>
              <select name="kind" className="input">
                <option value="in">{t.savingDeposit}</option>
                <option value="out">{t.savingWithdraw}</option>
              </select>
            </div>
            <div>
              <label className="label">{t.amount} ({goal.currency})</label>
              <input name="amount" className="input num" inputMode="decimal" placeholder="0" required />
            </div>
            <div>
              <label className="label">{t.account}</label>
              <select name="accountId" className="input">
                {accs.map((a) => (
                  <option key={a.id} value={a.id}>{tn(t, a.name)}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="label">{t.note}</label>
              <input name="note" className="input" maxLength={200} placeholder={t.optional} />
            </div>
            <div className="col-span-2 flex items-end md:col-span-1">
              <Submit className="btn w-full">{t.save}</Submit>
            </div>
          </StateForm>
        ) : (
          <Empty>{goal.currency}: {t.none}</Empty>
        )}
      </section>

      <section className="card">
        <h2 className="h2">{t.goalHistory}</h2>
        {txs.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {txs.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <span className="num w-10 shrink-0 text-xs text-slate-400">{shortDay(x.date)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{typeLabel(t)[x.type]}</p>
                  <p className="truncate text-xs text-slate-400">
                    {tn(t, x.account.name)}
                    {x.note && ` · ${x.note}`}
                  </p>
                </div>
                <span className={`num shrink-0 font-medium ${x.type === "SAVING_IN" ? "text-blue-600" : "text-peach-600"}`}>
                  {x.type === "SAVING_IN" ? "+" : "−"}
                  {fmt(x.amount, goal.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t.goalNoHistory}</Empty>
        )}
      </section>

      <section className="card">
        <h2 className="h2">{t.goalEditTitle}</h2>
        <GoalForm
          today={todayStr()}
          initial={{
            id: goal.id,
            name: goal.name,
            target: goal.target,
            currency: goal.currency,
            deadline: goal.deadline ? dayStr(goal.deadline) : "",
            note: goal.note,
            image: goal.image,
          }}
        />
        <StateForm action={deleteGoalAndBack} className="mt-4 border-t border-slate-100 pt-3">
          <input type="hidden" name="id" value={goal.id} />
          <button className="text-sm text-red-600 hover:underline">{t.delete}</button>
        </StateForm>
      </section>
    </>
  );
}
