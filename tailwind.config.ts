import type { Config } from "tailwindcss";

// Palitra: ko'k (asosiy), oq (fon va kartalar), shaftoli (iliq aksent).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
      },
      colors: {
        peach: {
          50: "#fff8f3",
          100: "#ffeee2",
          200: "#ffdcc6",
          300: "#fcc6a3",
          400: "#f6a87e",
          500: "#ee8b5c",
          600: "#d96c3d",
          700: "#b4532d",
        },
        // Grafiklardagi ikki qator: rang ko'rligida ham ajraladigan juftlik (validator bilan tekshirilgan).
        income: "#2563eb",
        expense: "#e8794a",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,58,138,.04), 0 12px 32px -16px rgba(30,58,138,.14)",
      },
    },
  },
  plugins: [],
};

export default config;
