import { NextRequest } from 'next/server';

const DEFAULT_NAME = 'ZenDocx';
const DEFAULT_DESCRIPTION =
  'Fast. Trusted. Document Services, Simplified.';
const DEFAULT_PRIMARY_COLOR = '#0D1B3E';
const DEFAULT_ACCENT_COLOR = '#F5A623';

function sanitizeName(value: string | null, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 60) : fallback;
}

function sanitizeSlug(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized.slice(0, 60) : null;
}

function sanitizeHexColor(value: string | null, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? (value as string) : fallback;
}

function sanitizeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantName = sanitizeName(searchParams.get('tenantName'), DEFAULT_NAME);
  const tenantSlug = sanitizeSlug(searchParams.get('tenantSlug'));
  const primaryColor = sanitizeHexColor(
    searchParams.get('primaryColor'),
    DEFAULT_PRIMARY_COLOR,
  );
  const accentColor = sanitizeHexColor(
    searchParams.get('accentColor'),
    DEFAULT_ACCENT_COLOR,
  );
  const customIconUrl = sanitizeUrl(searchParams.get('iconUrl'));

  const iconBaseParams = new URLSearchParams({
    tenantName,
    primaryColor,
    accentColor,
  });

  const startUrl = tenantSlug ? `/login?tenant=${tenantSlug}` : '/';
  const shortcuts = tenantSlug
    ? [
        {
          name: 'Business dashboard',
          url: '/tenant/dashboard',
          description: `Open ${tenantName}'s business dashboard`,
        },
        {
          name: 'Wallet',
          url: '/wallet',
          description: `Open ${tenantName}'s wallet workspace`,
        },
      ]
    : [
        {
          name: 'My Orders',
          url: '/orders',
          description: 'View your service orders',
        },
        {
          name: 'Wallet',
          url: '/wallet',
          description: 'Check your wallet balance',
        },
      ];

  const manifest = {
    name: tenantName,
    short_name: tenantName.slice(0, 24),
    description: tenantSlug
      ? `${tenantName} digital services workspace`
      : DEFAULT_DESCRIPTION,
    start_url: startUrl,
    display: 'standalone',
    background_color: primaryColor,
    theme_color: primaryColor,
    orientation: 'portrait-primary',
    categories: ['finance', 'utilities', 'productivity'],
    lang: 'en-NG',
    icons: customIconUrl
      ? [
          { src: customIconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: customIconUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      : [
          {
            src: `/pwa/icon?${iconBaseParams.toString()}&size=192`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `/pwa/icon?${iconBaseParams.toString()}&size=512`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `/pwa/icon?${iconBaseParams.toString()}&size=512`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
    shortcuts,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
