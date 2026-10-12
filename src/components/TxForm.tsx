"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addTransaction } from "@/app/actions";
import { Submit } from "./StateForm";

type Acc = { id: string; name: string; currency: string };
type Cat = { id: string; name: string; icon: string; kind: string };

const TABS = [
  ["EXPENSE", "Xarajat"],
  ["INCOME", "Daromad"],
  ["TRANSFER", "O'tkazma / ayirboshlash"],
];
const NEW = "__new";

export function TxForm({ accounts, categories, day, today }: { accounts: Acc[]; categories: Cat[]; day: string; today: string }) {
  const [state, action] = useFormState(addTransaction, {});
  const [type, setType] = useState("EXPENSE");
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [toRaw, setTo] = useState(accounts[1]?.id ?? "");
  const [newCat, setNewCat] = useState(false);
  const form = useRef<HTMLFormElement>(null);

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
        {TABS.map(([v, label]) => (
          <button key={v} type="button" aria-pressed={type === v} className="whitespace-nowrap" onClick={() => (setType(v), setNewCat(false))}>
            {label}
          </button>
        ))}
      </div>

      <form ref={form} action={action} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <input type="hidden" name="type" value={type} />
        <div>
          <label className="label">Summa ({cur(from)})</label>
          <input name="amount" className="input num text-base font-semibold" inputMode="decimal" required placeholder="0" autoComplete="off" />
        </div>
        <div>
          <label className="label">{transfer ? "Qaysi hisobdan" : "Hisob"}</label>
          <select name="accountId" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {transfer ? (
          <>
            <div>
              <label className="label">Qaysi hisobga</label>
              <select name="toAccountId" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                {accounts.filter((a) => a.id !== from).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {exchange && (
              <div>
                <label className="label">Olingan summa ({cur(to)})</label>
                <input name="toAmount" className="input num" inputMode="decimal" required placeholder="0" autoComplete="off" />
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="label">Kategoriya</label>
              {newCat ? (
                <div className="flex gap-1.5">
                  <input name="newCategory" className="input" placeholder="Yangi kategoriya nomi" maxLength={40} required autoFocus />
                  <button type="button" className="btn-ghost h-10 shrink-0 px-2.5" onClick={() => setNewCat(false)} title="Ro'yxatdan tanlash" aria-label="Ro'yxatdan tanlash">
                    ✕
                  </button>
                </div>
              ) : (
                <select name="categoryId" className="input" key={type} onChange={(e) => e.target.value === NEW && setNewCat(true)}>
                  {categories.filter((c) => c.kind === type).map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                  <option value={NEW}>➕ Yangi kategoriya qo&apos;shish…</option>
                </select>
              )}
            </div>
            <div>
              <label className="label">Turi</label>
              <select name="scope" className="input">
                <option value="PERSONAL">Shaxsiy</option>
                <option value="BUSINESS">Biznes</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className="label">Sana</label>
          <input name="date" type="date" className="input" defaultValue={day} key={day} max={today} />
        </div>
        <div className="col-span-2">
          <label className="label">Izoh</label>
          <input name="note" className="input" maxLength={200} placeholder="Ixtiyoriy" />
        </div>
        <div className="col-span-2 flex items-end lg:col-span-1">
          <Submit className="btn w-full">Saqlash</Submit>
        </div>
        {(state.error || state.ok) && (
          <p role="status" className={`col-span-full text-sm ${state.error ? "text-red-600" : "text-emerald-700"}`}>
            {state.error ?? `✓ ${state.ok}`}
          </p>
        )}
      </form>
    </div>
  );
}
