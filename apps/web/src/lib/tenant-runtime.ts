const TENANT_SLUG_COOKIE = 'zendocx-tenant-slug';
const TENANT_SLUG_STORAGE_KEY = 'zendocx-tenant-slug';

export function isPrivateDevelopmentHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
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

export function persistActiveTenantSlug(slug: string | null): void {
  persistTenantSlug(slug);
}

export function clearPersistedTenantSlug(): void {
  persistTenantSlug(null);
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

  if (hostname.endsWith('.zendocx.net')) {
    const slug = hostname.replace(/\.zendocx\.net$/, '');
    if (slug && slug !== 'www') {
      persistTenantSlug(slug);
      return slug;
    }
  }

  if (isPrivateDevelopmentHost(hostname)) {
    return (
      readTenantSlugFromCookie() ??
      readTenantSlugFromStorage() ??
      getConfiguredDevTenantSlug()
    );
  }

  return null;
}

export function shouldAllowPlatformLoginFallback(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return isPrivateDevelopmentHost(window.location.hostname.toLowerCase());
}
