/**
 * Dark Gold — Primary AJKMart Brand Theme
 *
 * Used by the Rider App as its default theme.
 * Dark background (#0A0A0A) with gold (#FFD700) primary accent.
 * Represents the flagship "premium night mode" of the platform.
 */

import type { ThemeDefinition } from "./types.js";

export const darkGoldTheme: ThemeDefinition = {
  id: "dark-gold",
  name: "Dark Gold",
  description: "Premium dark theme with gold accents — Rider App default",
  colorScheme: "dark",
  app: "rider",

  cssVars: {
    // ── Core semantic tokens ──────────────────────────────────────────────────
    "--background":               "0 0% 4%",       // #0A0A0A
    "--foreground":               "0 0% 100%",      // #FFFFFF
    "--card":                     "0 0% 10%",       // #1A1A1A
    "--card-foreground":          "0 0% 100%",
    "--border":                   "0 0% 16%",       // #2A2A2A
    "--input":                    "0 0% 16%",
    "--ring":                     "51 100% 50%",    // #FFD700 gold ring

    // Primary — Gold
    "--primary":                  "51 100% 50%",    // #FFD700
    "--primary-foreground":       "0 0% 4%",        // dark text on gold

    // Secondary — dark surface
    "--secondary":                "0 0% 10%",
    "--secondary-foreground":     "0 0% 63%",       // #A0A0A0

    // Muted
    "--muted":                    "0 0% 16%",
    "--muted-foreground":         "0 0% 63%",

    // Accent — Amber
    "--accent":                   "45 100% 51%",    // #FFC107
    "--accent-foreground":        "0 0% 4%",

    // Destructive
    "--destructive":              "4 90% 58%",      // #F44336
    "--destructive-foreground":   "0 0% 100%",

    // ── Layout ────────────────────────────────────────────────────────────────
    "--radius":                   "0.75rem",
    "--radius-input":             "0.5rem",

    // ── Brand-specific design tokens ──────────────────────────────────────────
    "--color-brand":              "#FFD700",
    "--color-brand-hover":        "#FFC107",
    "--color-surface":            "#0A0A0A",
    "--color-page-bg":            "#0A0A0A",
    "--color-card-dark":          "#1A1A1A",
    "--color-border-dark":        "#2A2A2A",

    // ── Status colors ─────────────────────────────────────────────────────────
    "--color-success":            "#4CAF50",
    "--color-warning":            "#FF9800",
    "--color-error":              "#F44336",

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
    "--login-brand":              "#FFD700",
    "--login-brand-hover":        "#FFC107",
    "--login-brand-shadow":       "rgba(255,215,0,0.25)",
    "--login-brand-glow-sm":      "rgba(255,215,0,0.30)",
    "--login-brand-glow-md":      "rgba(255,215,0,0.35)",
    "--login-brand-glow-blob":    "rgba(255,215,0,0.07)",
    "--login-brand-border":       "rgba(255,215,0,0.20)",
    "--login-hero-from":          "#0A0A0A",
    "--login-hero-via":           "#0f0f0f",
    "--login-hero-to":            "#141414",
    "--login-otp-filled-bg":      "rgba(255,215,0,0.08)",
    "--login-otp-filled-border":  "#FFD700",
    "--login-otp-filled-text":    "#FFD700",
    "--login-btn-radius":         "0.75rem",
  },

  // Raw color values for JS consumption (charts, inline styles, RN, etc.)
  rawColors: {
    primary:          "#FFD700",
    primaryHover:     "#FFC107",
    background:       "#0A0A0A",
    surface:          "#1A1A1A",
    surfaceElevated:  "#2A2A2A",
    foreground:       "#FFFFFF",
    muted:            "#A0A0A0",
    border:           "#2A2A2A",
    success:          "#4CAF50",
    warning:          "#FF9800",
    error:            "#F44336",
    info:             "#2196F3",
  },
};
