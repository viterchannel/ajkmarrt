/**
 * Rider-app brand palette — dark gold on pitch black.
 *
 * Primary/hover colors are sourced from the centralized @workspace/theme token
 * system so the rider brand color stays in sync with the platform palette.
 */
import { appColors, statusColors } from "@workspace/theme";
import type { AuthTheme } from "@workspace/auth-react";

const c = appColors.rider;

type RiderTheme = Partial<AuthTheme> & {
  featureGreen: string;
  featureBlue: string;
  featurePurple: string;
};

export const riderTheme: RiderTheme = {
  primary:            c.primary,          // #FFD700 gold
  primaryDark:        c.primaryHover,     // #FFC107 amber
  primaryLight:       "rgba(255,215,0,0.10)",
  background:         "var(--background)",
  text:               "var(--foreground)",
  textMuted:          "var(--muted-foreground)",
  border:             "var(--border)",
  pendingOverlay:     "var(--secondary)",
  rejectedOverlay:    "var(--destructive)",
  maintenanceOverlay: "var(--secondary)",
  surface:            "var(--card)",
  error:              statusColors.error,
  onPrimary:          "var(--primary-foreground)",
  errorBackground:    "rgba(244,67,54,0.10)",
  errorBorder:        "rgba(244,67,54,0.30)",
  featureGreen:       statusColors.success,
  featureBlue:        "#3B82F6",
  featurePurple:      "#A855F7",
};
