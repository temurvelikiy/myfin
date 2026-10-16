"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addTransaction } from "@/app/actions";
import { Submit } from "./StateForm";
import { useT } from "./I18n";

type Acc = { id: string; name: string; currency: string };
type Cat = { id: string; name: string; icon: string; kind: string };

const TABS = [
  ["EXPENSE", "expense"],
  ["INCOME", "income"],
  ["TRANSFER", "transferExchange"],
] as const;
const NEW = "__new";

export function TxForm({ accounts, categories, day, today }: { accounts: Acc[]; categories: Cat[]; day: string; today: string }) {
  const [state, action] = useFormState(addTransaction, {});
  const [type, setType] = useState("EXPENSE");
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [toRaw, setTo] = useState(accounts[1]?.id ?? "");
  const [newCat, setNewCat] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const t = useT();

  const to = toRaw !== from ? toRaw : accounts.find((a) => a.id !== from)?.id ?? "";
  const cur = (id: string) => accounts.find((a) => a.id === id)?.currency ?? "UZS";
  const transfer = type === "TRANSFER";
  const exchange = transfer && cur(from) !== cur(to);

  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    setNewCat(false);
  }, [state]);

  return (
    <div className="card">
      <div className="seg mb-4 max-w-full overflow-x-auto">
        {TABS.map(([v, key]) => (
          <button key={v} type="button" aria-pressed={type === v} className="whitespace-nowrap" onClick={() => (setType(v), setNewCat(false))}>
            {t[key]}
          </button>
        ))}
      </div>

      <form ref={form} action={action} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <input type="hidden" name="type" value={type} />
        <div>
          <label className="label">{t.amount} ({cur(from)})</label>
          <input name="amount" className="input num text-base font-semibold" inputMode="decimal" required placeholder="0" autoComplete="off" />
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
                <select name="categoryId" className="input" key={type} onChange={(e) => e.target.value === NEW && setNewCat(true)}>
                  {categories.filter((c) => c.kind === type).map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
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
