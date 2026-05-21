import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { TenantPortalHome } from '@/components/tenant/tenant-portal-home';
import { LandingPage } from '@/components/marketing/landing-page';
import { buildTenantMetadataDescription } from '@/lib/tenant-public-config';
import { resolveTenantPublicContext } from '@/lib/tenant-server';

const RETURNING_TENANTS_COOKIE = 'zendocx-returning-tenants';

async function resolveTenantFromRequest(
  resolvedSearchParams: Record<string, string | string[] | undefined>,
) {
  const rawTenantSlug = resolvedSearchParams.tenant;
  const explicitTenantSlug = Array.isArray(rawTenantSlug)
    ? rawTenantSlug[0] ?? null
    : rawTenantSlug ?? null;
  const headerStore = await headers();
  return resolveTenantPublicContext({
    host: headerStore.get('host') ?? '',
    explicitTenantSlug,
  });
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
