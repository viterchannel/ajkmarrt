/**
 * useAuthConfig — shared hook for config-driven auth UI.
 *
 * Fetches auth configuration from platform_settings (via the public
 * /api/auth/config endpoint) and returns flags that drive which login
 * UI panels are shown.
 *
 * Auth modes:
 *   OTP      — phone + SMS OTP (default)
 *   EMAIL    — email + password only (hide phone/OTP inputs)
 *   FIREBASE — Firebase phone auth or Google Sign-In (show Firebase UI)
 *   HYBRID   — OTP primary + Firebase optional
 */
export interface AuthConfig {
    authMode: "OTP" | "EMAIL" | "FIREBASE" | "HYBRID";
    firebaseEnabled: boolean;
    otpEnabled: boolean;
    emailLoginEnabled: boolean;
    googleEnabled: boolean;
    facebookEnabled: boolean;
    loaded: boolean;
}
/**
 * Hook — returns the auth config and a loading state.
 * @param apiBase  Base API URL e.g. "/api" or "https://myapp.com/api"
 */
export declare function useAuthConfig(apiBase?: string): AuthConfig;
/** Invalidate cache (call after admin changes auth settings) */
export declare function invalidateAuthConfigCache(): void;
//# sourceMappingURL=useAuthConfig.d.ts.map