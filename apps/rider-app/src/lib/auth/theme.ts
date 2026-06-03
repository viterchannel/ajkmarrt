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
  background:         "#0A0A0A",
  text:               "#FFFFFF",
  textMuted:          "#A0A0A0",
  border:             "#2A2A2A",
  pendingOverlay:     "#0f0f0f",
  rejectedOverlay:    "#110B0B",
  maintenanceOverlay: "#0f0f0f",
  surface:            "#1A1A1A",
  error:              statusColors.error,  // #F44336
  onPrimary:          "#0A0A0A",
  errorBackground:    "rgba(244,67,54,0.10)",
  errorBorder:        "rgba(244,67,54,0.30)",
  featureGreen:       statusColors.success, // #4CAF50
  featureBlue:        "#3B82F6",
  featurePurple:      "#A855F7",
};
