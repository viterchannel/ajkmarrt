/**
 * Vendor-app brand palette — AJKMart Blue (#1A56DB) on dark navy.
 *
 * Primary color is sourced from the centralized @workspace/theme token system
 * so the vendor brand color stays in sync with the platform palette.
 */
import { appColors } from "@workspace/theme";
import type { AuthTheme } from "@workspace/auth-react";

const c = appColors.vendor;

export const vendorTheme: Partial<AuthTheme> = {
  primary:            c.primary,          // #1A56DB
  primaryDark:        c.primaryHover,     // #1348B5
  primaryLight:       "rgba(26,86,219,0.12)",
  background:         "#060A14",
  text:               "#E2E8F4",
  textMuted:          "#8B95A9",
  border:             "#1E2A3F",
  pendingOverlay:     "#0A1220",
  rejectedOverlay:    "#1A0B0B",
  maintenanceOverlay: "#0A0F1A",
  surface:            "#0F1827",
  error:              "#EF4444",
  errorBackground:    "rgba(239,68,68,0.10)",
  errorBorder:        "rgba(239,68,68,0.28)",
  success:            "#22C55E",
  warning:            "#F59E0B",
};
