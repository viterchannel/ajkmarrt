/**
 * AJKMart — Typography Tokens
 *
 * Font families, sizes, weights, and line-height scale used across all apps.
 * Applied as CSS custom properties by each theme.
 */

// ─── Font Families ────────────────────────────────────────────────────────────

export const fontFamilies = {
  sans:    '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: '"Outfit", "Inter", system-ui, sans-serif',
  mono:    '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
} as const;

export type FontFamily = keyof typeof fontFamilies;

// ─── Font Sizes (rem) ─────────────────────────────────────────────────────────

export const fontSizes = {
  "2xs": "0.625rem",    // 10px
  xs:    "0.75rem",     // 12px
  sm:    "0.875rem",    // 14px
  base:  "1rem",        // 16px
  md:    "1rem",        // 16px (alias)
  lg:    "1.125rem",    // 18px
  xl:    "1.25rem",     // 20px
  "2xl": "1.5rem",      // 24px
  "3xl": "1.875rem",    // 30px
  "4xl": "2.25rem",     // 36px
  "5xl": "3rem",        // 48px
  "6xl": "3.75rem",     // 60px
} as const;

export type FontSize = keyof typeof fontSizes;

// ─── Font Weights ─────────────────────────────────────────────────────────────

export const fontWeights = {
  thin:       100,
  extralight: 200,
  light:      300,
  normal:     400,
  medium:     500,
  semibold:   600,
  bold:       700,
  extrabold:  800,
  black:      900,
} as const;

export type FontWeight = keyof typeof fontWeights;

// ─── Line Heights ─────────────────────────────────────────────────────────────

export const lineHeights = {
  none:    1,
  tight:   1.25,
  snug:    1.375,
  normal:  1.5,
  relaxed: 1.625,
  loose:   2,
} as const;

export type LineHeight = keyof typeof lineHeights;

// ─── Letter Spacing ───────────────────────────────────────────────────────────

export const letterSpacings = {
  tighter: "-0.05em",
  tight:   "-0.025em",
  normal:  "0em",
  wide:    "0.025em",
  wider:   "0.05em",
  widest:  "0.1em",
} as const;

// ─── Google Fonts URLs per App ────────────────────────────────────────────────
// Used in index.css @import statements — kept here for easy updates.

export const googleFontsUrls = {
  admin:    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap",
  vendor:   "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
  rider:    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  customer: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
} as const;

// ─── Typography Scale (CSS var names → values) ───────────────────────────────

export const typographyCssVars = {
  "--font-sans":    fontFamilies.sans,
  "--font-display": fontFamilies.display,
  "--font-mono":    fontFamilies.mono,
} as const;
