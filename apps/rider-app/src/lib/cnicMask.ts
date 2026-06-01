/**
 * CNIC display masking utilities.
 *
 * Raw stored format: 12345-1234567-1
 * Masked display:    XXXXX-1234567-X
 *
 * The first 5 digits and the last check digit are replaced with X, while the
 * 7-digit middle segment is preserved so the rider can identify their own CNIC
 * without revealing the full number to shoulder-surfers.
 *
 * The raw value is only shown when the user explicitly enters edit mode.
 */

/**
 * Mask a CNIC for safe display.
 *
 * Accepts both raw (digits only) and formatted (with dashes) input.
 * Returns the masked form `XXXXX-NNNNNNN-X` when the input is a valid 13-digit
 * CNIC.  Returns the original value unchanged for any other input so the UI
 * never silently swallows data.
 */
export function maskCnic(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";

  const digits = raw.replace(/\D/g, "");

  if (digits.length !== 13) {
    return raw;
  }

  const middle = digits.slice(5, 12);
  return `XXXXX-${middle}-X`;
}

/**
 * Return true if the string looks like a valid unmasked CNIC (i.e. the user
 * has edit-mode access and the raw number should be used for the input field).
 */
export function isRawCnic(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{5}-\d{7}-\d$/.test(value);
}
