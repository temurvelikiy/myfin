"use client";

import { useEffect, useState } from "react";
import { useT } from "./I18n";

type Mode = "light" | "dark" | "auto";
const KEY = "myfin-theme";
const ICON: Record<Mode, string> = { light: "☀️", dark: "🌙", auto: "🖥️" };
const NEXT: Record<Mode, Mode> = { light: "dark", dark: "auto", auto: "light" };

// Sahifa chizilishidan oldin <head> da ishlaydi — oq "miltillash" bo'lmasligi uchun.
export const THEME_SCRIPT = `try{var m=localStorage.getItem('${KEY}')||'auto';if(m==='dark'||(m==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

function readMode(): Mode {
  try {
    const m = localStorage.getItem(KEY);
    return m === "light" || m === "dark" ? m : "auto";
  } catch {
    return "auto";
  }
}

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// Bosilganda: kun → tun → avtomatik (qurilma sozlamasi) → kun …
export function ThemeToggle({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    setMode(readMode());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readMode() === "auto" && apply("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const label = { light: t.themeLight, dark: t.themeDark, auto: t.themeAuto }[mode];
  const toggle = () => {
    const next = NEXT[mode];
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    apply(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={`${t.theme}: ${label}`}
      aria-label={`${t.theme}: ${label}`}
      className={
        dark
          ? "inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white hover:bg-white/20"
          : "btn-ghost gap-1.5 text-xs"
      }
    >
      <span>{ICON[mode]}</span>
      {!compact && <span>{label}</span>}
    </button>
  );
}
