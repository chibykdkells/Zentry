import { unstable_cache } from 'next/cache';

export interface TenantPublicConfig {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  buttonColor: string;
  fontStyle: string;
  customDomain: string | null;
  customDomainVerified: boolean;
  homepageTemplate: 'spotlight' | 'service-grid' | 'guided-flow';
  homepageHeading: string | null;
  homepageSubheading: string | null;
  homepageAbout: string | null;
  homepageManualSteps: Array<{
    title: string;
    description: string;
  }>;
}

const LEGACY_AUTO_HEADING_PATTERN = /^access\s+.+\s+from one business portal$/i;
const LEGACY_AUTO_SUBHEADING_PATTERN =
  /^review the available services, understand the process, and sign in when you are ready to continue\.?$/i;

export function buildTenantDefaultHeading(brandName: string): string {
  return `${brandName} helps you handle paperwork from the comfort of your home`;
}

export function buildTenantDefaultSubheading(): string {
  return 'Request everyday paperwork, registrations, and online support services easily, affordably, and without leaving home.';
}

export function buildTenantMetadataDescription(brandName: string): string {
  return `${brandName} makes paperwork and online support services simple, convenient, and affordable from the comfort of your home.`;
}

export function resolveTenantHeading(
  tenant: TenantPublicConfig | null | undefined,
): string {
  const brandName = tenant?.name?.trim() || 'Service portal';
  const configuredHeading = tenant?.homepageHeading?.trim() ?? '';

  if (!configuredHeading || LEGACY_AUTO_HEADING_PATTERN.test(configuredHeading)) {
    return buildTenantDefaultHeading(brandName);
  }

  return configuredHeading;
}

export function resolveTenantSubheading(
  tenant: TenantPublicConfig | null | undefined,
): string {
  const configuredSubheading = tenant?.homepageSubheading?.trim() ?? '';

  if (
    !configuredSubheading ||
    LEGACY_AUTO_SUBHEADING_PATTERN.test(configuredSubheading)
  ) {
    return buildTenantDefaultSubheading();
  }

  return configuredSubheading;
}

async function fetchTenantPublicConfigUncached(
  tenantSlug: string | null | undefined,
): Promise<TenantPublicConfig | null> {
  const normalizedSlug = tenantSlug?.trim().toLowerCase() ?? '';
  if (!normalizedSlug) {
    return null;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(
      `${apiBase}/api/v1/tenants/config?slug=${encodeURIComponent(normalizedSlug)}`,
      { cache: 'no-store' },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: TenantPublicConfig | null;
    };

    return payload?.data ?? null;
  } catch {
    return null;
  }
}

const fetchTenantPublicConfigCached = unstable_cache(
  async (tenantSlug: string | null | undefined) =>
    fetchTenantPublicConfigUncached(tenantSlug),
  ['tenant-public-config'],
  {
    revalidate: 60 * 10,
  },
);

export async function fetchTenantPublicConfig(
  tenantSlug: string | null | undefined,
): Promise<TenantPublicConfig | null> {
  return fetchTenantPublicConfigCached(tenantSlug);
}
