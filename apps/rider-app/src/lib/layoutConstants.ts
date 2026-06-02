/**
 * Layout Constants — Single source of truth for layout measurements.
 * Used by all pages to ensure consistency.
 */

/**
 * Bottom navigation height (64px) + safe area inset
 * Applied to bottom of main content to prevent overlap with BottomNav
 */
export const BOTTOM_PADDING = "calc(64px + max(8px, env(safe-area-inset-bottom, 8px)))";

/**
 * Bottom navigation height (used for calculations)
 */
export const BOTTOM_NAV_HEIGHT = "64px";

/**
 * Safe area inset variables (defined in CSS)
 * Use env() to read safe area insets for notch devices
 */
export const SAFE_AREA = {
  top: "env(safe-area-inset-top, 0px)",
  right: "env(safe-area-inset-right, 0px)",
  bottom: "env(safe-area-inset-bottom, 0px)",
  left: "env(safe-area-inset-left, 0px)",
};

/**
 * Header safe area inset padding
 */
export const HEADER_PADDING_TOP = `calc(${SAFE_AREA.top} + 12px)`;

/**
 * Max width for content on larger screens (for phone-like experience)
 */
export const CONTENT_MAX_WIDTH = "max-w-2xl";

/**
 * Standard page padding (horizontal)
 */
export const PAGE_PADDING_X = "px-3 sm:px-4";

/**
 * Standard page padding (bottom, without bottom nav consideration)
 */
export const PAGE_PADDING_BOTTOM = "pb-6 sm:pb-8";

/**
 * Page header gradient class
 */
export const HEADER_GRADIENT = "page-header-gradient";

/**
 * Page header rounded bottom
 */
export const HEADER_RADIUS = "rounded-b-[2rem]";
