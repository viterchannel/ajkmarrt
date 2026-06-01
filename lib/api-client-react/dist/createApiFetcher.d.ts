/**
 * Shared API Fetcher Factory
 *
 * Creates a per-app fetch function that centralises:
 *   - Bearer token injection (from getToken callback)
 *   - Configurable AbortController timeout — ALWAYS applied even when the
 *     caller passes its own signal (the two are merged via AbortSignal.any)
 *   - 401 → refresh → retry with a mutex (one concurrent refresh per instance)
 *   - Pluggable refresh via URL endpoint or custom async function
 *   - Extra headers per request and per refresh (CSRF, X-App, etc.)
 */
export type RefreshResult = "refreshed" | "transient" | "auth_failed";
/** Thrown when the factory's own timeout fires (not an external abort). */
export declare class FetchTimeoutError extends Error {
    constructor(message?: string);
}
/** Thrown by the CoreFetch function when a 401-triggered refresh fails. */
export declare class RefreshError extends Error {
    readonly isTransient: boolean;
    constructor(isTransient: boolean);
}
export interface CreateApiFetcherConfig {
    /** Prepended to every path. Use "" for absolute-path fetchers. */
    baseUrl: string;
    /** Returns the current access token synchronously. */
    getToken: () => string | null;
    /**
     * Called after a successful URL-based refresh to store the new access token.
     * Not required when refreshFn is provided (the function handles storage itself).
     */
    setToken?: (token: string) => void;
    /** Returns the current refresh token for URL-based refresh body. */
    getRefreshToken?: () => string | null;
    /**
     * Called after a successful URL-based refresh to store the new refresh token
     * returned by the server.
     */
    setRefreshToken?: (token: string) => void;
    /**
     * Called when a 401 refresh fails, before RefreshError is thrown.
     * @param isTransient - true = network/5xx (keep tokens, surface recoverable error);
     *                      false = auth denied (clear tokens, log user out).
     */
    onRefreshFailed: (isTransient: boolean) => void;
    /**
     * Called when a 401 response is received, before the token refresh is
     * attempted. The parsed response body is passed so callers can extract
     * a session-expiry reason (e.g. body.reason = "admin_revoked") and use
     * it to show context-aware messaging if the refresh ultimately fails.
     * Parsing errors are swallowed — the refresh flow is never interrupted.
     */
    on401?: (responseBody: unknown) => void;
    /**
     * Full URL to POST for a URL-based token refresh.
     * Mutually exclusive with refreshFn; one must be provided.
     */
    refreshEndpoint?: string;
    /**
     * Custom async refresh handler. Resolves to the new access token string, or
     * throws on any failure (treated as auth_failed — no transient distinction).
     * Mutually exclusive with refreshEndpoint; one must be provided.
     */
    refreshFn?: () => Promise<string>;
    /**
     * Returns extra headers merged into every regular request.
     * Called on each request so values (e.g. CSRF token) are always fresh.
     */
    extraHeaders?: () => Record<string, string>;
    /**
     * Returns extra headers added only to the internal URL-based refresh POST
     * (e.g. { "X-App": "vendor" }). Ignored when refreshFn is used.
     */
    extraRefreshHeaders?: () => Record<string, string>;
    /**
     * Default request timeout in ms, or a getter for dynamic updates (e.g.
     * from platform config). The timeout is ALWAYS applied — if the caller
     * also supplies an AbortSignal via opts.signal, the two are merged.
     * Set to 0 to disable factory timeout for all calls on this instance.
     * Default: 15 000 ms.
     */
    timeoutMs?: number | (() => number);
    /** credentials mode for all requests. Default: "include". */
    credentialsMode?: RequestCredentials;
}
/** Extended RequestInit with an optional per-call timeout override. */
export type CoreFetchOpts = RequestInit & {
    /**
     * Per-call timeout in ms, overriding the instance-level timeoutMs for this
     * specific request. Set to 0 to disable factory timeout for this call only.
     * Useful for long-running uploads that should not be cancelled by the
     * default request timeout.
     */
    _timeoutMs?: number;
};
/**
 * Function returned by createApiFetcher.
 * Returns a raw Response; callers handle status codes, body parsing, and errors.
 * Throws FetchTimeoutError when the factory's timeout fires.
 * Throws RefreshError when a 401-triggered refresh fails.
 */
export type CoreFetch = (path: string, opts?: CoreFetchOpts) => Promise<Response>;
/**
 * Creates a fetch function with centralised auth handling for a single app.
 *
 * Returns a tuple: [coreFetch, triggerRefresh].
 * - coreFetch(path, opts) — drop-in for fetch(); adds auth, timeout, auto-refresh.
 * - triggerRefresh() — exposes the mutex-guarded refresh for external callers
 *   (e.g. the api.refreshToken method in vendor/rider apps).
 */
export declare function createApiFetcher(config: CreateApiFetcherConfig): [CoreFetch, () => Promise<RefreshResult>];
//# sourceMappingURL=createApiFetcher.d.ts.map