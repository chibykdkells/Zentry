const TENANT_SLUG_COOKIE = 'zendocx-tenant-slug';
const TENANT_SLUG_STORAGE_KEY = 'zendocx-tenant-slug';
const RETURNING_TENANTS_COOKIE = 'zendocx-returning-tenants';
const RETURNING_TENANTS_STORAGE_KEY = 'zendocx-returning-tenants';

const PLATFORM_DOMAIN = 'zendocx.net';

export function isPrivateDevelopmentHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

/**
 * Returns true when the browser is running on a tenant custom domain
 * (e.g. ecafe.app) rather than a *.zendocx.net subdomain or localhost.
 */
export function isCustomTenantDomain(hostname: string): boolean {
  return (
    Boolean(hostname) &&
    hostname !== PLATFORM_DOMAIN &&
    !hostname.endsWith(`.${PLATFORM_DOMAIN}`) &&
    !isPrivateDevelopmentHost(hostname)
  );
}

/**
 * Calls the API to resolve the tenant slug for a custom domain hostname.
 * Persists the resolved slug to cookie + localStorage so subsequent API
 * calls can send the correct x-tenant-slug header.
 */
export async function discoverCustomDomainTenantSlug(
  hostname: string,
): Promise<string | null> {
  if (!isCustomTenantDomain(hostname)) return null;

  try {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(
      `${apiBase}/api/v1/tenants/resolve-host?host=${encodeURIComponent(hostname)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data: { slug: string } | null };
    return json?.data?.slug ?? null;
  } catch {
    return null;
  }
}

function getConfiguredDevTenantSlug(): string | null {
  const configured = process.env.NEXT_PUBLIC_DEV_TENANT_SLUG?.trim() ?? '';
  return configured || null;
}

function normalizeTenantSlug(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || null;
}

function readTenantSlugFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieValue = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${TENANT_SLUG_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');

  return normalizeTenantSlug(
    cookieValue ? decodeURIComponent(cookieValue) : null,
  );
}

function readTenantSlugFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeTenantSlug(
      window.localStorage.getItem(TENANT_SLUG_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function readTenantSlugFromHostname(hostname: string): string | null {
  if (!hostname.endsWith('.zendocx.net')) {
    return null;
  }

  const slug = hostname.replace(/\.zendocx\.net$/, '');
  if (!slug || slug === 'www') {
    return null;
  }

  return normalizeTenantSlug(slug);
}

function persistTenantSlug(slug: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeTenantSlug(slug);

  try {
    if (normalized) {
      window.localStorage.setItem(TENANT_SLUG_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(TENANT_SLUG_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in constrained browsers.
  }

  if (normalized) {
    document.cookie = `${TENANT_SLUG_COOKIE}=${encodeURIComponent(normalized)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
    return;
  }

  document.cookie = `${TENANT_SLUG_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function readReturningTenantSlugs() {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  const fromCookie = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${RETURNING_TENANTS_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');

  const parsedCookie = (fromCookie ? decodeURIComponent(fromCookie) : '')
    .split(',')
    .map((item) => normalizeTenantSlug(item))
    .filter((item): item is string => Boolean(item));

  try {
    const storageValue =
      window.localStorage.getItem(RETURNING_TENANTS_STORAGE_KEY) ?? '';
    const parsedStorage = storageValue
      .split(',')
      .map((item) => normalizeTenantSlug(item))
      .filter((item): item is string => Boolean(item));

    return new Set([...parsedCookie, ...parsedStorage]);
  } catch {
    return new Set(parsedCookie);
  }
}

export function persistActiveTenantSlug(slug: string | null): void {
  persistTenantSlug(slug);
}

export function clearPersistedTenantSlug(): void {
  persistTenantSlug(null);
}

export function markReturningTenantPortal(slug: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeTenantSlug(slug);
  if (!normalized) {
    return;
  }

  const next = Array.from(readReturningTenantSlugs().add(normalized)).join(',');

  try {
    window.localStorage.setItem(RETURNING_TENANTS_STORAGE_KEY, next);
  } catch {
    // Ignore constrained storage environments.
  }

  document.cookie = `${RETURNING_TENANTS_COOKIE}=${encodeURIComponent(next)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 180}`;
}

export function resolveTenantSlugForRequest(): string | null {
  if (typeof window === 'undefined') {
    return getConfiguredDevTenantSlug();
  }

  const searchParams = new URLSearchParams(window.location.search);
  const explicitSlug = searchParams.get('tenant') ?? searchParams.get('slug');
  if (explicitSlug?.trim()) {
    const normalizedExplicitSlug = explicitSlug.trim().toLowerCase();
    persistTenantSlug(normalizedExplicitSlug);
    return normalizedExplicitSlug;
  }

  const hostname = window.location.hostname.toLowerCase();
  const hostnameSlug = readTenantSlugFromHostname(hostname);
  if (hostnameSlug) {
    persistTenantSlug(hostnameSlug);
    return hostnameSlug;
  }

  return (
    readTenantSlugFromCookie() ??
    readTenantSlugFromStorage() ??
    (isPrivateDevelopmentHost(hostname) ? getConfiguredDevTenantSlug() : null)
  );
}

export function shouldAllowPlatformLoginFallback(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return isPrivateDevelopmentHost(window.location.hostname.toLowerCase());
}

export function appendTenantContextToPath(
  href: string,
  tenantSlug?: string | null,
): string {
  const normalizedSlug = normalizeTenantSlug(tenantSlug);
  if (!normalizedSlug || !href.startsWith('/')) {
    return href;
  }

  if (href.startsWith('/admin') || href.startsWith('/platform')) {
    return href;
  }

  try {
    const url = new URL(href, 'http://zendocx.local');
    if (!url.searchParams.has('tenant') && !url.searchParams.has('slug')) {
      url.searchParams.set('tenant', normalizedSlug);
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
