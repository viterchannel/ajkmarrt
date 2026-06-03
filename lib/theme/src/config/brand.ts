/**
 * AJKMart — Master Brand Colors & Theme Variants
 *
 * Simplified brand palette that all apps can import directly.
 * Use when you need clean, semantic color names rather than full CSS tokens.
 */

// ─── Brand Colors — single source of truth ─────────────────────────────────

export const BrandColors = {
  primary: {
    dark:     "#1A1A2E",   // Deep dark (primary)
    gold:     "#D4AF37",   // Gold accent
    darkGold: "#C4860F",   // Dark gold for hover
  },
  secondary: {
    lightGray: "#F5F5F5",
    darkGray:  "#333333",
    borderGray: "#E0E0E0",
  },
  semantic: {
    success: "#4CAF50",
    warning: "#FFC107",
    error:   "#F44336",
    info:    "#2196F3",
  },
  text: {
    primary:   "#1A1A2E",
    secondary: "#666666",
    light:     "#FFFFFF",
  },
} as const;

// ─── Theme Variants — ready-to-use palette combinations ───────────────────

export const ThemeVariants = {
  darkGold: {
    background:   BrandColors.primary.dark,
    text:         BrandColors.text.light,
    accent:       BrandColors.primary.gold,
    borderColor:  BrandColors.primary.gold,
  },
  light: {
    background:   BrandColors.secondary.lightGray,
    text:         BrandColors.primary.dark,
    accent:       BrandColors.primary.gold,
    borderColor:  BrandColors.secondary.borderGray,
  },
} as const;

// ─── Helper: pick a variant by name ───────────────────────────────────────

export type VariantName = keyof typeof ThemeVariants;

export function getThemeVariant(name: VariantName) {
  return ThemeVariants[name];
}

// ─── Helper: pick a brand color path (e.g. "semantic.error") ─────────────

export type BrandColorPath =
  | `primary.${keyof typeof BrandColors["primary"]}`
  | `secondary.${keyof typeof BrandColors["secondary"]}`
  | `semantic.${keyof typeof BrandColors["semantic"]}`
  | `text.${keyof typeof BrandColors["text"]}`;

export function getBrandColor(path: BrandColorPath): string {
  const parts = path.split(".") as [keyof typeof BrandColors, string];
  const group = BrandColors[parts[0]];
  if (!group) throw new Error(`[getBrandColor] Unknown group: "${parts[0]}"`);
  const value = (group as Record<string, string>)[parts[1]];
  if (!value) throw new Error(`[getBrandColor] Unknown key: "${path}"`);
  return value;
}
