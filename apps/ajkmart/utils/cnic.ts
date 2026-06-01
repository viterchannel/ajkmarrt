/**
 * Pakistani CNIC validation utility.
 *
 * A Pakistani CNIC has 13 digits in the form XXXXX-XXXXXXX-X.
 * NADRA uses a Verhoeff-style alternating weighted checksum.
 * The standard algorithm: multiply alternating digits by 2 and 1
 * (starting from position 0 = weight 2), sum all products (if a
 * product >= 10, add its digits), and the total must be divisible by 10.
 */

const WEIGHTS = [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

function sumDigits(n: number): number {
  return n >= 10 ? Math.floor(n / 10) + (n % 10) : n;
}

export function isValidPakistaniCnic(cnic: string): boolean {
  const digits = cnic.replace(/\D/g, "");
  if (digits.length !== 13) return false;

  let total = 0;
  for (let i = 0; i < 13; i++) {
    const d = parseInt(digits[i]!, 10);
    total += sumDigits(d * WEIGHTS[i]!);
  }
  return total % 10 === 0;
}
