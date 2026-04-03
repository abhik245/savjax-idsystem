import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SAVJAX ID Systems",
  description: "Institutional ID lifecycle SaaS"
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
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
