import { logger } from "./logger.js";

const DEFAULT_PHONE_FORMAT = "^0?3\\d{9}$";

/* ReDoS protection: reject patterns that contain quantified groups
   or nested quantifiers that could cause catastrophic backtracking.
   Safe patterns: literal digits, anchors, simple character classes,
   fixed-length alternations, and basic quantifiers on single atoms.
   Dangerous patterns: (a+)*, (a*)*, (a+)+, (a?)+, (a{1,})*  etc.
   We also reject patterns with unbounded nested quantifiers. */
const REDOS_RISKY =
  /\([^)]*[*+?{]\)\s*[*+?{]|\((\?:)?\[[^\]]*[*+?{]\][^)]*[*+?{]\)[*+?{]/i;

export function normalizePhoneFormatPattern(raw?: string | null): string {
  const candidate = raw?.trim() ?? "";

  if (!candidate) {
    return DEFAULT_PHONE_FORMAT;
  }

  if (REDOS_RISKY.test(candidate)) {
    logger.warn(
      { pattern: candidate },
      "[phone-format] ReDoS-risky pattern rejected; using default"
    );
    return DEFAULT_PHONE_FORMAT;
  }

  try {
    new RegExp(candidate);
    return candidate;
  } catch (err) {
    logger.warn(
      {
        pattern: candidate,
        error: err instanceof Error ? err.message : String(err),
      },
      "[phone-format] invalid regex pattern detected; using default"
    );
    return DEFAULT_PHONE_FORMAT;
  }
}

export function isValidPhoneFormatPattern(raw?: string | null): boolean {
  return normalizePhoneFormatPattern(raw) === (raw?.trim() ?? "");
}
