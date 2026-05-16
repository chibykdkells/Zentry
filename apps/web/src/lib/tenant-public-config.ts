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

export async function fetchTenantPublicConfig(
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
