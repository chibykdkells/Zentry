import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { TenantPortalHome } from '@/components/tenant/tenant-portal-home';
import { LandingPage } from '@/components/marketing/landing-page';
import {
  buildTenantMetadataDescription,
  fetchTenantPublicConfig,
} from '@/lib/tenant-public-config';
import {
  resolveTenantSlugFromCustomDomain,
  resolveTenantSlugFromHost,
} from '@/lib/tenant-server';

const RETURNING_TENANTS_COOKIE = 'ecafe-returning-tenants';

// Subdomains that are reserved for platform use and never map to a tenant slug.
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'platform', 'admin', 'app', 'dash']);

async function resolveTenantFromRequest(
  resolvedSearchParams: Record<string, string | string[] | undefined>,
) {
  const rawTenantSlug = resolvedSearchParams.tenant;
  const explicitTenantSlug = Array.isArray(rawTenantSlug)
    ? rawTenantSlug[0] ?? null
    : rawTenantSlug ?? null;
  const headerStore = await headers();
  const host = headerStore.get('host') ?? '';
  const hostname = host.split(':')[0].trim().toLowerCase();

  // The cookie set by the middleware carries the resolved tenant slug for
  // apex (ecafe.app) and dash (dash.ecafe.app) requests.
  const cookieStore = await cookies();
  const cookieTenantSlug = cookieStore.get('ecafe-tenant-slug')?.value ?? null;

  const hostTenantSlug = resolveTenantSlugFromHost(host);
  const customDomainTenantSlug =
    explicitTenantSlug || hostTenantSlug || cookieTenantSlug
      ? null
      : await resolveTenantSlugFromCustomDomain(hostname);

  // Prefer explicit > host subdomain > middleware cookie > custom domain lookup.
  // The cookie covers ecafe.app apex and dash.ecafe.app where the host alone
  // does not yield a subdomain slug.
  const tenantSlug =
    explicitTenantSlug ?? hostTenantSlug ?? cookieTenantSlug ?? customDomainTenantSlug;

  // Ignore reserved slugs (platform, admin, etc.) that sneak in via cookie.
  const resolvedSlug = tenantSlug && !RESERVED_SUBDOMAINS.has(tenantSlug) ? tenantSlug : null;
  const initialTenant = await fetchTenantPublicConfig(resolvedSlug);

  return { tenantSlug: resolvedSlug, initialTenant };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { tenantSlug, initialTenant } = await resolveTenantFromRequest(
    resolvedSearchParams,
  );

  if (!tenantSlug || !initialTenant) {
    return {};
  }

  const brandName = initialTenant.name.trim() || 'Service portal';
  return {
    title: `${brandName} — Service portal`,
    description: buildTenantMetadataDescription(brandName),
    appleWebApp: {
      title: brandName,
    },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { tenantSlug, initialTenant } =
    await resolveTenantFromRequest(resolvedSearchParams);
  const cookieStore = await cookies();

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

  return <TenantPortalHome tenantSlug={tenantSlug} initialTenant={initialTenant} />;
}
