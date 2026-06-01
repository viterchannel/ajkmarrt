export function safeParseFloat(
  val: string | undefined | null,
  fallback: number,
  min?: number,
  max?: number
): number {
  const parsed = parseFloat(val ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  if (min !== undefined && parsed < min) return fallback;
  if (max !== undefined && parsed > max) return fallback;
  return parsed;
}
