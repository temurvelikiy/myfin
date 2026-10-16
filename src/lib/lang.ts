import { cookies } from "next/headers";
import { DICTS, isLang, type Lang } from "./i18n";

export const LANG_COOKIE = "lang";

// Tanlangan til cookie'da saqlanadi; tanlanmagan bo'lsa — o'zbekcha.
export function getLang(): Lang {
  const v = cookies().get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "uz";
}

export const getT = () => DICTS[getLang()];
