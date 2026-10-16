// Barcha "kun" va "oy" chegaralari Toshkent vaqti (UTC+5) bo'yicha hisoblanadi.
import { DICTS, fill, type Dict } from "./i18n";

const OFF = 5 * 3600e3;
const UZ = DICTS.uz;

export const dayStr = (d: Date) => new Date(d.getTime() + OFF).toISOString().slice(0, 10);
export const todayStr = () => dayStr(new Date());
export const currentYm = () => todayStr().slice(0, 7);

export const validYm = (s?: string | null) =>
  s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : currentYm();

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - OFF),
    end: new Date(Date.UTC(y, m, 1) - OFF),
  };
}

export function shiftYm(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthLabel(ym: string, t: Dict = UZ) {
  const [y, m] = ym.split("-").map(Number);
  return `${t.months[m - 1]} ${y}`;
}

export const validDay = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// "YYYY-MM-DD" -> Date. Bugungi kun bo'lsa hozirgi vaqt, aks holda o'sha kun tushi.
export function parseDay(s?: string | null) {
  if (!validDay(s) || s === todayStr()) return new Date();
  return new Date(`${s}T12:00:00+05:00`);
}

export function shortDay(d: Date) {
  const [, m, day] = dayStr(d).split("-");
  return `${day}.${m}`;
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Hafta dushanbadan boshlanadi.
export function weekStart(day: string) {
  const wd = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -wd);
}

export const dayRange = (day: string) => ({
  start: new Date(`${day}T00:00:00+05:00`),
  end: new Date(`${addDays(day, 1)}T00:00:00+05:00`),
});

export const monthShort = (ym: string, t: Dict = UZ) => t.months[Number(ym.slice(5, 7)) - 1].slice(0, 3);

// "2026-09-30" -> "30-sentabr, Chorshanba" (til shabloniga ko'ra)
export function dayLabel(day: string, t: Dict = UZ) {
  const d = new Date(`${day}T00:00:00Z`);
  return fill(t.dayLabelFmt, { d: d.getUTCDate(), m: t.monthsGen[d.getUTCMonth()], w: t.weekdays[d.getUTCDay()] });
}
