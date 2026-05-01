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

function resolveTenantSlugFromHost(host: string): string {
  const hostname = host.split(':')[0].trim().toLowerCase();

  if (!hostname.endsWith('.zendocx.net')) {
    return '';
  }

  const slug = hostname.replace(/\.zendocx\.net$/, '');
  if (!slug || RESERVED_SUBDOMAINS.has(slug)) {
    return '';
  }

  return slug;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const explicitTenantSlug = request.nextUrl.searchParams.get('tenant') ?? '';
  const hostTenantSlug = resolveTenantSlugFromHost(
    request.headers.get('host') ?? '',
  );
  const storedTenantSlug =
    request.cookies.get('zendocx-tenant-slug')?.value || '';
  const entryTenantSlug = explicitTenantSlug || hostTenantSlug || '';
  const tenantSlug =
    explicitTenantSlug ||
    storedTenantSlug ||
    hostTenantSlug ||
    '';
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const role = getRoleFromJwt(refreshToken);
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
    const entryUrl = new URL(
      entryTenantSlug
        ? `/login?tenant=${encodeURIComponent(entryTenantSlug)}`
        : '/access-required',
      request.url,
    );
    return persistTenantCookie(NextResponse.redirect(entryUrl));
  }

  if (
    pathname === '/login' &&
    !entryTenantSlug
  ) {
    return persistTenantCookie(
      NextResponse.redirect(new URL('/access-required?reason=tenant-link', request.url)),
    );
  }

  if (
    pathname.startsWith('/register') &&
    !entryTenantSlug
  ) {
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

    if (!tenantSlug) {
      return persistTenantCookie(
        NextResponse.redirect(
          new URL('/access-required?reason=tenant-link', request.url),
        ),
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('tenant', tenantSlug);
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
