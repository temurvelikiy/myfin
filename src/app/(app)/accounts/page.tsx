import { archiveAccount, reconcileAccount, saveAccount } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getAccounts } from "@/lib/finance";
import { fmt } from "@/lib/format";
import { fill, tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { StateForm, Submit } from "@/components/StateForm";

export default async function Accounts() {
  const user = await requireUser();
  const t = getT();
  const all = await getAccounts(user.id, true);
  const active = all.filter((a) => !a.archived);
  const archived = all.filter((a) => a.archived);
  const total = (cur: string) => active.filter((a) => a.currency === cur).reduce((s, a) => s + a.balance, 0);
  const KIND: Record<string, string> = { CASH: t.kindCash, CARD: t.kindCard, WALLET: t.kindWallet };

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="h1">{t.navAccounts}</h1>
        <p className="num text-sm text-slate-500">
          {t.total}: <b className="text-slate-900">{fmt(total("UZS"))}</b> + <b className="text-slate-900">{fmt(total("USD"), "USD")}</b>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {active.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">
                  {KIND[a.kind]} · {a.currency}
                  {a.isDefault && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{t.mainBadge}</span>}
                </p>
                <p className="font-medium">{tn(t, a.name)}</p>
              </div>
              <p className={`num text-lg font-semibold ${a.balance < 0 ? "text-red-600" : ""}`}>{fmt(a.balance, a.currency)}</p>
            </div>

            <details className="mt-3 border-t border-slate-100 pt-2">
              <summary className="cursor-pointer text-xs text-blue-700">{t.reconcile}</summary>
              <StateForm action={reconcileAccount} resetOnOk className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input name="real" className="input num" inputMode="decimal" placeholder={fill(t.realPlaceholder, { c: a.currency })} required aria-label={t.realAria} />
                <Submit>{t.reconcileBtn}</Submit>
              </StateForm>
              <p className="mt-1 text-xs text-slate-400">{t.reconcileHint}</p>
            </details>

            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500">{t.edit}</summary>
              <StateForm action={saveAccount} className="mt-2 grid grid-cols-2 gap-2">
                <input type="hidden" name="id" value={a.id} />
                <div>
                  <label className="label">{t.name}</label>
                  <input name="name" className="input" defaultValue={a.name} required />
                </div>
                <div>
                  <label className="label">{t.initialBalance}</label>
                  <input name="initial" className="input num" inputMode="decimal" defaultValue={a.initial} />
                </div>
                <div className="col-span-2">
                  <label className="label">{t.keywordsBot}</label>
                  <input name="keywords" className="input" defaultValue={a.keywords} />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isDefault" defaultChecked={a.isDefault} /> {fill(t.defaultFor, { c: a.currency })}
                </label>
                <Submit>{t.save}</Submit>
              </StateForm>
              <form action={archiveAccount} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="archived" value="1" />
                <button className="text-xs text-red-600 hover:underline">{t.archive}</button>
              </form>
            </details>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="h2">{t.newAccount}</h2>
        <StateForm action={saveAccount} resetOnOk className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <label className="label">{t.name}</label>
            <input name="name" className="input" placeholder={t.accNamePlaceholder} required />
          </div>
          <div>
            <label className="label">{t.kind}</label>
            <select name="kind" className="input">
              <option value="CARD">{t.card}</option>
              <option value="CASH">{t.cash}</option>
              <option value="WALLET">{t.wallet}</option>
            </select>
          </div>
          <div>
            <label className="label">{t.currency}</label>
            <select name="currency" className="input">
              <option>UZS</option>
              <option>USD</option>
            </select>
          </div>
          <div>
            <label className="label">{t.currentBalance}</label>
            <input name="initial" className="input num" inputMode="decimal" placeholder="0" />
          </div>
          <div>
            <label className="label">{t.keywords}</label>
            <input name="keywords" className="input" placeholder="kapital,visa" />
          </div>
          <div className="col-span-full">
            <Submit>{t.add}</Submit>
          </div>
        </StateForm>
      </section>

      {archived.length > 0 && (
        <section className="card">
          <h2 className="h2">{t.archived}</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">{tn(t, a.name)} · {fmt(a.balance, a.currency)}</span>
                <form action={archiveAccount}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="archived" value="0" />
                  <button className="text-xs text-blue-700 hover:underline">{t.restore}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
