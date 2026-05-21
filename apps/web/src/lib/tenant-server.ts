import {
  extractTenantSlugFromPlatformHostname,
  isCustomTenantHostname,
} from '@/lib/platform-domain';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'platform', 'admin', 'app']);

export function resolveTenantSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0].trim().toLowerCase();
  return extractTenantSlugFromPlatformHostname(hostname, RESERVED_SUBDOMAINS);
}

export async function resolveTenantSlugFromCustomDomain(
  hostname: string,
): Promise<string | null> {
  if (!isCustomTenantHostname(hostname)) {
    return null;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(
      `${apiBase}/api/v1/tenants/resolve-host?host=${encodeURIComponent(hostname)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: { data?: { slug?: string | null } | null } | null;
    };
    const resolvedSlug = payload?.data?.data?.slug?.trim().toLowerCase() ?? '';
    return resolvedSlug || null;
  } catch {
    return null;
  }
}
