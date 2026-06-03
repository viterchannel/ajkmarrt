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
  background:         "#0f1117",
  text:               "#f1f5f9",
  textMuted:          "#64748b",
  border:             "rgba(255,255,255,0.07)",
  pendingOverlay:     "#0f1117",
  rejectedOverlay:    "#0f1117",
  maintenanceOverlay: "#0f1117",
  surface:            "#131720",
};
