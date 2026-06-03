/**
 * Vendor-app brand palette — AJKMart Blue (#1A56DB) on dark navy.
 *
 * Primary color is sourced from the centralized @workspace/theme token system
 * so the vendor brand color stays in sync with the platform palette.
 */
import { appColors, statusColors } from "@workspace/theme";
import type { AuthTheme } from "@workspace/auth-react";

const c = appColors.vendor;

export const vendorTheme: Partial<AuthTheme> = {
  primary:            c.primary,          // #1A56DB
  primaryDark:        c.primaryHover,     // #1348B5
  primaryLight:       "rgba(26,86,219,0.12)",
  background:         "var(--background)",
  text:               "var(--foreground)",
  textMuted:          "var(--muted-foreground)",
  border:             "var(--border)",
  pendingOverlay:     "var(--secondary)",
  rejectedOverlay:    "var(--destructive)",
  maintenanceOverlay: "var(--secondary)",
  surface:            "var(--card)",
  error:              statusColors.error,
  errorBackground:    "rgba(239,68,68,0.10)",
  errorBorder:        "rgba(239,68,68,0.28)",
  success:            statusColors.success,
  warning:            statusColors.warning,
};
