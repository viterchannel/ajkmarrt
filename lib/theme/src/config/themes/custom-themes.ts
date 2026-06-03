/**
 * Custom Themes — Vendor App + Extended Palette
 *
 * dark-blue  → Vendor App default (AJKMart Blue #1A56DB, dark navy bg)
 * dark-navy  → Deep indigo variant for admin dark mode
 * high-contrast → WCAG AAA accessible theme
 */

import type { ThemeDefinition } from "./types.js";

// ─── Dark Blue — Vendor App Default ──────────────────────────────────────────

export const darkBlueTheme: ThemeDefinition = {
  id: "dark-blue",
  name: "Dark Blue",
  description: "Deep navy with AJKMart Blue accents — Vendor App default",
  colorScheme: "dark",
  app: "vendor",

  cssVars: {
    "--background":               "216 41% 7%",     // #0A0F1A deep navy
    "--foreground":               "213 31% 91%",    // #DDE4F1 near white
    "--card":                     "216 38% 10%",    // #111827
    "--card-foreground":          "213 31% 91%",
    "--border":                   "216 28% 17%",
    "--input":                    "216 28% 14%",
    "--ring":                     "221 73% 56%",    // AJKMart blue ring

    // Primary — AJKMart Blue
    "--primary":                  "221 73% 48%",    // #1A56DB
    "--primary-foreground":       "0 0% 100%",

    // Secondary
    "--secondary":                "216 32% 14%",
    "--secondary-foreground":     "213 25% 75%",

    // Muted
    "--muted":                    "216 32% 14%",
    "--muted-foreground":         "213 18% 52%",

    // Accent — Amber
    "--accent":                   "38 92% 50%",     // #F59E0B
    "--accent-foreground":        "0 0% 100%",

    // Destructive
    "--destructive":              "0 84% 60%",
    "--destructive-foreground":   "0 0% 100%",

    // ── Layout ────────────────────────────────────────────────────────────────
    "--radius":                   "0.75rem",

    // ── Brand tokens ──────────────────────────────────────────────────────────
    "--color-brand":              "#1A56DB",
    "--color-brand-hover":        "#1348B5",
    "--color-surface":            "#0A0F1A",
    "--color-page-bg":            "#0A0F1A",
    "--card-bg":                  "#0F1624",

    // ── Status colors ─────────────────────────────────────────────────────────
    "--color-success":            "#4CAF50",
    "--color-warning":            "#FF9800",
    "--color-error":              "#F44336",

    // ── Z-index ───────────────────────────────────────────────────────────────
    "--z-dropdown":               "100",
    "--z-sticky":                 "200",
    "--z-overlay":                "300",
    "--z-drawer":                 "400",
    "--z-modal":                  "500",
    "--z-popover":                "600",
    "--z-toast":                  "700",
    "--z-tooltip":                "800",

    // ── Login page brand tokens ───────────────────────────────────────────────
    "--login-brand":              "#1a56db",
    "--login-brand-hover":        "#1348b5",
    "--login-brand-shadow":       "rgba(26,86,219,0.28)",
    "--login-brand-glow-sm":      "rgba(26,86,219,0.30)",
    "--login-brand-glow-md":      "rgba(26,86,219,0.40)",
    "--login-brand-glow-blob":    "rgba(26,86,219,0.08)",
    "--login-brand-border":       "rgba(26,86,219,0.22)",
    "--login-hero-from":          "#060a14",
    "--login-hero-via":           "#0a1220",
    "--login-hero-to":            "#0d1929",
    "--login-otp-filled-bg":      "rgba(26,86,219,0.12)",
    "--login-otp-filled-border":  "#1a56db",
    "--login-otp-filled-text":    "#93bbfe",
    "--login-btn-radius":         "0.75rem",
  },

  rawColors: {
    primary:          "#1A56DB",
    primaryHover:     "#1348B5",
    background:       "#0A0F1A",
    surface:          "#111827",
    surfaceElevated:  "#1F2937",
    foreground:       "#DDE4F1",
    muted:            "#6B7280",
    border:           "#374151",
    success:          "#4CAF50",
    warning:          "#FF9800",
    error:            "#F44336",
    info:             "#2196F3",
  },
};

// ─── Dark Navy — Admin Dark Mode ──────────────────────────────────────────────

