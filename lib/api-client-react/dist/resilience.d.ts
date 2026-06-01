/**
 * createResilientFetcher — shared resilience factory for api-client-react.
 *
 * Encapsulates circuit-breaker + 5xx exponential-backoff retry so that
 * rider-app/api.ts and vendor-app/api.ts do not need to duplicate the logic.
 *
 * Usage:
 *   import { createResilientFetcher } from '@workspace/api-client-react';
 *   const fetcher = createResilientFetcher({ baseUrl, getToken, ... });
 *   const data = await fetcher('/some/path', { method: 'GET' });
 */
import type { CreateApiFetcherConfig } from "./createApiFetcher";
export interface ResilientFetcherConfig extends CreateApiFetcherConfig {
    /** Number of 5xx retries before giving up (default: 3). Delays: 1s, 2s, 4s. */
    maxRetries?: number;
    /** Circuit-breaker failure threshold before opening (default: 3). */
    failureThreshold?: number;
    /** Circuit-breaker cooldown in ms (default: 30 000). */
    cooldownMs?: number;
    /**
     * Called with the raw parsed JSON object on every successful response, before
     * the server envelope is unwrapped ({data}) and returned to the caller.
     * Use this to capture top-level envelope fields (e.g. csrfToken) that would
     * otherwise be stripped by the data-unwrapping step.
     */
    onRawJson?: (json: unknown) => void;
}
export interface ResilientFetcher {
    fetch(path: string, opts?: RequestInit, retries?: number): Promise<unknown>;
    refresh(): Promise<"refreshed" | "auth_failed" | "transient">;
}
/**
 * Creates a fetch function that includes:
 *  - Per-endpoint circuit breaker (opens after `failureThreshold` 5xx failures)
 *  - 5xx exponential-backoff retry (up to `maxRetries` attempts: 1s / 2s / 4s)
 *  - Automatic 401 → token refresh → retry via createApiFetcher
 *  - Graceful translation of RefreshError into typed results
 */
export declare function createResilientFetcher(config: ResilientFetcherConfig): ResilientFetcher;
//# sourceMappingURL=resilience.d.ts.map