import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getLang } from "@/lib/lang";
import { I18nProvider } from "@/components/I18n";
import { THEME_SCRIPT } from "@/components/Theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "MyFin",
  description: "Personal finance",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
