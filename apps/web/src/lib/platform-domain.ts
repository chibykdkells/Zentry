const DEFAULT_PLATFORM_DOMAIN = 'zendocx.net';

function normalizePlatformDomain(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    return DEFAULT_PLATFORM_DOMAIN;
  }

  try {
    const normalizedUrl = raw.includes('://') ? raw : `https://${raw}`;
    const url = new URL(normalizedUrl);
    return url.hostname.trim().toLowerCase() || DEFAULT_PLATFORM_DOMAIN;
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, '') || DEFAULT_PLATFORM_DOMAIN;
  }
}

export const PLATFORM_DOMAIN = normalizePlatformDomain(
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? process.env.NEXT_PUBLIC_APP_URL,
);

export function isPrivateDevelopmentHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)
  );
}

export function isPlatformHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === PLATFORM_DOMAIN || normalized.endsWith(`.${PLATFORM_DOMAIN}`);
}

export function isCustomTenantHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    Boolean(normalized) &&
    normalized !== PLATFORM_DOMAIN &&
    !normalized.endsWith(`.${PLATFORM_DOMAIN}`) &&
    !isPrivateDevelopmentHostname(normalized)
  );
}

export function extractTenantSlugFromPlatformHostname(
  hostname: string,
  reservedSubdomains: Set<string>,
): string | null {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized.endsWith(`.${PLATFORM_DOMAIN}`)) {
    return null;
  }

  const slug = normalized.replace(
    new RegExp(`\\.${PLATFORM_DOMAIN.replace('.', '\\.')}$`),
    '',
  );
  if (!slug || reservedSubdomains.has(slug)) {
    return null;
  }

  return slug;
}
