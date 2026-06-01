import { type ZodError, type ZodIssue, type ZodType } from "zod";
/**
 * Thrown in strict mode (development) when a backend response does not match
 * its registered Zod schema. Carries the Zod issues, the URL context, and the
 * raw received value so you can inspect exactly what the server sent.
 */
export declare class ApiValidationError extends Error {
    readonly name = "ApiValidationError";
    readonly issues: ZodIssue[];
    readonly context: string;
    readonly received: unknown;
    constructor(context: string, issues: ZodIssue[], received: unknown);
}
export interface ValidationOptions {
    /**
     * When true, throw ApiValidationError on mismatch.
     * When false, log.warn and pass through raw data.
     * Default: auto-detected from NODE_ENV (true in development, false in production).
     */
    strict?: boolean;
    /**
     * Called on every validation failure regardless of strict mode.
     * Use this to forward mismatches to Sentry / an analytics sink.
     */
    onFailure?: (error: ApiValidationError, path: string) => void;
}
/**
 * Validate a raw API response against a Zod schema.
 *
 * - In strict mode (dev by default): throws `ApiValidationError`.
 * - In non-strict mode (prod by default): `log.warn` and returns raw data cast to T.
 *
 * `options.onFailure` is always called so mismatches reach your error reporter regardless
 * of the strict setting.
 */
export declare function validateApiResponse<T>(schema: ZodType<T>, data: unknown, context: string, options?: ValidationOptions): T;
/**
 * Safe variant — never throws.
 * Returns `{ success: true, data }` on success or `{ success: false, error, received }` on failure.
 */
export declare function safeValidateApiResponse<T>(schema: ZodType<T>, data: unknown): {
    success: true;
    data: T;
} | {
    success: false;
    error: ZodError;
    received: unknown;
};
/** One entry in a schema registry: a URL path pattern and the Zod schema to validate with. */
export interface SchemaEntry {
    /**
     * Matched against the cleaned URL path (query string stripped).
     * - string  → path.includes(pattern)
     * - RegExp  → pattern.test(path)
     */
    pattern: string | RegExp;
    schema: ZodType;
}
/**
 * Build a `validate(path, data)` function from a URL-pattern → Zod schema registry.
 *
 * Call the returned function after every successful fetch. If no pattern matches the
 * path, validation is silently skipped so unregistered endpoints never fail.
 */
export declare function createSchemaRegistry(entries: SchemaEntry[], options?: ValidationOptions): (path: string, data: unknown) => void;
//# sourceMappingURL=validate.d.ts.map