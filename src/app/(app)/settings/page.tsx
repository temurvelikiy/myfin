import { archiveCategory, changePassword, saveCategory, saveSettings } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tn } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { StateForm, Submit } from "@/components/StateForm";
import { LangSwitch } from "@/components/I18n";
import { ThemeToggle } from "@/components/Theme";
import { AvatarEditor } from "@/components/AvatarEditor";

export default async function Settings() {
  const user = await requireUser();
  const t = getT();
  const categories = await prisma.category.findMany({ where: { userId: user.id }, orderBy: [{ archived: "asc" }, { name: "asc" }] });

  const CatList = ({ kind, title }: { kind: string; title: string }) => (
    <section className="card">
      <h2 className="h2">{title}</h2>
      <ul className="divide-y divide-slate-100">
        {categories.filter((c) => c.kind === kind).map((c) => (
          <li key={c.id} className={`py-2 ${c.archived ? "opacity-50" : ""}`}>
            <StateForm action={saveCategory} className="grid grid-cols-[3rem_1fr_auto] gap-2 md:grid-cols-[3rem_12rem_1fr_auto]">
              <input type="hidden" name="id" value={c.id} />
              <input name="icon" className="input px-1 text-center" defaultValue={c.icon} aria-label={t.icon} />
              {/* Standart nom bo'lsa, tarjimasi kursor ostida ko'rinadi; saqlangan nom o'zgarmaydi. */}
              <input name="name" className="input" defaultValue={c.name} title={tn(t, c.name)} required aria-label={t.name} />
              <input name="keywords" className="input col-span-2 md:col-span-1" defaultValue={c.keywords} placeholder={t.keywordsPlaceholder} aria-label={t.keywords} />
              <Submit className="btn-ghost h-10">{t.save}</Submit>
            </StateForm>
            <form action={archiveCategory} className="mt-1">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="archived" value={c.archived ? "0" : "1"} />
              <button className="text-xs text-slate-400 hover:text-slate-700">{c.archived ? t.restore : t.archive}</button>
            </form>
          </li>
        ))}
      </ul>
      <StateForm action={saveCategory} resetOnOk className="mt-3 grid grid-cols-[3rem_1fr_auto] gap-2 border-t border-slate-100 pt-3 md:grid-cols-[3rem_12rem_1fr_auto]">
        <input type="hidden" name="kind" value={kind} />
        <input name="icon" className="input px-1 text-center" placeholder="📦" aria-label={t.icon} />
        <input name="name" className="input" placeholder={t.newCategory} required aria-label={t.name} />
        <input name="keywords" className="input col-span-2 md:col-span-1" placeholder={t.keywordsPlaceholder} aria-label={t.keywords} />
        <Submit>{t.add}</Submit>
      </StateForm>
    </section>
  );

  return (
    <>
      <h1 className="h1">{t.navSettings}</h1>

      <section className="card">
        <h2 className="h2">{t.profile}</h2>
        <AvatarEditor current={user.avatar} name={user.login} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">{t.general}</h2>
          <div className="mb-3 flex flex-wrap gap-4">
            <div>
              <span className="label">{t.language}</span>
              <LangSwitch />
            </div>
            <div>
              <span className="label">{t.theme}</span>
              <ThemeToggle />
            </div>
          </div>
          <StateForm action={saveSettings} className="space-y-3">
            <div>
              <label className="label">{t.usdRateLabel}</label>
              <input name="usdRate" className="input num" inputMode="decimal" defaultValue={user.usdRate} required />
            </div>
            <div>
              <label className="label">{t.savingsTargetLabel}</label>
              <input name="savingsTarget" className="input num" inputMode="numeric" defaultValue={user.savingsTarget} required />
            </div>
            <div>
              <label className="label">{t.telegramIdLabel}</label>
              <input name="telegramId" className="input num" inputMode="numeric" defaultValue={user.telegramId ?? ""} placeholder={t.telegramPlaceholder} />
            </div>
            <Submit>{t.save}</Submit>
          </StateForm>
        </section>

        <section className="card">
          <h2 className="h2">{t.changePassword}</h2>
          <StateForm action={changePassword} resetOnOk className="space-y-3">
            <div>
              <label className="label">{t.currentPassword}</label>
              <input name="current" type="password" className="input" autoComplete="current-password" required />
            </div>
            <div>
              <label className="label">{t.newPassword}</label>
              <input name="next" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label className="label">{t.repeatPassword}</label>
              <input name="repeat" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <Submit>{t.change}</Submit>
          </StateForm>
        </section>
      </div>

      <p className="text-sm text-slate-500">
        {t.keywordsHint} <code>{t.keywordsExample}</code>
      </p>
      <CatList kind="EXPENSE" title={t.expenseCats} />
      <CatList kind="INCOME" title={t.incomeCats} />
    </>
  );
}
