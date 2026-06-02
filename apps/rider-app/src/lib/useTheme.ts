import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "rider-theme";

/**
 * Get system theme preference
 */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Load saved theme preference or fallback to system default
 */
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    
    /* Legacy support: convert old boolean value to new format */
    if (stored === "true") return "dark";
    if (stored === "false") return "light";
  } catch {
    /* localStorage unavailable */
  }
  return "system";
}

/**
 * Apply theme to DOM — adds/removes 'light' class; 'dark' is fallback
 */
function applyTheme(resolvedTheme: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolvedTheme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }
  root.setAttribute("data-theme", resolvedTheme);
}

/**
 * useTheme hook — manages app theme (light/dark/system)
 * 
 * Returns:
 *   - theme: current setting ("light", "dark", or "system")
 *   - setTheme: change theme setting
 *   - resolvedTheme: actual rendering theme ("light" or "dark")
 *   - mounted: whether component has mounted (for SSR safety)
 */
export function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  /* Initialize on mount */
  useEffect(() => {
    const initial = getInitialTheme();
    setThemeState(initial);

    /* Determine the resolved theme */
    const resolved = initial === "system" ? getSystemTheme() : initial;
    setResolvedTheme(resolved);
    applyTheme(resolved);
    setMounted(true);
  }, []);

  /* Watch system preference changes when in "system" mode */
  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    /* Use addEventListener if available (modern browsers) */
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else if ((mediaQuery as any).addListener) {
      /* Fallback for older browsers */
      (mediaQuery as any).addListener(handleChange);
      return () => (mediaQuery as any).removeListener(handleChange);
    }
    /* No cleanup needed if neither method is available */
    return undefined;
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      /* localStorage may be unavailable */
    }

    /* Apply theme immediately */
    const resolved = newTheme === "system" ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  /* Legacy API for backward compatibility */
  const isDark = resolvedTheme === "dark";
  const toggleDark = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  return {
    theme,
    setTheme,
    resolvedTheme,
    mounted,
    /* Legacy */
    isDark,
    toggleDark,
  };
}
