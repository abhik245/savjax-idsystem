import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SAVJAX ID Systems",
  description: "Institutional ID lifecycle SaaS",
  icons: {
    icon: "/x-sav.png",
    shortcut: "/x-sav.png",
    apple: "/x-sav.png"
  }
};

const themeInitScript = `
(() => {
  try {
    const key = "nexid_theme";
    const stored = window.localStorage.getItem(key);
    const theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    const root = document.documentElement;
    root.classList.toggle("theme-dark", theme === "dark");
    root.dataset.theme = theme;
  } catch {
    // no-op
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/x-sav.png" sizes="any" />
        <link rel="shortcut icon" href="/x-sav.png" />
        <link rel="apple-touch-icon" href="/x-sav.png" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
