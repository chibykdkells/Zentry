/**
 * Convert Naira amount to Kobo (integer).
 * All money in ZenDocx is stored in Kobo to avoid floating point issues.
 *
 * @example nairaToKobo(1500) → 150000n
 */
export function nairaToKobo(naira: number): bigint {
  return BigInt(Math.round(naira * 100));
}

/**
 * Convert Kobo amount to a plain Naira decimal string (no currency symbol).
 *
 * @example koboToNaira(150000n) → "1500.00"
 */
export function koboToNaira(kobo: bigint): string {
  const naira = Number(kobo) / 100;
  return naira.toFixed(2);
}

/**
 * Format a Kobo amount as a Naira display string with symbol and commas.
 *
 * @example formatNaira(150000n) → "₦1,500.00"
 */
export function formatNaira(kobo: bigint): string {
  const naira = Number(kobo) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira);
}

/**
 * Add two Kobo amounts safely.
 */
export function addKobo(a: bigint, b: bigint): bigint {
  return a + b;
}

/**
 * Subtract two Kobo amounts safely. Throws if result would be negative.
 */
export function subtractKobo(from: bigint, amount: bigint): bigint {
  if (amount > from) {
    throw new Error(
      `Insufficient balance: cannot subtract ${amount} from ${from}`,
    );
  }
  return from - amount;
}
