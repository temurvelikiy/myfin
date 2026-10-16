import Link from "next/link";
import { goalMoneyAction } from "@/app/actions";
import { dayStr, shortDay, todayStr } from "@/lib/dates";
import { fmt, pct } from "@/lib/format";
import { fill, tn, type Dict } from "@/lib/i18n";
import type { GoalView } from "./Goals";
import { StateForm, Submit } from "./StateForm";

type Account = { id: string; name: string; currency: string };

export function daysUntil(deadline: Date, today: string) {
  return Math.round((new Date(`${dayStr(deadline)}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 864e5);
}

// Maqsad holati: nechta kun qoldi / kechikdi va oyiga qancha yig'ish kerak.
export function GoalProgress({ g, t, big }: { g: GoalView; t: Dict; big?: boolean }) {
  const today = todayStr();
  const p = pct(g.saved, g.target);
  const days = g.deadline ? daysUntil(g.deadline, today) : null;
  const late = !g.done && days !== null && days < 0;
  const need = !g.done && days !== null && days > 0 ? g.left / Math.max(Math.ceil(days / 30), 1) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`num font-bold ${big ? "text-2xl" : "text-lg"}`}>{fmt(g.saved, g.currency)}</span>
        <span className="num text-sm text-slate-500">/ {fmt(g.target, g.currency)}</span>
      </div>
      <div className={`mt-2 overflow-hidden rounded-full bg-slate-100 ${big ? "h-3" : "h-2.5"}`}>
        <div className={`h-full rounded-full ${g.done ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
      <div className="num mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{p}%</span>
        {g.done ? <span className="font-medium text-blue-700">{t.goalDone}</span> : <span>{fill(t.goalLeft, { v: fmt(g.left, g.currency) })}</span>}
      </div>
      {g.deadline && (
        <p className={`mt-1 text-xs ${late ? "font-medium text-red-600" : "text-slate-500"}`}>
          {fill(t.goalDeadlineOn, { d: `${shortDay(g.deadline)}.${dayStr(g.deadline).slice(0, 4)}` })}
          {days !== null && !g.done && ` · ${days >= 0 ? fill(t.goalDaysLeft, { n: days }) : fill(t.goalDaysOver, { n: -days })}`}
        </p>
      )}
      {need !== null && <p className="num mt-0.5 text-xs text-slate-500">{fill(t.goalPerMonth, { v: fmt(need, g.currency) })}</p>}
    </div>
  );
}

export function GoalCover({ image, icon, className = "" }: { image: string | null; icon: string; className?: string }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={`w-full object-cover ${className}`} />
  ) : (
    <div className={`flex w-full items-center justify-center bg-gradient-to-br from-peach-100 to-peach-200 text-5xl ${className}`}>{icon}</div>
  );
}

export function GoalCard({ g, t, accounts }: { g: GoalView & { image: string | null }; t: Dict; accounts: Account[] }) {
  const accs = accounts.filter((a) => a.currency === g.currency);
  return (
    <li className="card flex flex-col overflow-hidden p-0 md:p-0">
      <Link href={`/savings/${g.id}`} className="block">
        <GoalCover image={g.image} icon={g.icon} className="h-36" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link href={`/savings/${g.id}`} className="truncate text-base font-semibold hover:text-blue-700">
          {g.name}
        </Link>
        <GoalProgress g={g} t={t} />
        {accs.length > 0 && (
          <StateForm action={goalMoneyAction} resetOnOk className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <input type="hidden" name="id" value={g.id} />
            <input type="hidden" name="kind" value="in" />
            <input name="amount" className="input num h-9 min-w-0 flex-1 text-sm" inputMode="decimal" placeholder="0" required aria-label={t.amount} />
            <select name="accountId" className="input h-9 w-auto max-w-[8rem] text-xs" aria-label={t.account}>
              {accs.map((a) => (
                <option key={a.id} value={a.id}>{tn(t, a.name)}</option>
              ))}
            </select>
            <Submit className="btn h-9 px-3 text-sm">＋</Submit>
          </StateForm>
        )}
      </div>
    </li>
  );
}
