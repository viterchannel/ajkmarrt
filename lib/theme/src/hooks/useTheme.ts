/**
 * useTheme — Consume the active theme from ThemeContext.
 *
 * Must be used inside a <ThemeProvider> tree.
 * Returns the full ThemeContextValue so callers can:
 *   - Read the active theme definition (cssVars, rawColors, id, etc.)
 *   - Switch themes with setTheme("dark-gold")
 *   - Toggle between light/dark with toggleDark()
 *   - Check isDark for conditional rendering
 */

import { useContext } from "react";
import { ThemeContext } from "../components/ThemeContext.js";
import type { ThemeContextValue } from "../config/themes/types.js";

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      "[useTheme] must be called inside a <ThemeProvider>. " +
        "Wrap your app root with <ThemeProvider defaultTheme=\"...\">."
    );
  }
  return ctx;
}

/**
 * useRawColors — Convenience hook that returns just the rawColors object.
 * Useful in chart components, React Native, or inline-styled elements.
 */
export function useRawColors() {
  return useTheme().theme.rawColors;
}

/**
 * useIsDark — Convenience hook for dark-mode conditional rendering.
 */
export function useIsDark(): boolean {
  return useTheme().isDark;
}
