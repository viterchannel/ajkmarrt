/**
 * AJKMart — Spacing & Layout Tokens
 *
 * Consistent scale for margins, paddings, gaps, and border radii.
 * Also contains z-index layers, breakpoints, and transition speeds.
 */

// ─── Spacing Scale (rem) ──────────────────────────────────────────────────────

export const spacing = {
  0:    "0px",
  0.5:  "0.125rem",   // 2px
  1:    "0.25rem",    // 4px
  1.5:  "0.375rem",   // 6px
  2:    "0.5rem",     // 8px
  2.5:  "0.625rem",   // 10px
  3:    "0.75rem",    // 12px
  3.5:  "0.875rem",   // 14px
  4:    "1rem",       // 16px
  5:    "1.25rem",    // 20px
  6:    "1.5rem",     // 24px
  7:    "1.75rem",    // 28px
  8:    "2rem",       // 32px
  9:    "2.25rem",    // 36px
  10:   "2.5rem",     // 40px
  12:   "3rem",       // 48px
  14:   "3.5rem",     // 56px
  16:   "4rem",       // 64px
  20:   "5rem",       // 80px
  24:   "6rem",       // 96px
  28:   "7rem",       // 112px
  32:   "8rem",       // 128px
} as const;

export type SpacingKey = keyof typeof spacing;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const borderRadius = {
  none:  "0px",
  sm:    "0.25rem",   // 4px
  base:  "0.375rem",  // 6px
  md:    "0.5rem",    // 8px
  lg:    "0.75rem",   // 12px  ← default card radius across all apps
  xl:    "1rem",      // 16px
  "2xl": "1.5rem",    // 24px
  "3xl": "2rem",      // 32px
  full:  "9999px",    // pill
} as const;

export type BorderRadius = keyof typeof borderRadius;

// ─── Z-Index Layers ───────────────────────────────────────────────────────────

export const zIndex = {
  base:      0,
  raised:    10,
  dropdown:  100,
  sticky:    200,
  overlay:   300,
  drawer:    400,
  modal:     500,
  popover:   600,
  toast:     700,
  tooltip:   800,
  spotlight: 900,
  top:       9999,
} as const;

export type ZIndex = keyof typeof zIndex;

// ─── CSS Custom Properties for Z-Index ───────────────────────────────────────

export const zIndexCssVars = Object.fromEntries(
  Object.entries(zIndex).map(([k, v]) => [`--z-${k}`, String(v)])
) as Record<string, string>;

// ─── Breakpoints (px) ─────────────────────────────────────────────────────────

export const breakpoints = {
  xs:  "480px",
  sm:  "640px",
  md:  "768px",
  lg:  "1024px",
  xl:  "1280px",
  "2xl": "1536px",
} as const;

// ─── Transition Speeds ────────────────────────────────────────────────────────

export const transitions = {
  fast:   "150ms ease",
  base:   "200ms ease",
  slow:   "300ms ease",
  slower: "500ms ease",
} as const;

// ─── Shadow Scale ─────────────────────────────────────────────────────────────

export const shadows = {
  sm:    "0 1px 2px 0 rgba(0,0,0,0.05)",
  base:  "0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)",
  md:    "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)",
  lg:    "0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10)",
  xl:    "0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)",
  "2xl": "0 25px 50px -12px rgba(0,0,0,0.25)",
  inner: "inset 0 2px 4px 0 rgba(0,0,0,0.05)",
  none:  "none",
} as const;

// ─── Dark-Mode Glow Shadows ───────────────────────────────────────────────────

export function glowShadow(color: string, intensity: "sm" | "md" | "lg" = "md") {
  const sizes = {
    sm: `0 0 8px ${color}`,
    md: `0 0 16px ${color}, 0 0 32px ${color}44`,
    lg: `0 0 24px ${color}, 0 0 48px ${color}44, 0 0 72px ${color}22`,
  };
  return sizes[intensity];
}
