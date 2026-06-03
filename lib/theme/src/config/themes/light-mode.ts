/**
 * Light Mode — Admin Panel Theme
 *
 * Clean off-white canvas with Indigo (#6366F1) as the primary brand color.
 * Designed for data-dense admin interfaces with high readability.
 * Also serves as the "light alternative" when other apps toggle to light mode.
 */

import { BrandColors } from "../brand.js";
import type { ThemeDefinition } from "./types.js";

const b = BrandColors;

export const lightModeTheme: ThemeDefinition = {
  id: "light-mode",
  name: "Light Mode",
  description: "Off-white canvas with indigo accents — Admin Panel default",
  colorScheme: "light",
  app: "admin",

  cssVars: {
    // ── Core semantic tokens ──────────────────────────────────────────────────
    "--background":               "210 40% 98%",    // #F8FAFC off-white
    "--foreground":               "222 47% 11%",    // #0F172A near-black

    "--card":                     "0 0% 100%",      // #FFFFFF pure white
    "--card-foreground":          "222 47% 11%",
    "--card-border":              "214 32% 91%",

    "--border":                   "214 32% 91%",    // #E2E8F0
    "--input":                    "214 32% 91%",
    "--ring":                     "239 84% 67%",    // #6366F1 indigo

    // Primary — Indigo
    "--primary":                  "239 84% 67%",    // #6366F1
    "--primary-foreground":       "0 0% 100%",

    // Secondary
    "--secondary":                "210 40% 96.1%",
    "--secondary-foreground":     "222.2 47.4% 11.2%",

    // Popover
    "--popover":                  "0 0% 100%",
    "--popover-foreground":       "222 47% 11%",
    "--popover-border":           "214 32% 91%",

    // Muted
    "--muted":                    "210 40% 96.1%",
    "--muted-foreground":         "215.4 16.3% 46.9%",

    // Accent — Violet
    "--accent":                   "250 69% 61%",    // #7C3AED
    "--accent-foreground":        "0 0% 100%",

    // Destructive
    "--destructive":              "0 84% 60%",
    "--destructive-foreground":   "0 0% 100%",

    // ── Sidebar ───────────────────────────────────────────────────────────────
    "--sidebar":                  "222 47% 11%",    // #0F172A dark sidebar
    "--sidebar-foreground":       "210 40% 98%",
    "--sidebar-border":           "217 33% 17%",
    "--sidebar-accent":           "217 33% 17%",
    "--sidebar-accent-foreground":"210 40% 98%",

    // ── Layout ────────────────────────────────────────────────────────────────
    "--radius":                   "0.625rem",

    // ── Brand-specific design tokens ──────────────────────────────────────────
    "--color-brand":              "#6366F1",
    "--color-brand-hover":        "#4F46E5",
    "--color-surface":            b.secondary.lightGray,
    "--color-page-bg":            b.secondary.lightGray,

    // ── Status colors (sourced from BrandColors) ──────────────────
    "--color-success":            b.semantic.success,
    "--color-warning":            b.semantic.warning,
    "--color-error":              b.semantic.error,

    // ── Z-index scale ─────────────────────────────────────────────────────────
    "--z-dropdown":               "100",
    "--z-sticky":                 "200",
    "--z-overlay":                "300",
    "--z-drawer":                 "400",
    "--z-modal":                  "500",
    "--z-popover":                "600",
    "--z-toast":                  "700",
    "--z-tooltip":                "800",

    // ── Login page brand tokens ───────────────────────────────────────────────
    "--login-brand":              "#6366F1",
    "--login-brand-hover":        "#4F46E5",
    "--login-brand-shadow":       "rgba(99,102,241,0.25)",
    "--login-brand-glow-sm":      "rgba(99,102,241,0.30)",
    "--login-brand-glow-md":      "rgba(99,102,241,0.35)",
    "--login-brand-glow-blob":    "rgba(99,102,241,0.07)",
    "--login-brand-border":       "rgba(99,102,241,0.20)",
    "--login-hero-from":          "#F8FAFC",
    "--login-hero-via":           "#EEF2FF",
    "--login-hero-to":            "#E0E7FF",
    "--login-otp-filled-bg":      "rgba(99,102,241,0.08)",
    "--login-otp-filled-border":  "#6366F1",
    "--login-otp-filled-text":    "#6366F1",
    "--login-btn-radius":         "0.625rem",
  },

  rawColors: {
    primary:          "#6366F1",
    primaryHover:     "#4F46E5",
    background:       b.secondary.lightGray,
    surface:          "#FFFFFF",
    surfaceElevated:  "#F1F5F9",
    foreground:       b.text.primary,
    muted:            "#64748B",
    border:           b.secondary.borderGray,
    success:          b.semantic.success,
    warning:          b.semantic.warning,
    error:            b.semantic.error,
    info:             b.semantic.info,
  },
};

// ─── Dark companion for light-mode theme (admin dark toggle) ─────────────────

export const lightModeDarkVariant: Record<string, string> = {
  "--background":               "222 47% 11%",    // #0F172A
  "--foreground":               "210 40% 98%",
  "--card":                     "217 33% 17%",
  "--card-foreground":          "210 40% 98%",
  "--card-border":              "215 28% 17%",
  "--border":                   "215 28% 17%",
  "--input":                    "215 28% 17%",
  "--ring":                     "239 84% 67%",
  "--primary":                  "239 84% 67%",
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
};
