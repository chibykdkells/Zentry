import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TenantPortalHome } from '@/components/tenant/tenant-portal-home';
import { LandingPage } from '@/components/marketing/landing-page';
import { fetchTenantPublicConfig } from '@/lib/tenant-public-config';
import {
  resolveTenantSlugFromCustomDomain,
  resolveTenantSlugFromHost,
} from '@/lib/tenant-server';

const RETURNING_TENANTS_COOKIE = 'zendocx-returning-tenants';

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

  const initialTenant = await fetchTenantPublicConfig(tenantSlug);

  const returningTenants = (cookieStore.get(RETURNING_TENANTS_COOKIE)?.value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (returningTenants.includes(tenantSlug.toLowerCase())) {
    redirect(`/login?tenant=${encodeURIComponent(tenantSlug)}`);
  }

  return <TenantPortalHome tenantSlug={tenantSlug} initialTenant={initialTenant} />;
}
