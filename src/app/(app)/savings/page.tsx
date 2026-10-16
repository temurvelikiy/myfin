import { requireUser } from "@/lib/auth";
import { getAccounts, getGoals } from "@/lib/finance";
import { todayStr } from "@/lib/dates";
import { fmt } from "@/lib/format";
import { getT } from "@/lib/lang";
import { GoalCard } from "@/components/GoalCard";
import { GoalForm } from "@/components/GoalForm";
import { Empty } from "@/components/ui";

export default async function Savings() {
  const user = await requireUser();
  const t = getT();
  const [goals, accounts] = await Promise.all([getGoals(user.id), getAccounts(user.id)]);
  const total = (cur: string) => goals.filter((g) => g.currency === cur).reduce((s, g) => s + g.saved, 0);
  const target = (cur: string) => goals.filter((g) => g.currency === cur).reduce((s, g) => s + g.target, 0);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="h1">🐷 {t.navSavings}</h1>
        {goals.length > 0 && (
          <p className="num text-sm text-slate-500">
            {t.savingsTotal}: <b className="text-slate-900">{fmt(total("UZS"))}</b>
            {target("UZS") > 0 && <span> / {fmt(target("UZS"))}</span>}
            {target("USD") > 0 && (
              <>
                {" "}+ <b className="text-slate-900">{fmt(total("USD"), "USD")}</b> / {fmt(target("USD"), "USD")}
              </>
            )}
          </p>
        )}
      </div>

      <details className="card" open={goals.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">➕ {t.goalNewTitle}</summary>
        <div className="mt-3">
          <GoalForm today={todayStr()} />
        </div>
      </details>

      {goals.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <GoalCard key={g.id} g={g} t={t} accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))} />
          ))}
        </ul>
      ) : (
        <section className="card">
          <Empty>{t.noGoals}</Empty>
        </section>
      )}
    </>
  );
}
