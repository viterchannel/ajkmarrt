/**
 * ThemeProvider — Global theme wrapper for all AJKMart apps.
 *
 * Usage:
 *   <ThemeProvider
 *     appRole="admin"
 *     defaultTheme="light-mode"
 *     storageKey="admin_theme"
 *   >
 *     <App />
 *   </ThemeProvider>
 *
 * What it does:
 *   1. Resolves the active theme from the registry (or admin API config).
 *   2. Applies all CSS custom properties to <html> as data attributes + inline vars.
 *   3. Sets the `color-scheme` meta and `data-theme` attribute.
 *   4. Persists the user's theme choice to localStorage.
 *   5. Fetches admin-config theme override on mount (if available).
 *   6. Exposes ThemeContext consumed by useTheme().
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./ThemeContext.js";
import { darkGoldTheme } from "../config/themes/dark-gold.js";
import { lightModeTheme, lightModeDarkVariant } from "../config/themes/light-mode.js";
import { darkBlueTheme, darkNavyTheme, highContrastTheme } from "../config/themes/custom-themes.js";
import { BrandColors } from "../config/brand.js";
import type { ThemeDefinition, ThemeContextValue, AppRole } from "../config/themes/types.js";

// ─── Theme Registry ───────────────────────────────────────────────────────────

const THEME_REGISTRY: Record<string, ThemeDefinition> = {
  "dark-gold":      darkGoldTheme,
  "light-mode":     lightModeTheme,
  "dark-blue":      darkBlueTheme,
  "dark-navy":      darkNavyTheme,
  "high-contrast":  highContrastTheme,
};

// Paired dark/light toggles: clicking toggleDark() swaps between these
const DARK_LIGHT_PAIRS: Record<string, string> = {
  "light-mode":  "dark-navy",
  "dark-navy":   "light-mode",
  "dark-gold":   "dark-gold",    // no light variant; stays
  "dark-blue":   "dark-blue",    // no light variant; stays
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyTheme(theme: ThemeDefinition, darkOverride?: Record<string, string>): void {
  const root = document.documentElement;
  const vars = darkOverride ? { ...theme.cssVars, ...darkOverride } : theme.cssVars;

  // Apply every CSS var as a style property
  Object.entries(vars).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });

  // Set color-scheme so browser native UI (scrollbars, inputs) adapts
  root.style.colorScheme = theme.colorScheme === "dark" ? "dark" : "light";

  // data-theme for CSS selectors and DevTools inspection
  root.setAttribute("data-theme", theme.id);

  // class toggle for Tailwind's `dark:` variant
  if (theme.colorScheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function resolveSystemScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Which app this ThemeProvider is serving */
  appRole: AppRole;
  /** Initial theme ID. Defaults to "dark-gold". */
  defaultTheme?: string;
  /** localStorage key for persisting user preference. */
  storageKey?: string;
  /** When true, ignores localStorage and always uses defaultTheme. */
  disablePersistence?: boolean;
  /** When true, skips the admin API theme fetch on mount. */
  disableAdminFetch?: boolean;
  /** Admin API endpoint for theme config. */
  adminConfigEndpoint?: string;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({
  children,
  appRole,
  defaultTheme = "dark-gold",
  storageKey = "ajkmart_theme",
  disablePersistence = false,
  disableAdminFetch = false,
  adminConfigEndpoint = "/api/admin/theme-config",
}: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<string>(() => {
    if (disablePersistence) return defaultTheme;
    try {
      return localStorage.getItem(storageKey) ?? defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [adminOverride, setAdminOverride] = useState<Record<string, string> | undefined>(undefined);

  const theme = useMemo(
    () => THEME_REGISTRY[themeId] ?? THEME_REGISTRY[defaultTheme] ?? darkGoldTheme,
    [themeId, defaultTheme]
  );

  // Resolve the per-role endpoint (e.g. /api/admin/theme-config/rider)
  const resolvedEndpoint = useMemo(() => {
    const base = adminConfigEndpoint.replace(/\/$/, "");
    // If endpoint already ends with role, use as-is; otherwise append role
    return base.endsWith(appRole) ? base : `${base}/${appRole}`;
  }, [adminConfigEndpoint, appRole]);

  // ── Fetch admin config on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (disableAdminFetch) return;
    const loadThemeFromAdmin = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(resolvedEndpoint);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const themeConfig = await response.json();
        if (themeConfig?.selectedTheme && THEME_REGISTRY[themeConfig.selectedTheme]) {
          setThemeId(themeConfig.selectedTheme);
        }
        if (themeConfig?.cssVars) {
          setAdminOverride(themeConfig.cssVars);
        }
      } catch {
        // Admin config endpoint not available — silently fall back to localStorage/default
      } finally {
        setIsLoading(false);
      }
    };
    loadThemeFromAdmin();
  }, [disableAdminFetch, resolvedEndpoint]);

  // ── Listen for real-time theme updates from admin (broadcast via CustomEvent)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const payload = e.detail as { appRole?: string; theme?: string; colors?: Record<string, string> };
      if (payload?.appRole === appRole && payload?.theme && THEME_REGISTRY[payload.theme]) {
        setThemeId(payload.theme);
        if (payload.colors) {
          setAdminOverride(payload.colors);
        }
      }
    };
    window.addEventListener("ajk:theme-updated", handler as EventListener);
    return () => window.removeEventListener("ajk:theme-updated", handler as EventListener);
  }, [appRole]);

  // ── Apply CSS vars whenever theme changes ─────────────────────────────────
  useEffect(() => {
    applyTheme(theme, adminOverride);
  }, [theme, adminOverride]);

  // ── Listen for system color scheme changes ────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme.colorScheme === "system") applyTheme(theme, adminOverride);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, adminOverride]);

  const setTheme = useCallback(
    (id: string) => {
      if (!THEME_REGISTRY[id]) {
        console.warn(`[ThemeProvider] Unknown theme id: "${id}". Available: ${Object.keys(THEME_REGISTRY).join(", ")}`);
        return;
      }
      setThemeId(id);
      if (!disablePersistence) {
        try {
          localStorage.setItem(storageKey, id);
        } catch {
          // ignore quota errors
        }
      }
    },
    [storageKey, disablePersistence]
  );

  const toggleDark = useCallback(() => {
    const paired = DARK_LIGHT_PAIRS[themeId];
    if (paired && paired !== themeId) {
      setTheme(paired);
    }
  }, [themeId, setTheme]);

  const resolvedColorScheme = useMemo((): "light" | "dark" => {
    if (theme.colorScheme === "system") return resolveSystemScheme();
    return theme.colorScheme;
  }, [theme.colorScheme]);

  const value = useMemo(
    (): ThemeContextValue => ({
      theme,
      currentTheme: themeId,
      availableThemes: Object.keys(THEME_REGISTRY),
      setTheme,
      resolvedColorScheme,
      isDark: resolvedColorScheme === "dark",
      toggleDark,
      appRole,
      colors: theme.rawColors,
      isLoading,
    }),
    [theme, themeId, setTheme, resolvedColorScheme, toggleDark, appRole, isLoading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Re-export registry for consumers that enumerate themes ──────────────────

export { THEME_REGISTRY };

/**
 * registerTheme — Extend the registry with a custom theme at runtime.
 * Call before mounting ThemeProvider.
 *
 * Example:
 *   import { registerTheme } from "@workspace/theme/components/ThemeProvider";
 *   registerTheme(myBrandTheme);
 */
export function registerTheme(theme: ThemeDefinition): void {
  if (THEME_REGISTRY[theme.id]) {
    console.warn(`[ThemeProvider] Overwriting existing theme "${theme.id}".`);
  }
  THEME_REGISTRY[theme.id] = theme;
  // Also wire a dark/light pair for toggleDark support (self-pair by default)
  if (!DARK_LIGHT_PAIRS[theme.id]) {
    DARK_LIGHT_PAIRS[theme.id] = theme.id;
  }
}

// Re-export type from types for convenience
export type { ThemeDefinition, ThemeContextValue } from "../config/themes/types.js";
