import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TenantPortalHome } from '@/components/tenant/tenant-portal-home';
import { LandingPage } from '@/components/marketing/landing-page';
import {
  extractTenantSlugFromPlatformHostname,
  isCustomTenantHostname,
} from '@/lib/platform-domain';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'platform', 'admin', 'app']);
const RETURNING_TENANTS_COOKIE = 'zendocx-returning-tenants';

function resolveTenantSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0].trim().toLowerCase();
  return extractTenantSlugFromPlatformHostname(hostname, RESERVED_SUBDOMAINS);
}

async function resolveTenantSlugFromCustomDomain(hostname: string): Promise<string | null> {
  if (!isCustomTenantHostname(hostname)) {
    return null;
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawTenantSlug = resolvedSearchParams.tenant;
  const explicitTenantSlug = Array.isArray(rawTenantSlug)
    ? rawTenantSlug[0] ?? null
    : rawTenantSlug ?? null;
  const headerStore = await headers();
  const cookieStore = await cookies();
  const hostname = (headerStore.get('host') ?? '').split(':')[0].trim().toLowerCase();
  const hostTenantSlug = resolveTenantSlugFromHost(
    headerStore.get('host') ?? '',
  );
  const customDomainTenantSlug =
    explicitTenantSlug || hostTenantSlug
      ? null
      : await resolveTenantSlugFromCustomDomain(hostname);
  const tenantSlug = explicitTenantSlug ?? hostTenantSlug ?? customDomainTenantSlug;

  if (!tenantSlug) {
    return <LandingPage />;
  }

  const returningTenants = (cookieStore.get(RETURNING_TENANTS_COOKIE)?.value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (returningTenants.includes(tenantSlug.toLowerCase())) {
    redirect(`/login?tenant=${encodeURIComponent(tenantSlug)}`);
  }

  return <TenantPortalHome tenantSlug={tenantSlug} />;
}
