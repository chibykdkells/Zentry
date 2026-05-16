import { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LoginForm } from '@/components/auth/login-form';
import {
  buildTenantMetadataDescription,
  fetchTenantPublicConfig,
} from '@/lib/tenant-public-config';
import {
  resolveTenantSlugFromCustomDomain,
  resolveTenantSlugFromHost,
} from '@/lib/tenant-server';

async function resolveTenantLoginContext(
  resolvedSearchParams: Record<string, string | string[] | undefined>,
) {
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

  return { initialTenant };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { initialTenant } = await resolveTenantLoginContext(resolvedSearchParams);

  if (!initialTenant) {
    return {
      title: 'Sign in — ZenDocx',
    };
  }

  const brandName = initialTenant.name.trim() || 'Service portal';
  return {
    title: `Sign in — ${brandName}`,
    description: buildTenantMetadataDescription(brandName),
    appleWebApp: {
      title: brandName,
    },
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { initialTenant } = await resolveTenantLoginContext(resolvedSearchParams);

  return (
    <Suspense fallback={null}>
      <LoginForm initialTenant={initialTenant} />
    </Suspense>
  );
}
