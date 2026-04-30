/**
 * Generate a human-readable order number.
 * Format: ZTR-YYYYMMDD-XXXXXX (e.g. ZTR-20260403-A3F7K2)
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `ZTR-${dateStr}-${random}`;
}

/**
 * Generate a unique transaction reference.
 * Format: ZDX-TXN-{timestamp}-{random} (URL-safe, unique)
 */
export function generateTransactionRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `ZDX-TXN-${timestamp}-${random}`;
}

/**
 * Generate a short random token (for webhook idempotency keys etc.)
 */
export function generateShortId(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
