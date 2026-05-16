import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  canAccessPath,
  getDefaultRouteForRole,
  isAuthRoute,
  isProtectedRoute,
} from '@/lib/auth-routes';
import { getRoleFromJwt } from '@/lib/auth-token';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'platform', 'admin']);
const RETURNING_TENANTS_COOKIE = 'zendocx-returning-tenants';
const PLATFORM_DOMAIN = 'zendocx.net';

function resolveTenantSlugFromHost(host: string): string {
  const hostname = host.split(':')[0].trim().toLowerCase();

  if (!hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
    return '';
  }

  const slug = hostname.replace(new RegExp(`\\.${PLATFORM_DOMAIN.replace('.', '\\.')}$`), '');
  if (!slug || RESERVED_SUBDOMAINS.has(slug)) {
    return '';
  }

  return slug;
}

/**
 * Returns true when the incoming request is from a verified tenant custom
 * domain (e.g. ecafe.app) rather than a *.zendocx.net subdomain or localhost.
 * The API resolves the tenant from the Host header, so the proxy only needs
 * to know that a tenant context exists — not the slug itself.
 */
function isCustomTenantDomain(host: string): boolean {
  const hostname = host.split(':')[0].trim().toLowerCase();
  return (
    Boolean(hostname) &&
    hostname !== PLATFORM_DOMAIN &&
    !hostname.endsWith(`.${PLATFORM_DOMAIN}`) &&
    hostname !== 'localhost' &&
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const explicitTenantSlug = request.nextUrl.searchParams.get('tenant') ?? '';
  const hostTenantSlug = resolveTenantSlugFromHost(host);
  const storedTenantSlug =
    request.cookies.get('zendocx-tenant-slug')?.value || '';
  const entryTenantSlug = explicitTenantSlug || hostTenantSlug || '';
  const tenantSlug =
    explicitTenantSlug ||
    storedTenantSlug ||
    hostTenantSlug ||
    '';
  // On a verified custom domain (e.g. ecafe.app), the tenant is resolved by
  // the API from the Host header. The proxy doesn't need the slug — it just
  // needs to know a tenant context is present so it doesn't block routes.
  const hasTenantContext = Boolean(tenantSlug) || isCustomTenantDomain(host);
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const role = getRoleFromJwt(refreshToken);
  const returningTenants =
    request.cookies
      .get(RETURNING_TENANTS_COOKIE)
      ?.value.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const persistTenantCookie = (response: NextResponse) => {
    if (!explicitTenantSlug) {
      return response;
    }

    response.cookies.set('zendocx-tenant-slug', explicitTenantSlug, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  };

  const appendTenantToPath = (href: string) => {
    if (!tenantSlug || href.startsWith('/admin') || href.startsWith('/platform')) {
      return href;
    }

    const url = new URL(href, request.url);
    if (!url.searchParams.has('tenant') && !url.searchParams.has('slug')) {
      url.searchParams.set('tenant', tenantSlug);
    }

    return `${url.pathname}${url.search}${url.hash}`;
  };

  if (pathname === '/') {
    const isCustomDomain = isCustomTenantDomain(host);

    if (!entryTenantSlug && !isCustomDomain) {
      // Root platform domain (zendocx.net / www.zendocx.net) — SaaS landing page
      return NextResponse.next();
    }

    // ?preview=1 lets authenticated admins view the public portal home as a visitor
    const isPortalPreview = request.nextUrl.searchParams.get('preview') === '1';

    if (role && !isPortalPreview) {
      return persistTenantCookie(
        NextResponse.redirect(
          new URL(
            appendTenantToPath(getDefaultRouteForRole(role)),
            request.url,
          ),
        ),
      );
    }

    if (entryTenantSlug && returningTenants.includes(entryTenantSlug.toLowerCase())) {
      return persistTenantCookie(
        NextResponse.redirect(
          new URL(
            `/login?tenant=${encodeURIComponent(entryTenantSlug)}`,
            request.url,
          ),
        ),
      );
    }

    return persistTenantCookie(NextResponse.next());
  }

  if (pathname === '/login' && !hasTenantContext) {
    return persistTenantCookie(
      NextResponse.redirect(new URL('/access-required?reason=tenant-link', request.url)),
    );
  }

  if (pathname.startsWith('/register') && !hasTenantContext) {
    return persistTenantCookie(
      NextResponse.redirect(new URL('/access-required?reason=tenant-link', request.url)),
    );
  }

  if (
    entryTenantSlug &&
    (pathname === '/platform' ||
      pathname === '/platform/login' ||
      pathname === '/admin')
  ) {
    return persistTenantCookie(
      NextResponse.redirect(
        new URL('/access-required?reason=platform-link', request.url),
      ),
    );
  }

  if (isProtectedRoute(pathname) && !role) {
    const redirectTarget = `${pathname}${search}`;

    if (pathname.startsWith('/admin')) {
      const accessRequiredUrl = new URL('/access-required', request.url);
      accessRequiredUrl.searchParams.set('reason', 'platform-link');
      return persistTenantCookie(NextResponse.redirect(accessRequiredUrl));
    }

    if (!hasTenantContext) {
      return persistTenantCookie(
        NextResponse.redirect(
          new URL('/access-required?reason=tenant-link', request.url),
        ),
      );
    }

    const loginUrl = new URL('/login', request.url);
    if (tenantSlug) loginUrl.searchParams.set('tenant', tenantSlug);
    if (redirectTarget !== '/login') {
      loginUrl.searchParams.set('next', redirectTarget);
    }

    return persistTenantCookie(NextResponse.redirect(loginUrl));
  }

  if (role && !canAccessPath(role, pathname)) {
    return persistTenantCookie(
      NextResponse.redirect(
        new URL(appendTenantToPath(getDefaultRouteForRole(role)), request.url),
      ),
    );
  }

  // Auth routes intentionally remain client-controlled.
  // A refresh cookie can be structurally valid but already revoked server-side,
  // so redirecting from middleware causes loops between /login and protected pages.
  if (isAuthRoute(pathname)) {
    return persistTenantCookie(NextResponse.next());
  }

  return persistTenantCookie(NextResponse.next());
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/admin',
    '/platform',
    '/platform/login',
    '/register/:path*',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/home',
    '/services',
    '/orders',
    '/profile',
    '/wallet',
    '/notifications',
    '/security',
    '/disputes',
    '/support',
    '/dashboard',
    '/job-pool',
    '/my-jobs',
    '/earnings',
    '/withdraw',
    '/tenant/:path*',
    '/admin/:path*',
  ],
};
