import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
      },
      colors: {
        // Grafiklardagi ikki qator: rang ko'rligida ham ajraladigan juftlik (tekshirilgan).
        income: "#0d9488",
        expense: "#eb6834",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 12px 32px -16px rgba(16,24,40,.12)",
      },
    },
  },
  plugins: [],
};

export default config;
