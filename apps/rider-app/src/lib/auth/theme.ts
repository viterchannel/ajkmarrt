/**
 * Rider-app brand palette — dark gold on pitch black.
 *
 * Overrides the DEFAULT_THEMES.rider defaults from @workspace/auth-react to
 * match the exact hex values used throughout the rider CSS (--login-brand etc).
 * Pass this object as the `theme` prop on ThemeProvider to apply:
 *
 *   <ThemeProvider role="rider" theme={riderTheme}>…</ThemeProvider>
 */
import type { AuthTheme } from "@workspace/auth-react";

type RiderTheme = Partial<AuthTheme> & {
  featureGreen: string;
  featureBlue: string;
  featurePurple: string;
};

export const riderTheme: RiderTheme = {
  primary:            "#FFD700",   /* Primary Accent — gold  */
  primaryDark:        "#FFC107",   /* Secondary Accent — amber */
  primaryLight:       "rgba(255,215,0,0.10)",
  background:         "#0A0A0A",   /* Page background */
  text:               "#FFFFFF",   /* Text Primary */
  textMuted:          "#A0A0A0",   /* Text Secondary */
  border:             "#2A2A2A",   /* Input Background / dividers */
  pendingOverlay:     "#0f0f0f",
  rejectedOverlay:    "#110B0B",
  maintenanceOverlay: "#0f0f0f",
  surface:            "#1A1A1A",   /* Card Background */
  error:              "#F44336",
  onPrimary:          "#0A0A0A",   /* Dark text on gold button — WCAG AA */
  errorBackground:    "rgba(244,67,54,0.10)",
  errorBorder:        "rgba(244,67,54,0.30)",
  featureGreen:       "#4CAF50",   /* Success */
  featureBlue:        "#3B82F6",
  featurePurple:      "#A855F7",
};
