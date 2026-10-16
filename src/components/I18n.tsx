"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLang } from "@/app/actions";
import { DICTS, LANG_NAMES, LANGS, type Lang } from "@/lib/i18n";

const Ctx = createContext<Lang>("uz");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
export const useT = () => DICTS[useContext(Ctx)];

export function LangSwitch({ dark }: { dark?: boolean }) {
  const lang = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Til / Язык / Language / Dil"
      value={lang}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await setLang(e.target.value);
          router.refresh();
        })
      }
      className={
        dark
          ? "cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white outline-none hover:bg-white/20 [&>option]:text-slate-900"
          : "input h-9 w-auto text-xs"
      }
    >
      {LANGS.map((l) => (
        <option key={l} value={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  );
}
