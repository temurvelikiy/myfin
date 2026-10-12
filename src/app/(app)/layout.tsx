import Link from "next/link";
import { logout } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";

const Logo = () => (
  <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-sm shadow-lg shadow-emerald-500/30">₿</span>
    <span>
      <span className="text-emerald-400">My</span>Fin
    </span>
  </Link>
);

// Shu guruhdagi barcha sahifalar faqat tizimga kirgan foydalanuvchi uchun.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-950 p-4 md:flex">
        <div className="px-2 py-2">
          <Logo />
        </div>
        <div className="mt-6 flex-1">
          <Nav />
        </div>
        <form action={logout} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-200">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold uppercase text-emerald-300">{user.login[0]}</span>
            <span className="truncate">{user.login}</span>
          </span>
          <button className="text-xs text-slate-400 hover:text-white">Chiqish</button>
        </form>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-950 px-4 py-3 md:hidden">
        <Logo />
        <form action={logout}>
          <button className="text-xs text-slate-400 hover:text-white">Chiqish</button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 pb-24 md:space-y-5 md:p-8">{children}</main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <Nav mobile />
      </div>
    </div>
  );
}
