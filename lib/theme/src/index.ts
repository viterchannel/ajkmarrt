/**
 * @workspace/theme — Centralized AJKMart Theme System
 *
 * Public surface:
 *
 *   Provider + hook
 *     ThemeProvider, useTheme, useRawColors, useIsDark
 *
 *   Theme definitions
 *     darkGoldTheme, lightModeTheme, darkBlueTheme, darkNavyTheme, highContrastTheme
 *
 *   Config tokens
 *     appColors, serviceColors, neutrals, statusColors
 *     fontFamilies, fontSizes, fontWeights, lineHeights
 *     spacing, borderRadius, zIndex, shadows, glowShadow
 *
 *   Registry helpers
 *     THEME_REGISTRY, registerTheme
 *
 *   Types
 *     ThemeDefinition, ThemeContextValue, ColorScheme, AppId, ServiceId
 */

// ── Provider & hook ───────────────────────────────────────────────────────────
export { ThemeProvider, THEME_REGISTRY, registerTheme } from "./components/ThemeProvider.js";
export type { ThemeProviderProps } from "./components/ThemeProvider.js";
export { ThemeContext } from "./components/ThemeContext.js";
export { useTheme, useRawColors, useIsDark } from "./hooks/useTheme.js";

// ── Theme definitions ─────────────────────────────────────────────────────────
export { darkGoldTheme } from "./config/themes/dark-gold.js";
export { lightModeTheme, lightModeDarkVariant } from "./config/themes/light-mode.js";
export {
  darkBlueTheme,
  darkNavyTheme,
  highContrastTheme,
  customThemes,
} from "./config/themes/custom-themes.js";

// ── Brand master colors ───────────────────────────────────────────────────────
export {
  BrandColors,
  ThemeVariants,
  getThemeVariant,
  getBrandColor,
} from "./config/brand.js";
export type { VariantName, BrandColorPath } from "./config/brand.js";

// ── Color tokens ──────────────────────────────────────────────────────────────
export {
  appColors,
  serviceColors,
  neutrals,
  statusColors,
  buildLoginTokens,
} from "./config/colors.js";
export type { ServiceId, AppId } from "./config/colors.js";

// ── Typography tokens ─────────────────────────────────────────────────────────
export {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  googleFontsUrls,
  typographyCssVars,
} from "./config/typography.js";
export type { FontFamily, FontSize, FontWeight, LineHeight } from "./config/typography.js";

// ── Spacing & layout tokens ───────────────────────────────────────────────────
export {
  spacing,
  borderRadius,
  zIndex,
  zIndexCssVars,
  breakpoints,
  transitions,
  shadows,
  glowShadow,
} from "./config/spacing.js";
export type { SpacingKey, BorderRadius, ZIndex } from "./config/spacing.js";

// ── Shared types ──────────────────────────────────────────────────────────────
export type {
  ThemeDefinition,
  ThemeContextValue,
  ColorScheme,
} from "./config/themes/types.js";
