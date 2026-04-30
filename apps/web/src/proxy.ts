import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  canAccessPath,
  getDefaultRouteForRole,
  isAuthRoute,
  isProtectedRoute,
} from '@/lib/auth-routes';
import { getRoleFromJwt } from '@/lib/auth-token';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const explicitTenantSlug = request.nextUrl.searchParams.get('tenant') ?? '';
  const tenantSlug = explicitTenantSlug || request.cookies.get('zendocx-tenant-slug')?.value || '';
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

  if (isProtectedRoute(pathname) && !role) {
    const loginUrl = new URL('/login', request.url);
    const redirectTarget = `${pathname}${search}`;

    if (tenantSlug) {
      loginUrl.searchParams.set('tenant', tenantSlug);
    }

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
