/**
 * Safely extract a human-readable message from any error-shaped value.
 * Returns a non-empty string so callers never need `|| "fallback"`.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string" &&
    (err as Record<string, unknown>).message
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  return "Unknown error";
}
