/**
 * Lightweight per-endpoint circuit breaker.
 *
 * States
 * ──────
 * CLOSED   — normal operation; failures are counted.
 * OPEN     — all requests rejected immediately; cooldown timer running.
 * HALF_OPEN — cooldown elapsed; one probe request is allowed through.
 *             Success → CLOSED.  Failure → OPEN (cooldown resets).
 *
 * Usage
 * ──────
 *   const cb = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 30_000 });
 *
 *   // Before request:
 *   cb.check(path);          // throws CircuitOpenError when OPEN
 *
 *   // After successful response (res.ok):
 *   cb.onSuccess(path);
 *
 *   // After ALL retries exhausted on a 5xx response:
 *   cb.onFailure(path);
 */
export interface CircuitBreakerConfig {
    /** Consecutive 5xx failures before the circuit opens. Default: 3. */
    failureThreshold?: number;
    /** Milliseconds to wait before allowing a probe request. Default: 30 000. */
    cooldownMs?: number;
}
export declare class CircuitOpenError extends Error {
    readonly endpoint: string;
    readonly retryAfterMs: number;
    constructor(endpoint: string, retryAfterMs: number);
}
type CircuitState = "closed" | "open" | "half_open";
export declare function createCircuitBreaker(config?: CircuitBreakerConfig): {
    /**
     * Call BEFORE making a request (only on the initial attempt, not retries).
     * - CLOSED / HALF_OPEN after cooldown elapsed → returns normally.
     * - OPEN within cooldown → throws CircuitOpenError.
     */
    check(path: string): void;
    /**
     * Call when the response is successful (res.ok).
     * Resets the failure count and closes the circuit.
     */
    onSuccess(path: string): void;
    /**
     * Call when ALL retries for a 5xx response are exhausted.
     * Increments the failure counter; opens the circuit once the threshold
     * is reached (or immediately when in half-open state).
     */
    onFailure(path: string): void;
    /** Expose current state — useful for debug panels or toast messages. */
    getState(path: string): {
        state: CircuitState;
        failures: number;
        retryAfterMs: number;
    };
    /** Reset one endpoint (or all) — useful for testing or manual recovery UI. */
    reset(path?: string): void;
};
export type ApiCircuitBreaker = ReturnType<typeof createCircuitBreaker>;
export {};
//# sourceMappingURL=circuitBreaker.d.ts.map