export const darkNavyTheme: ThemeDefinition = {
  id: "dark-navy",
  name: "Dark Navy",
  description: "Deep slate with indigo accents — Admin Panel dark mode",
  colorScheme: "dark",
  app: "admin",

  cssVars: {
    "--background":               "222 47% 11%",    // #0F172A
    "--foreground":               "210 40% 98%",
    "--card":                     "217 33% 17%",
    "--card-foreground":          "210 40% 98%",
    "--card-border":              "215 28% 17%",
    "--border":                   "215 28% 17%",
    "--input":                    "215 28% 17%",
    "--ring":                     "239 84% 67%",
    "--primary":                  "239 84% 67%",    // #6366F1
    "--primary-foreground":       "0 0% 100%",
    "--secondary":                "215 28% 17%",
    "--secondary-foreground":     "210 40% 98%",
    "--popover":                  "217 33% 17%",
    "--popover-foreground":       "210 40% 98%",
    "--popover-border":           "215 28% 17%",
    "--muted":                    "215 28% 17%",
    "--muted-foreground":         "215 16% 47%",
    "--accent":                   "250 69% 61%",
    "--accent-foreground":        "0 0% 100%",
    "--destructive":              "0 63% 31%",
    "--destructive-foreground":   "210 40% 98%",
    "--sidebar":                  "222 47% 7%",
    "--sidebar-foreground":       "210 40% 98%",
    "--sidebar-border":           "215 28% 12%",
    "--sidebar-accent":           "215 28% 12%",
    "--sidebar-accent-foreground":"210 40% 98%",
    "--radius":                   "0.625rem",
    "--color-brand":              "#6366F1",
    "--color-brand-hover":        "#4F46E5",
    "--color-surface":            "#0F172A",
    "--color-page-bg":            "#0F172A",
    "--color-success":            "#10B981",
    "--color-warning":            "#F59E0B",
    "--color-error":              "#EF4444",
    "--z-dropdown":               "100",
    "--z-sticky":                 "200",
    "--z-overlay":                "300",
    "--z-drawer":                 "400",
    "--z-modal":                  "500",
    "--z-popover":                "600",
    "--z-toast":                  "700",
    "--z-tooltip":                "800",
    "--login-brand":              "#6366F1",
    "--login-brand-hover":        "#4F46E5",
    "--login-brand-shadow":       "rgba(99,102,241,0.28)",
    "--login-brand-glow-sm":      "rgba(99,102,241,0.30)",
    "--login-brand-glow-md":      "rgba(99,102,241,0.40)",
    "--login-brand-glow-blob":    "rgba(99,102,241,0.08)",
    "--login-brand-border":       "rgba(99,102,241,0.22)",
    "--login-hero-from":          "#060814",
    "--login-hero-via":           "#0a0c20",
    "--login-hero-to":            "#0d0f29",
    "--login-otp-filled-bg":      "rgba(99,102,241,0.12)",
    "--login-otp-filled-border":  "#6366F1",
    "--login-otp-filled-text":    "#a5b4fc",
    "--login-btn-radius":         "0.625rem",
  },

  rawColors: {
    primary:          "#6366F1",
    primaryHover:     "#4F46E5",
    background:       "#0F172A",
    surface:          "#1E293B",
    surfaceElevated:  "#334155",
    foreground:       "#F8FAFC",
    muted:            "#64748B",
    border:           "#334155",
    success:          "#10B981",
    warning:          "#F59E0B",
    error:            "#EF4444",
    info:             "#3B82F6",
  },
};

// ─── High Contrast — Accessibility Theme ─────────────────────────────────────

export const highContrastTheme: ThemeDefinition = {
  id: "high-contrast",
  name: "High Contrast",
  description: "WCAG AAA accessible — maximum contrast for all users",
  colorScheme: "dark",
  app: "shared",

  cssVars: {
    "--background":               "0 0% 0%",        // pure black
    "--foreground":               "0 0% 100%",      // pure white
    "--card":                     "0 0% 7%",
    "--card-foreground":          "0 0% 100%",
    "--border":                   "0 0% 40%",
    "--input":                    "0 0% 10%",
    "--ring":                     "60 100% 50%",    // yellow ring for maximum visibility
    "--primary":                  "60 100% 50%",    // #FFFF00 yellow
    "--primary-foreground":       "0 0% 0%",
    "--secondary":                "0 0% 10%",
    "--secondary-foreground":     "0 0% 90%",
    "--muted":                    "0 0% 10%",
    "--muted-foreground":         "0 0% 70%",
    "--accent":                   "180 100% 50%",   // #00FFFF cyan
    "--accent-foreground":        "0 0% 0%",
    "--destructive":              "0 100% 50%",     // pure red
    "--destructive-foreground":   "0 0% 100%",
    "--radius":                   "0.25rem",
    "--color-brand":              "#FFFF00",
    "--color-brand-hover":        "#FFEE00",
    "--color-surface":            "#000000",
    "--color-page-bg":            "#000000",
    "--color-success":            "#00FF00",
    "--color-warning":            "#FFAA00",
    "--color-error":              "#FF0000",
    "--z-dropdown":               "100",
    "--z-sticky":                 "200",
    "--z-overlay":                "300",
    "--z-drawer":                 "400",
    "--z-modal":                  "500",
    "--z-popover":                "600",
    "--z-toast":                  "700",
    "--z-tooltip":                "800",
    "--login-brand":              "#FFFF00",
    "--login-brand-hover":        "#FFEE00",
    "--login-brand-shadow":       "rgba(255,255,0,0.30)",
    "--login-brand-glow-sm":      "rgba(255,255,0,0.40)",
    "--login-brand-glow-md":      "rgba(255,255,0,0.50)",
    "--login-brand-glow-blob":    "rgba(255,255,0,0.10)",
    "--login-brand-border":       "rgba(255,255,0,0.50)",
    "--login-hero-from":          "#000000",
    "--login-hero-via":           "#0a0a00",
    "--login-hero-to":            "#141400",
    "--login-otp-filled-bg":      "rgba(255,255,0,0.10)",
    "--login-otp-filled-border":  "#FFFF00",
    "--login-otp-filled-text":    "#FFFF00",
    "--login-btn-radius":         "0.25rem",
  },

  rawColors: {
    primary:          "#FFFF00",
    primaryHover:     "#FFEE00",
    background:       "#000000",
    surface:          "#111111",
    surfaceElevated:  "#1A1A1A",
    foreground:       "#FFFFFF",
    muted:            "#B0B0B0",
    border:           "#666666",
    success:          "#00FF00",
    warning:          "#FFAA00",
    error:            "#FF0000",
    info:             "#00FFFF",
  },
};

// ─── All custom themes registry ───────────────────────────────────────────────

export const customThemes = [darkBlueTheme, darkNavyTheme, highContrastTheme] as const;
