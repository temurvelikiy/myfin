import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { getUser } from "@/lib/auth";
import { StateForm, Submit } from "@/components/StateForm";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-2xl text-white">₿</div>
          <h1 className="text-2xl font-bold tracking-tight">MyFin</h1>
          <p className="mt-1 text-sm text-slate-500">Shaxsiy moliya platformasi</p>
        </div>
        <StateForm action={login} className="space-y-4">
          <div>
            <label className="label" htmlFor="login">Login</label>
            <input id="login" name="login" className="input" autoComplete="username" autoFocus required />
          </div>
          <div>
            <label className="label" htmlFor="password">Parol</label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
          <Submit className="btn w-full">Kirish</Submit>
        </StateForm>
      </div>
    </main>
  );
}
