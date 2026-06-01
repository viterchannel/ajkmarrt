import { GoogleOAuthProvider } from "@react-oauth/google";
export { GoogleOAuthProvider };
export interface OAuthResult {
    token: string;
    provider: "google" | "facebook";
}
export interface OAuthError {
    message: string;
    provider: "google" | "facebook";
}
declare global {
    interface Window {
        FB?: {
            init: (config: Record<string, unknown>) => void;
            login: (cb: (response: {
                authResponse?: {
                    accessToken: string;
                };
            }) => void, opts?: Record<string, unknown>) => void;
            getLoginStatus: (cb: (response: {
                status: string;
                authResponse?: {
                    accessToken: string;
                };
            }) => void) => void;
        };
        fbAsyncInit?: () => void;
    }
}
export declare function useGoogleLogin(): {
    login: () => void;
    loading: boolean;
    error: string | null;
    result: OAuthResult | null;
};
export declare function loadGoogleGSIToken(clientId: string): Promise<string>;
export declare function loadFacebookAccessToken(appId: string): Promise<string>;
export declare function decodeGoogleJwtPayload(idToken: string): Record<string, string>;
export declare function initFacebookSDK(appId: string): Promise<void>;
export declare function useFacebookLogin(appId?: string): {
    login: () => Promise<OAuthResult | null>;
    loading: boolean;
    error: string | null;
};
//# sourceMappingURL=index.d.ts.map