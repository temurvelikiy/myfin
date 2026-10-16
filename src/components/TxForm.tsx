"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addTransaction } from "@/app/actions";
import { fill } from "@/lib/i18n";
import { fmt } from "@/lib/format";
import { Submit } from "./StateForm";
import { useT } from "./I18n";

type Acc = { id: string; name: string; currency: string };
type Cat = { id: string; name: string; icon: string; kind: string };
// Ochiq qarz (qoldig'i bilan) va ochiq kredit (keyingi to'lovi bilan) — kategoriya ro'yxatida ko'rinadi.
export type DebtOpt = { id: string; person: string; direction: string; left: number; currency: string };
export type CreditOpt = { id: string; name: string; next: number | null; currency: string };

const TABS = [
  ["EXPENSE", "expense"],
  ["INCOME", "income"],
  ["TRANSFER", "transferExchange"],
] as const;
const NEW = "__new";
const DEBT_NEW = "__debt_new";

export function TxForm({
  accounts,
  categories,
  debts,
  credits,
  day,
  today,
}: {
  accounts: Acc[];
  categories: Cat[];
  debts: DebtOpt[];
  credits: CreditOpt[];
  day: string;
  today: string;
}) {
  const [state, action] = useFormState(addTransaction, {});
  const [type, setType] = useState("EXPENSE");
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [toRaw, setTo] = useState(accounts[1]?.id ?? "");
  const [cat, setCat] = useState("");
  const [newCat, setNewCat] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const t = useT();

  const to = toRaw !== from ? toRaw : accounts.find((a) => a.id !== from)?.id ?? "";
  const cur = (id: string) => accounts.find((a) => a.id === id)?.currency ?? "UZS";
  const transfer = type === "TRANSFER";
  const exchange = transfer && cur(from) !== cur(to);
  const expense = type === "EXPENSE";

  // Xarajat: men qarz berdim (yangi) yoki olgan qarzimni qaytaraman. Daromad: men qarz oldim (yangi) yoki berganim qaytdi.
  const list = categories.filter((c) => c.kind === type);
  const debtList = debts.filter((d) => d.direction === (expense ? "TAKEN" : "GIVEN"));
  const creditList = expense ? credits : [];
  const value = cat || list[0]?.id || DEBT_NEW;
  const isNewDebt = value === DEBT_NEW;
  const picked = debts.find((d) => `debt:${d.id}` === value);
  const pickedCredit = credits.find((c) => `credit:${c.id}` === value);

  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    setNewCat(false);
    setCat("");
  }, [state]);

  return (
    <div className="card">
      <div className="seg mb-4 max-w-full overflow-x-auto">
        {TABS.map(([v, key]) => (
          <button key={v} type="button" aria-pressed={type === v} className="whitespace-nowrap" onClick={() => (setType(v), setNewCat(false), setCat(""))}>
            {t[key]}
          </button>
        ))}
      </div>

      <form ref={form} action={action} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <input type="hidden" name="type" value={type} />
        <div>
          <label className="label">{t.amount} ({cur(from)})</label>
          <input name="amount" className="input num text-base font-semibold" inputMode="decimal" required placeholder={pickedCredit?.next ? String(Math.round(pickedCredit.next)) : "0"} autoComplete="off" />
        </div>
        <div>
          <label className="label">{transfer ? t.fromAccount : t.account}</label>
          <select name="accountId" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {transfer ? (
          <>
            <div>
              <label className="label">{t.toAccount}</label>
              <select name="toAccountId" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                {accounts.filter((a) => a.id !== from).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {exchange && (
              <div>
                <label className="label">{t.receivedAmount} ({cur(to)})</label>
                <input name="toAmount" className="input num" inputMode="decimal" required placeholder="0" autoComplete="off" />
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="label">{t.category}</label>
              {newCat ? (
                <div className="flex gap-1.5">
                  <input name="newCategory" className="input" placeholder={t.newCategoryName} maxLength={40} required autoFocus />
                  <button type="button" className="btn-ghost h-10 shrink-0 px-2.5" onClick={() => setNewCat(false)} title={t.pickFromList} aria-label={t.pickFromList}>
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  name="categoryId"
                  className="input"
                  value={value}
                  onChange={(e) => (e.target.value === NEW ? setNewCat(true) : setCat(e.target.value))}
                >
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                  <optgroup label={t.debtsGroup}>
                    <option value={DEBT_NEW}>{expense ? t.debtGaveNew : t.debtTookNew}</option>
                    {debtList.map((d) => (
                      <option key={d.id} value={`debt:${d.id}`}>
                        {fill(expense ? t.repayTo : t.repaidBy, { p: d.person, v: fmt(d.left, d.currency) })}
                      </option>
                    ))}
                  </optgroup>
                  {creditList.length > 0 && (
                    <optgroup label={t.creditsGroup}>
                      {creditList.map((c) => (
                        <option key={c.id} value={`credit:${c.id}`}>{fill(t.creditPayOpt, { n: c.name })}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value={NEW}>{t.addNewCategory}</option>
                </select>
              )}
            </div>
            <div>
              <label className="label">{t.kind}</label>
              <select name="scope" className="input">
                <option value="PERSONAL">{t.personal}</option>
                <option value="BUSINESS">{t.business}</option>
              </select>
            </div>
          </>
        )}

        {/* Yangi qarz: kim bilan va qachon qaytariladi */}
        {!transfer && !newCat && isNewDebt && (
          <>
            <div className="col-span-2 lg:col-span-2">
              <label className="label">{t.debtPerson}</label>
              <input name="person" className="input" placeholder={t.debtPersonPlaceholder} maxLength={80} required />
            </div>
            <div className="col-span-2 lg:col-span-2">
              <label className="label">{t.dueHint}</label>
              <input name="dueDate" type="date" className="input" min={today} />
            </div>
          </>
        )}
        {!transfer && picked && (
          <p className="col-span-full -mt-1 text-xs text-slate-500">{fill(t.remainingLabel, { v: fmt(picked.left, picked.currency) })}</p>
        )}
        {!transfer && pickedCredit?.next != null && (
          <p className="col-span-full -mt-1 text-xs text-slate-500">{t.creditNext}: {fmt(pickedCredit.next, pickedCredit.currency)}</p>
        )}

        <div>
          <label className="label">{t.date}</label>
          <input name="date" type="date" className="input" defaultValue={day} key={day} max={today} />
        </div>
        <div className="col-span-2">
          <label className="label">{t.note}</label>
          <input name="note" className="input" maxLength={200} placeholder={t.optional} />
        </div>
        <div className="col-span-2 flex items-end lg:col-span-1">
          <Submit className="btn w-full">{t.save}</Submit>
        </div>
        {(state.error || state.ok) && (
          <p role="status" className={`col-span-full text-sm ${state.error ? "text-red-600" : "text-blue-700"}`}>
            {state.error ?? `✓ ${state.ok}`}
          </p>
        )}
      </form>
    </div>
  );
}
