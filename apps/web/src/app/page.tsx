import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TenantPortalHome } from '@/components/tenant/tenant-portal-home';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'platform', 'admin']);
const RETURNING_TENANTS_COOKIE = 'zendocx-returning-tenants';

function resolveTenantSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0].trim().toLowerCase();

  if (!hostname.endsWith('.zendocx.net')) {
    return null;
  }

  const slug = hostname.replace(/\.zendocx\.net$/, '');
  if (!slug || RESERVED_SUBDOMAINS.has(slug)) {
    return null;
  }

  return slug;
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
  const hostTenantSlug = resolveTenantSlugFromHost(
    headerStore.get('host') ?? '',
  );
  const tenantSlug = explicitTenantSlug ?? hostTenantSlug;

  if (!tenantSlug) {
    redirect('/access-required');
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
