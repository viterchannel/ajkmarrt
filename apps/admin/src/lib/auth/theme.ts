/**
 * Admin-app brand palette — indigo on deep dark.
 *
 * Primary color is sourced from the centralized @workspace/theme token system
 * so the admin brand color stays in sync with the platform palette.
 * Other values are auth-screen-specific overrides.
 */
import { appColors } from "@workspace/theme";
import type { AuthTheme } from "@workspace/auth-react";

const c = appColors.admin;

export const adminTheme: Partial<AuthTheme> = {
  primary:            c.primary,          // #6366F1
  primaryDark:        "#4338CA",
  primaryLight:       "rgba(99,102,241,0.12)",
  background:         "var(--background)",
  text:               "var(--foreground)",
  textMuted:          "var(--muted-foreground)",
  border:             "var(--border)",
  pendingOverlay:     "var(--secondary)",
  rejectedOverlay:    "var(--destructive)",
  maintenanceOverlay: "var(--secondary)",
  surface:            "var(--card)",
};
