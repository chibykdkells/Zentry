import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import {
  extractTenantSlugFromPlatformHostname,
  isCustomTenantHostname,
} from '@/lib/platform-domain';
import { fetchTenantPublicConfig } from '@/lib/tenant-public-config';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'platform', 'admin', 'app']);

export function resolveTenantSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0].trim().toLowerCase();
  return extractTenantSlugFromPlatformHostname(hostname, RESERVED_SUBDOMAINS);
}

async function resolveTenantSlugFromCustomDomainUncached(
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

const resolveTenantSlugFromCustomDomainCached = unstable_cache(
  async (hostname: string) =>
    resolveTenantSlugFromCustomDomainUncached(hostname),
  ['tenant-custom-domain-resolve'],
  {
    revalidate: 60 * 10,
  },
);

export async function resolveTenantSlugFromCustomDomain(
  hostname: string,
): Promise<string | null> {
  return resolveTenantSlugFromCustomDomainCached(hostname);
}

export const resolveTenantPublicContext = cache(
  async (options: { host: string; explicitTenantSlug?: string | null }) => {
    const host = options.host ?? '';
    const explicitTenantSlug = options.explicitTenantSlug?.trim() || null;
    const hostname = host.split(':')[0].trim().toLowerCase();
    const hostTenantSlug = resolveTenantSlugFromHost(host);
    const customDomainTenantSlug =
      explicitTenantSlug || hostTenantSlug
        ? null
        : await resolveTenantSlugFromCustomDomain(hostname);
    const tenantSlug =
      explicitTenantSlug ?? hostTenantSlug ?? customDomainTenantSlug;
    const initialTenant = await fetchTenantPublicConfig(tenantSlug);

    return { tenantSlug, initialTenant };
  },
);
