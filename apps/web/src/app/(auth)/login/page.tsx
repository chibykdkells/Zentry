import { Suspense } from 'react';
import { headers } from 'next/headers';
import { LoginForm } from '@/components/auth/login-form';
import { fetchTenantPublicConfig } from '@/lib/tenant-public-config';
import {
  resolveTenantSlugFromCustomDomain,
  resolveTenantSlugFromHost,
} from '@/lib/tenant-server';

export default async function LoginPage({
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
  const hostname = (headerStore.get('host') ?? '').split(':')[0].trim().toLowerCase();
  const hostTenantSlug = resolveTenantSlugFromHost(headerStore.get('host') ?? '');
  const customDomainTenantSlug =
    explicitTenantSlug || hostTenantSlug
      ? null
      : await resolveTenantSlugFromCustomDomain(hostname);
  const tenantSlug = explicitTenantSlug ?? hostTenantSlug ?? customDomainTenantSlug;
  const initialTenant = await fetchTenantPublicConfig(tenantSlug);

  return (
    <Suspense fallback={null}>
      <LoginForm initialTenant={initialTenant} />
    </Suspense>
  );
}
