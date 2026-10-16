"use client";

import { useRef, useState, useTransition } from "react";
import { confirmQuick, previewQuick } from "@/app/actions";
import type { Parsed } from "@/lib/parse";
import { useT } from "./I18n";

type Acc = { id: string; name: string };
type Cat = { id: string; name: string; icon: string; kind: string };

// Botdagi kabi bir qatorli kiritish: yozing -> taxminni ko'ring -> bitta tugma bilan tasdiqlang.
export function QuickEntry({ accounts, categories }: { accounts: Acc[]; categories: Cat[] }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ parsed: Parsed; summary: string } | null>(null);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string; warning?: string | null }>({});
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const t = useT();

  const preview = () =>
    start(async () => {
      const r = await previewQuick(text);
      if ("error" in r) return setMsg({ error: r.error });
      setMsg({});
      setDraft(r as { parsed: Parsed; summary: string });
      setAccountId(r.parsed!.accountId);
      setCategoryId(r.parsed!.categoryId ?? "");
    });

  const confirm = () =>
    start(async () => {
      const r = await confirmQuick(text, accountId, categoryId);
      if ("error" in r) return setMsg({ error: r.error });
      setMsg({ ok: r.ok, warning: r.warning });
      setDraft(null);
      setText("");
      input.current?.focus();
    });

  const editable = draft && (draft.parsed.type === "EXPENSE" || draft.parsed.type === "INCOME");

  return (
    <div className="card">
      <h2 className="h2">{t.quickEntry}</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft) confirm();
          else if (text.trim()) preview();
        }}
      >
        <input
          ref={input}
          className="input"
          placeholder={t.quickPlaceholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDraft(null);
          }}
          autoComplete="off"
        />
        {!draft && (
          <button className="btn shrink-0" disabled={pending || !text.trim()}>
            {t.write}
          </button>
        )}
      </form>

      {draft && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium">{draft.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {draft.parsed.type !== "TRANSFER" && (
              <select className="input w-auto" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label={t.account}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            {editable && (
              <select className="input w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label={t.category}>
                {categories
                  .filter((c) => c.kind === draft.parsed.type)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
            )}
            <button className="btn" onClick={confirm} disabled={pending} autoFocus>
              {t.confirm}
            </button>
            <button className="btn-ghost" onClick={() => setDraft(null)} disabled={pending}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {msg.error && <p className="mt-2 text-sm text-red-600">{msg.error}</p>}
      {msg.ok && <p className="mt-2 text-sm text-blue-700">{t.savedPrefix} {msg.ok}</p>}
      {msg.warning && <p className="mt-1 text-sm font-medium text-amber-700">{msg.warning}</p>}
      <p className="mt-2 text-xs text-slate-400">
        {t.hintTransfer}: <code>{t.exTransfer}</code> · {t.hintDebt}: <code>{t.exDebt}</code> · {t.hintDollar}: <code>{t.exDollar}</code>
      </p>
    </div>
  );
}
