/**
 * Format a Kobo value (as number or string from API) to ₦ display string.
 * The API returns BigInt serialized as string.
 */
export function formatNaira(koboStr: string | number | bigint): string {
  const kobo = typeof koboStr === 'bigint' ? Number(koboStr) : Number(koboStr);
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira);
}

export function formatDate(dateStr: string | Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function formatShortDate(dateStr: string | Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function truncate(str: string, length = 20): string {
  return str.length > length ? `${str.slice(0, length)}...` : str;
}

export function formatTimeUntil(dateStr: string | Date): string {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return 'Expired';
  }

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours <= 0) {
    return `${Math.max(minutes, 1)} min remaining`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h remaining`;
  }

  return `${hours}h ${remainingMinutes}m remaining`;
}
