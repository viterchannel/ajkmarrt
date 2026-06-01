/**
 * Shared password strength utilities for admin auth pages.
 * Consumed by: FirstLoginCredentialsDialog, reset-password, set-new-password.
 */

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Returns a human-readable validation error, or null when the password
 * satisfies the minimum requirements (≥8 chars, 1 uppercase, 1 digit).
 */
export function validateStrength(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw)) return "Password must contain at least 1 uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least 1 number.";
  return null;
}

/**
 * Maps a password string to a 0-4 strength score.
 * 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong.
 */
export function computeStrength(pw: string): StrengthLevel {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  if (!/[A-Z]/.test(pw)) return 2;
  if (!/[0-9]/.test(pw)) return 3;
  return 4;
}

export const STRENGTH_META: Record<StrengthLevel, { label: string; bar: string; text: string }> = {
  0: { label: "", bar: "", text: "" },
  1: { label: "Weak", bar: "bg-red-500", text: "text-red-400" },
  2: { label: "Fair", bar: "bg-orange-400", text: "text-orange-400" },
  3: { label: "Good", bar: "bg-amber-400", text: "text-amber-400" },
  4: { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-400" },
};
