/**
 * Overlay.tsx — rider-app
 *
 * Pure re-export: overlay screens are provided by @workspace/auth-react.
 * The shared components use ThemeProvider (already wired at app root via
 * ThemeContext.tsx + riderTheme) so colors stay in sync with the rider brand.
 */
export {
  BiometricEnrollOverlay,
  MaintenanceOverlay,
  PendingOverlay,
  RejectedOverlay,
} from "@workspace/auth-react";
export type {
  BiometricEnrollOverlayProps,
  MaintenanceOverlayProps,
  PendingOverlayProps,
  RejectedOverlayProps,
} from "@workspace/auth-react";
