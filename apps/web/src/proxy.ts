import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
import {
  canAccessPath,
  getDefaultRouteForRole,
  isAuthRoute,
  isProtectedRoute,
} from '@/lib/auth-routes';
import { getRoleFromJwt } from '@/lib/auth-token';
import {
  extractTenantSlugFromPlatformHostname,
  isCustomTenantHostname,
} from '@/lib/platform-domain';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'platform', 'admin', 'app', 'dash']);
const RETURNING_TENANTS_COOKIE = 'ecafe-returning-tenants';

function resolveTenantSlugFromHost(host: string): string {
  const hostname = host.split(':')[0].trim().toLowerCase();
  return extractTenantSlugFromPlatformHostname(hostname, RESERVED_SUBDOMAINS) ?? '';
}

function isCustomTenantDomain(host: string): boolean {
  const hostname = host.split(':')[0].trim().toLowerCase();
  return isCustomTenantHostname(hostname);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0].trim().toLowerCase();

  // platform.ecafe.app → platform admin login / dashboard.
  // Unauthenticated users land on /platform/login; the RouteGuard handles
  // the redirect after a successful sign-in.
  if (hostname === 'platform.ecafe.app') {
    if (pathname === '/' || pathname === '') {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }
    // Auth utility pages are shared routes — serve them directly.
    const PLATFORM_PASSTHROUGH = ['/forgot-password', '/reset-password', '/verify-email'];
    if (PLATFORM_PASSTHROUGH.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/platform')) {
      return NextResponse.rewrite(new URL(`/platform${pathname}`, request.url));
    }
    return NextResponse.next();
  }

  // ecafe.app (apex) and dash.ecafe.app both resolve to the Ecafe tenant (slug: "a").
  // Apex serves the tenant landing page / portal home.
  // Dash redirects unauthenticated users straight to login.
  const isApexDomain = hostname === 'ecafe.app' || hostname === 'www.ecafe.app';
  const isDashDomain = hostname === 'dash.ecafe.app';
  const ECAFE_TENANT_SLUG = 'a';

  // dash.ecafe.app — send unauthenticated visitors at root straight to login.
  // Only redirect from "/" to avoid an infinite loop when /login itself runs
  // through the middleware (redirect → /login → redirect → /login → …).
  if (isDashDomain) {
    const res = NextResponse.next();
    res.cookies.set('ecafe-tenant-slug', ECAFE_TENANT_SLUG, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    if (pathname === '/' || pathname === '') {
      const refreshToken_ = request.cookies.get('refresh_token')?.value;
      const role_ = getRoleFromJwt(refreshToken_);
      if (!role_) {
        const redirect = NextResponse.redirect(
          new URL(`/login?tenant=${ECAFE_TENANT_SLUG}`, request.url),
        );
        redirect.cookies.set('ecafe-tenant-slug', ECAFE_TENANT_SLUG, {
          path: '/',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
        });
        return redirect;
      }
    }
    return res;
  }

  const explicitTenantSlug = request.nextUrl.searchParams.get('tenant') ?? '';
  // Apex and dash always resolve to the Ecafe tenant without a URL slug.
  const hostTenantSlug =
    isApexDomain || isDashDomain ? ECAFE_TENANT_SLUG : resolveTenantSlugFromHost(host);
  const storedTenantSlug = request.cookies.get('ecafe-tenant-slug')?.value || '';
  const entryTenantSlug = explicitTenantSlug || hostTenantSlug || '';
  const tenantSlug = explicitTenantSlug || storedTenantSlug || hostTenantSlug || '';
  const hasTenantContext = Boolean(tenantSlug) || isCustomTenantDomain(host);
  const isCustomDomainRequest = isCustomTenantDomain(host);
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const role = getRoleFromJwt(refreshToken);
  const returningTenants =
    request.cookies
      .get(RETURNING_TENANTS_COOKIE)
      ?.value.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean) ?? [];

  // For ecafe.app apex, inject the tenant slug as a request header so
  // page.tsx can read it server-side in the same request (cookies() only
  // reads from the incoming request, not the outgoing response).
  const injectTenantHeader = (response: NextResponse) => {
    const headers = new Headers(request.headers);
    headers.set('x-tenant-slug', tenantSlug);
    return NextResponse.next({ request: { headers } });
  };
  void injectTenantHeader; // used selectively below

  const persistTenantCookie = (response: NextResponse) => {
    // Always stamp the ecafe slug on apex requests so subsequent
    // navigations retain tenant context without a query param.
    if (isApexDomain) {
      response.cookies.set('ecafe-tenant-slug', ECAFE_TENANT_SLUG, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
      return response;
    }
    if (!explicitTenantSlug) {
      return response;
    }
    response.cookies.set('ecafe-tenant-slug', explicitTenantSlug, {
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
      // No tenant context and not a custom domain — serve the marketing page.
      return NextResponse.next();
    }

    const isPortalPreview = request.nextUrl.searchParams.get('preview') === '1';

    if (role && !isPortalPreview) {
      return persistTenantCookie(
        NextResponse.redirect(
          new URL(appendTenantToPath(getDefaultRouteForRole(role)), request.url),
        ),
      );
    }

    if (entryTenantSlug && returningTenants.includes(entryTenantSlug.toLowerCase())) {
      return persistTenantCookie(
        NextResponse.redirect(
          new URL(`/login?tenant=${encodeURIComponent(entryTenantSlug)}`, request.url),
        ),
      );
    }

    // For the apex domain, inject the tenant slug as a request header so
    // page.tsx can read it server-side without relying on the response cookie.
    if (isApexDomain) {
      const reqHeaders = new Headers(request.headers);
      reqHeaders.set('x-tenant-slug', ECAFE_TENANT_SLUG);
      const res = NextResponse.next({ request: { headers: reqHeaders } });
      res.cookies.set('ecafe-tenant-slug', ECAFE_TENANT_SLUG, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
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
    if (isCustomDomainRequest) {
      return persistTenantCookie(NextResponse.next());
    }

    const redirectTarget = `${pathname}${search}`;

    if (pathname.startsWith('/admin')) {
      return persistTenantCookie(NextResponse.next());
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

  if (isAuthRoute(pathname)) {
    return persistTenantCookie(NextResponse.next());
  }

  return persistTenantCookie(NextResponse.next());
}

