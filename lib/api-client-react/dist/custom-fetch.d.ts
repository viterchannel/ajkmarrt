export type CustomFetchOptions = RequestInit & {
    responseType?: "json" | "text" | "blob" | "auto";
};
export type ErrorType<T = unknown> = ApiError<T>;
export type BodyType<T> = T;
export type AuthTokenGetter = () => Promise<string | null> | string | null;
/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export declare function setBaseUrl(url: string | null): void;
/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 */
export declare function setAuthTokenGetter(getter: AuthTokenGetter | null): void;
/**
 * Register a callback to invoke whenever a 401 response is received and
 * the token refresh attempt also fails. Typically used to trigger logout.
 */
export declare function setOnUnauthorized(handler: ((statusCode?: number, errorMsg?: string) => void) | null): void;
/**
 * Register a getter that supplies the current refresh token.
 * Used to silently refresh the access token on 401 responses.
 */
export declare function setRefreshTokenGetter(getter: (() => Promise<string | null> | string | null) | null): void;
/**
 * Register a callback invoked with the new access and refresh tokens
 * when a silent token refresh succeeds.
 */
export declare function setOnTokenRefreshed(callback: ((newToken: string, newRefreshToken: string) => void) | null): void;
export declare function setOnApiError(handler: ((url: string, status: number, message: string) => void) | null): void;
export declare class ApiError<T = unknown> extends Error {
    readonly name = "ApiError";
    readonly status: number;
    readonly statusText: string;
    readonly data: T | null;
    readonly headers: Headers;
    readonly response: Response;
    readonly method: string;
    readonly url: string;
    constructor(response: Response, data: T | null, requestInfo: {
        method: string;
        url: string;
    });
}
export declare class ResponseParseError extends Error {
    readonly name = "ResponseParseError";
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly response: Response;
    readonly method: string;
    readonly url: string;
    readonly rawBody: string;
    readonly cause: unknown;
    constructor(response: Response, rawBody: string, cause: unknown, requestInfo: {
        method: string;
        url: string;
    });
}
/**
 * Override the maximum number of retry attempts for idempotent requests.
 * Call this at app startup after loading platform config.
 */
export declare function setMaxRetryAttempts(n: number): void;
/**
 * Override the exponential-backoff base delay in milliseconds.
 * Call this at app startup after loading platform config.
 */
export declare function setRetryBackoffBaseMs(ms: number): void;
export declare function customFetch<T = unknown>(input: RequestInfo | URL, options?: CustomFetchOptions, _isRetry?: boolean): Promise<T>;
//# sourceMappingURL=custom-fetch.d.ts.map