import { deleteGoal } from "@/app/actions";
import { dayStr, shortDay, todayStr } from "@/lib/dates";
import { fmt, pct } from "@/lib/format";
import { fill, type Dict } from "@/lib/i18n";
import { StateForm } from "./StateForm";
import { Empty } from "./ui";

export type GoalView = {
  id: string;
  name: string;
  icon: string;
  target: number;
  currency: string;
  deadline: Date | null;
  saved: number;
  left: number;
  done: boolean;
};

// Muddatgacha oyiga qancha yig'ish kerak (kamida 1 oy hisoblanadi).
function perMonth(g: GoalView, today: string) {
  if (g.done || !g.deadline) return null;
  const days = Math.round((new Date(`${dayStr(g.deadline)}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 864e5);
  if (days <= 0) return null;
  return g.left / Math.max(Math.ceil(days / 30), 1);
}

export function Goals({ goals, t, compact }: { goals: GoalView[]; t: Dict; compact?: boolean }) {
  const today = todayStr();
  if (!goals.length) return <Empty>{t.noGoals}</Empty>;
  return (
    <ul className={compact ? "space-y-3" : "grid gap-3 md:grid-cols-2"}>
      {goals.map((g) => {
        const p = pct(g.saved, g.target);
        const late = !g.done && g.deadline && dayStr(g.deadline) < today;
        const need = perMonth(g, today);
        return (
          <li key={g.id} className={compact ? "" : "rounded-xl border border-peach-100 bg-peach-50 p-3"}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{g.icon} {g.name}</span>
              <span className="num shrink-0 text-xs text-slate-500">{p}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${g.done ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${Math.min(p, 100)}%` }} />
            </div>
            <p className="num mt-1.5 text-xs text-slate-500">
              {fill(t.goalSaved, { s: fmt(g.saved, g.currency), t: fmt(g.target, g.currency) })}
            </p>
            {!compact && (
              <>
                <p className="mt-0.5 text-xs text-slate-400">
                  {g.done ? <span className="font-medium text-blue-700">{t.goalDone}</span> : fill(t.goalLeft, { v: fmt(g.left, g.currency) })}
                  {g.deadline && (
                    <span className={late ? "ml-2 font-medium text-red-600" : "ml-2"}>
                      · {fill(t.goalDeadlineOn, { d: shortDay(g.deadline) })}
                      {late && ` · ${t.goalOverdue}`}
                    </span>
                  )}
                </p>
                {need !== null && <p className="num mt-0.5 text-xs text-slate-500">{fill(t.goalPerMonth, { v: fmt(need, g.currency) })}</p>}
                <StateForm action={deleteGoal} className="mt-1">
                  <input type="hidden" name="id" value={g.id} />
                  <button className="text-xs text-slate-400 hover:text-red-600">{t.delete}</button>
                </StateForm>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
