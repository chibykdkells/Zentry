import { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LoginForm } from '@/components/auth/login-form';
import { buildTenantMetadataDescription } from '@/lib/tenant-public-config';
import { resolveTenantPublicContext } from '@/lib/tenant-server';

async function resolveTenantLoginContext(
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
