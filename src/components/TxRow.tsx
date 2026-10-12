import { deleteTransaction } from "@/app/actions";
import { shortDay } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/finance";
import { fmt } from "@/lib/format";

export type TxView = {
  id: string;
  type: string;
  scope: string;
  amount: number;
  toAmount: number | null;
  note: string;
  date: Date;
  source: string;
  account: { name: string; currency: string };
  toAccount: { name: string; currency: string } | null;
  category: { name: string; icon: string } | null;
};

export function TxRow({ t, withDelete }: { t: TxView; withDelete?: boolean }) {
  const plus = t.type === "INCOME" || t.type === "DEBT_IN";
  const moving = t.type === "TRANSFER" || t.type === "EXCHANGE";
  const title = t.category ? `${t.category.icon} ${t.category.name}` : TYPE_LABEL[t.type];
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="num w-10 shrink-0 text-xs text-slate-400">{shortDay(t.date)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate">
          {title}
          {t.scope === "BUSINESS" && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">BIZ</span>}
          {t.source === "BOT" && <span className="ml-1 text-[10px] text-slate-400">bot</span>}
        </p>
        <p className="truncate text-xs text-slate-400">
          {moving ? `${t.account.name} → ${t.toAccount?.name}` : t.account.name}
          {t.note && ` · ${t.note}`}
        </p>
      </div>
      <span className={`num shrink-0 font-medium ${moving ? "text-slate-500" : plus ? "text-emerald-600" : "text-red-600"}`}>
        {moving ? "" : plus ? "+" : "−"}
        {fmt(t.amount, t.account.currency)}
        {t.type === "EXCHANGE" && t.toAccount && ` → ${fmt(t.toAmount ?? 0, t.toAccount.currency)}`}
      </span>
      {withDelete && (
        <form action={deleteTransaction}>
          <input type="hidden" name="id" value={t.id} />
          <button className="rounded px-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" title="O'chirish" aria-label="O'chirish">
            ✕
          </button>
        </form>
      )}
    </li>
  );
}

export const TX_INCLUDE = {
  account: { select: { name: true, currency: true } },
  toAccount: { select: { name: true, currency: true } },
  category: { select: { name: true, icon: true } },
} as const;
