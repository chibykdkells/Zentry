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
  const tenantSlug =
    request.nextUrl.searchParams.get('tenant') ??
    request.cookies.get('zendocx-tenant-slug')?.value ??
    '';
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const role = getRoleFromJwt(refreshToken);

  if (isProtectedRoute(pathname) && !role) {
    const loginUrl = new URL('/login', request.url);
    const redirectTarget = `${pathname}${search}`;

    if (tenantSlug) {
      loginUrl.searchParams.set('tenant', tenantSlug);
    }

    if (redirectTarget !== '/login') {
      loginUrl.searchParams.set('next', redirectTarget);
    }

    return NextResponse.redirect(loginUrl);
  }

  if (role && !canAccessPath(role, pathname)) {
    return NextResponse.redirect(
      new URL(getDefaultRouteForRole(role), request.url),
    );
  }

  // Auth routes intentionally remain client-controlled.
  // A refresh cookie can be structurally valid but already revoked server-side,
  // so redirecting from middleware causes loops between /login and protected pages.
  if (isAuthRoute(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
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
