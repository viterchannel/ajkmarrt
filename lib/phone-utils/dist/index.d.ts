/**
 * Canonical Pakistani mobile phone number utilities.
 *
 * This is a pure, dependency-free module importable by any package —
 * including the API server — without pulling in React or browser APIs.
 *
 * The same logic is re-exported by @workspace/auth-utils for frontend packages.
 */
/**
 * Normalizes a Pakistani mobile number to 10-digit bare format: `3xxxxxxxxx`
 * (no leading zero, no country code).
 *
 * Accepts all common formats:
 *   - 03001234567   (local with zero)
 *   - 3001234567    (bare 10-digit)
 *   - +923001234567 (E.164)
 *   - 923001234567  (country code without +)
 */
export declare function canonicalizePhone(raw: string): string;
/**
 * Returns the number in local `03xxxxxxxxx` format (with leading zero)
 * suitable for SMS gateway calls.
 */
export declare function formatPhoneForApi(localDigits: string): string;
/** Returns true iff the input normalizes to a valid 10-digit Pakistani mobile. */
export declare function isValidPhone(phone: string): boolean;
/**
 * Normalizes any user identifier to its canonical DB-storage form.
 *
 * - Email  → `lower(trim(identifier))`
 * - Phone  → 10-digit bare format via `canonicalizePhone()` (e.g. `3001234567`)
 *
 * Detection is by presence of `@`. Always use this function instead of the
 * inline `identifier.includes("@") ? … : …` pattern so the branching logic
 * lives in exactly one place.
 */
export declare function normalizeIdentifier(identifier: string): string;
/**
 * Regex for Pakistani mobile numbers.
 * Accepts `03XXXXXXXXX` (with leading zero) or `3XXXXXXXXX` (bare 10-digit).
 * Single source of truth — import this everywhere instead of re-defining inline.
 */
export declare const PHONE_REGEX: RegExp;
/**
 * Regex for Pakistani CNIC numbers in the formatted display form: XXXXX-XXXXXXX-X
 * Single source of truth — import this everywhere instead of re-defining inline.
 */
export declare const CNIC_REGEX: RegExp;
/**
 * Returns true iff the input is a valid Pakistani CNIC in the formatted
 * display form: `XXXXX-XXXXXXX-X` (13 digits separated by two hyphens).
 */
export declare function isValidCnic(cnic: string): boolean;
//# sourceMappingURL=index.d.ts.map