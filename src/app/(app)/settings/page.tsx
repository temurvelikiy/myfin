import { archiveCategory, changePassword, saveCategory, saveSettings } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StateForm, Submit } from "@/components/StateForm";

export default async function Settings() {
  const user = await requireUser();
  const categories = await prisma.category.findMany({ where: { userId: user.id }, orderBy: [{ archived: "asc" }, { name: "asc" }] });

  const CatList = ({ kind, title }: { kind: string; title: string }) => (
    <section className="card">
      <h2 className="h2">{title}</h2>
      <ul className="divide-y divide-slate-100">
        {categories.filter((c) => c.kind === kind).map((c) => (
          <li key={c.id} className={`py-2 ${c.archived ? "opacity-50" : ""}`}>
            <StateForm action={saveCategory} className="grid grid-cols-[3rem_1fr_auto] gap-2 md:grid-cols-[3rem_12rem_1fr_auto]">
              <input type="hidden" name="id" value={c.id} />
              <input name="icon" className="input px-1 text-center" defaultValue={c.icon} aria-label="Belgi" />
              <input name="name" className="input" defaultValue={c.name} required aria-label="Nomi" />
              <input name="keywords" className="input col-span-2 md:col-span-1" defaultValue={c.keywords} placeholder="kalit so'zlar, vergul bilan" aria-label="Kalit so'zlar" />
              <Submit className="btn-ghost">Saqlash</Submit>
            </StateForm>
            <form action={archiveCategory} className="mt-1">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="archived" value={c.archived ? "0" : "1"} />
              <button className="text-xs text-slate-400 hover:text-slate-700">{c.archived ? "Qaytarish" : "Arxivlash"}</button>
            </form>
          </li>
        ))}
      </ul>
      <StateForm action={saveCategory} resetOnOk className="mt-3 grid grid-cols-[3rem_1fr_auto] gap-2 border-t border-slate-100 pt-3 md:grid-cols-[3rem_12rem_1fr_auto]">
        <input type="hidden" name="kind" value={kind} />
        <input name="icon" className="input px-1 text-center" placeholder="📦" aria-label="Belgi" />
        <input name="name" className="input" placeholder="Yangi kategoriya" required aria-label="Nomi" />
        <input name="keywords" className="input col-span-2 md:col-span-1" placeholder="kalit so'zlar, vergul bilan" aria-label="Kalit so'zlar" />
        <Submit>Qo&apos;shish</Submit>
      </StateForm>
    </section>
  );

  return (
    <>
      <h1 className="h1">Sozlamalar</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Umumiy</h2>
          <StateForm action={saveSettings} className="space-y-3">
            <div>
              <label className="label">1 USD kursi (so&apos;m) — hisobotlarda dollarni so&apos;mga o&apos;girish uchun</label>
              <input name="usdRate" className="input num" inputMode="decimal" defaultValue={user.usdRate} required />
            </div>
            <div>
              <label className="label">Jamg&apos;arma maqsadi (daromadning % i)</label>
              <input name="savingsTarget" className="input num" inputMode="numeric" defaultValue={user.savingsTarget} required />
            </div>
            <div>
              <label className="label">Telegram ID — botga yozsangiz, u ID raqamingizni aytadi</label>
              <input name="telegramId" className="input num" inputMode="numeric" defaultValue={user.telegramId ?? ""} placeholder="masalan 123456789" />
            </div>
            <Submit>Saqlash</Submit>
          </StateForm>
        </section>

        <section className="card">
          <h2 className="h2">Parolni almashtirish</h2>
          <StateForm action={changePassword} resetOnOk className="space-y-3">
            <div>
              <label className="label">Joriy parol</label>
              <input name="current" type="password" className="input" autoComplete="current-password" required />
            </div>
            <div>
              <label className="label">Yangi parol (kamida 8 belgi)</label>
              <input name="next" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label className="label">Yangi parol (takroran)</label>
              <input name="repeat" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <Submit>Almashtirish</Submit>
          </StateForm>
        </section>
      </div>

      <p className="text-sm text-slate-500">
        Kalit so&apos;zlar bot va tezkor kiritishda kategoriyani taxmin qilish uchun ishlatiladi: <code>45000 taksi</code> → Transport.
      </p>
      <CatList kind="EXPENSE" title="Xarajat kategoriyalari" />
      <CatList kind="INCOME" title="Daromad kategoriyalari" />
    </>
  );
}
