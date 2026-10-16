import type { Config } from "tailwindcss";

// Palitra: ko'k (asosiy), oq (fon va kartalar), shaftoli (iliq aksent).
// slate, peach, card va grafik ranglari CSS o'zgaruvchilari orqali beriladi —
// tun rejimida globals.css dagi .dark bloki ularni almashtiradi.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix: string, steps: number[]) => Object.fromEntries(steps.map((s) => [s, v(`${prefix}-${s}`)]));

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
      },
      colors: {
        card: v("card"),
        slate: scale("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        peach: scale("peach", [50, 100, 200, 300, 400, 500, 600, 700]),
        // Grafiklardagi ikki qator: rang ko'rligida ham ajraladigan juftlik (kun va tun uchun alohida tekshirilgan).
        income: v("income"),
        expense: v("expense"),
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,58,138,.04), 0 12px 32px -16px rgba(30,58,138,.14)",
      },
    },
  },
  plugins: [],
};

export default config;
