// Intl ishlatilmaydi: server va brauzer lokali farq qilsa hydration xatosi chiqadi.
export function group(n: number, decimals = 0) {
  const neg = n < 0;
  const [int, frac] = Math.abs(n).toFixed(decimals).split(".");
  const s = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (neg ? "−" : "") + s + (frac ? "." + frac : "");
}

export function fmt(n: number, currency = "UZS") {
  if (currency === "USD") return (n < 0 ? "−" : "") + "$" + group(Math.abs(n), 2).replace(/\.00$/, "");
  return group(Math.round(n)) + " so'm";
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Grafik o'qlari va kalendar uchun qisqa ko'rinish: 1 250 000 -> "1.3 mln"
export function fmtShort(n: number) {
  const a = Math.abs(n);
  const f = (v: number, unit: string) => (v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "")) + unit;
  if (a >= 1e9) return f(a / 1e9, " mlrd");
  if (a >= 1e6) return f(a / 1e6, " mln");
  if (a >= 1e3) return f(a / 1e3, " ming");
  return String(Math.round(a));
}

// Oldingi davrga nisbatan o'zgarish, foizda. Oldingi davr bo'sh bo'lsa null.
export const change = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
