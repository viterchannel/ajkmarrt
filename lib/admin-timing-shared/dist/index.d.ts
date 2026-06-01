/**
 * @workspace/admin-timing-shared
 *
 * Reusable factory for the admin/rider/vendor/customer apps to expose
 * a typed timing-overrides registry. The admin currently consumes this
 * via `artifacts/admin/src/lib/adminTiming.ts`; the rider, vendor, and
 * customer apps can adopt the same factory by:
 *
 *   import { createTimingRegistry } from "@workspace/admin-timing-shared";
 *
 *   interface RiderTimingConfig { stalenessMs: number; pollMs: number; }
 *   const DEFAULTS: RiderTimingConfig = { stalenessMs: 5_000, pollMs: 30_000 };
 *
 *   export const riderTiming = createTimingRegistry<RiderTimingConfig>(DEFAULTS);
 *
 * Each app keeps its own typed config; this package only owns the
 * apply/reset/get plumbing so override semantics stay identical
 * across apps.
 */
export interface TimingRegistry<T extends Record<string, number>> {
    /** Read the current effective config (defaults merged with overrides). */
    get(): T;
    /**
     * Apply a partial override. Each entry is coerced to a finite positive
     * number; non-numeric / non-positive values are ignored so invalid
     * backend payloads can't poison the runtime.
     */
    apply(overrides: Partial<Record<keyof T, unknown>> | null | undefined): void;
    /** Reset every key back to the initial defaults. */
    reset(): void;
    /** Frozen snapshot of the original defaults (handy for tests). */
    readonly defaults: Readonly<T>;
}
/**
 * Build a typed timing registry around a `defaults` object.
 *
 * The returned object holds mutable in-module state — call this once
 * per logical config and re-export the resulting registry.
 */
export declare function createTimingRegistry<T extends Record<string, number>>(defaults: T): TimingRegistry<T>;
//# sourceMappingURL=index.d.ts.map