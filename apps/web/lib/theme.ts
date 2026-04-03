export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "nexid_theme";

function isTheme(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(value) ? value : null;
}

export function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(): ThemeMode {
  return getStoredTheme() || getSystemTheme();
}

export function applyTheme(
  theme: ThemeMode,
  options: {
    persist?: boolean;
    withTransition?: boolean;
  } = {}
) {
  if (typeof document === "undefined") return;
  const { persist = true, withTransition = true } = options;
  const root = document.documentElement;

  if (withTransition) {
    root.classList.add("theme-transition");
    window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 240);
  }

  root.classList.toggle("theme-dark", theme === "dark");
  root.dataset.theme = theme;

  if (persist && typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

