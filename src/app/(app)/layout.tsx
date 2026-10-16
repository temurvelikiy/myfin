import Link from "next/link";
import { logout } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/lang";
import { Nav } from "@/components/Nav";
import { LangSwitch } from "@/components/I18n";
import { ThemeToggle } from "@/components/Theme";
import { Avatar } from "@/components/Avatar";

const Logo = () => (
  <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-peach-300 to-peach-500 text-sm shadow-lg shadow-peach-500/40">₿</span>
    <span>
      <span className="text-peach-300">My</span>Fin
    </span>
  </Link>
);

// Shu guruhdagi barcha sahifalar faqat tizimga kirgan foydalanuvchi uchun.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = getT();
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 p-4 dark:from-[#16264f] dark:via-[#101d3d] dark:to-[#0a1328] md:flex">
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-peach-400/25 blur-3xl" />
        <div className="relative px-2 py-2">
          <Logo />
        </div>
        <div className="relative mt-6 flex-1">
          <Nav />
        </div>
        <div className="relative mb-3 flex items-center gap-2 px-1">
          <LangSwitch dark />
          <ThemeToggle dark />
        </div>
        <form action={logout} className="relative flex items-center justify-between rounded-xl bg-white/10 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm text-white">
            <Avatar src={user.avatar} name={user.login} size={28} />
            <span className="truncate">{user.login}</span>
          </span>
          <button className="text-xs text-blue-100 hover:text-white">{t.logout}</button>
        </form>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-3 shadow-md dark:from-[#16264f] dark:to-[#0f1b3a] md:hidden">
        <Logo />
        <form action={logout} className="flex items-center gap-2">
          <ThemeToggle dark compact />
          <LangSwitch dark />
          <button className="text-xs text-blue-100 hover:text-white">{t.logout}</button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 pb-24 md:space-y-5 md:p-8">{children}</main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-peach-100 bg-card/95 px-1 shadow-[0_-8px_24px_-12px_rgba(30,58,138,.18)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <Nav mobile />
      </div>
    </div>
  );
}
