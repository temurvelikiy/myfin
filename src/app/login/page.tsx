import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { getUser } from "@/lib/auth";
import { getT } from "@/lib/lang";
import { StateForm, Submit } from "@/components/StateForm";
import { LangSwitch } from "@/components/I18n";
import { ThemeToggle } from "@/components/Theme";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const t = getT();
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-4 dark:from-[#16264f] dark:via-[#101d3d] dark:to-[#0a1120]">
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-peach-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle dark />
        <LangSwitch dark />
      </div>
      <div className="relative w-full max-w-sm rounded-3xl bg-card p-7 shadow-2xl shadow-blue-950/30">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-peach-300 to-peach-500 text-2xl text-white shadow-lg shadow-peach-500/40">₿</div>
          <h1 className="text-2xl font-bold tracking-tight">MyFin</h1>
          <p className="mt-1 text-sm text-slate-500">{t.tagline}</p>
        </div>
        <StateForm action={login} className="space-y-4">
          <div>
            <label className="label" htmlFor="login">{t.login}</label>
            <input id="login" name="login" className="input" autoComplete="username" autoFocus required />
          </div>
          <div>
            <label className="label" htmlFor="password">{t.password}</label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
          <Submit className="btn w-full">{t.signIn}</Submit>
        </StateForm>
      </div>
    </main>
  );
}
