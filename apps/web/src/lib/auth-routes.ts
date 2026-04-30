import { UserRole } from '@zendocx/types';

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case UserRole.CBT_CENTER:
    case UserRole.CBT_STAFF:
      return '/dashboard';
    case UserRole.SUPER_ADMIN:
      return '/admin/dashboard';
    case UserRole.TENANT_ADMIN:
      return '/tenant/dashboard';
    case UserRole.INDIVIDUAL:
    default:
      return '/home';
  }
}

export function inferRoleFromPath(pathname: string): UserRole | null {
  if (pathname.startsWith('/admin')) {
    return UserRole.SUPER_ADMIN;
  }

  if (pathname.startsWith('/tenant')) {
    return UserRole.TENANT_ADMIN;
  }

  if (
    pathname === '/dashboard' ||
    pathname === '/job-pool' ||
    pathname === '/my-jobs' ||
    pathname === '/earnings' ||
    pathname === '/withdraw' ||
    pathname === '/staff'
  ) {
    return UserRole.CBT_CENTER;
  }

  if (
    pathname === '/home' ||
    pathname === '/services' ||
    pathname === '/orders' ||
    pathname === '/wallet' ||
    pathname === '/profile' ||
    pathname === '/notifications' ||
    pathname === '/security' ||
    pathname === '/disputes' ||
    pathname === '/support'
  ) {
    return UserRole.INDIVIDUAL;
  }

  return null;
}

export function getSafePostLoginRoute(
  role: UserRole,
  nextPath?: string | null,
): string {
  const defaultRoute = getDefaultRouteForRole(role);

  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return defaultRoute;
  }

  try {
    const url = new URL(nextPath, 'http://zendocx.local');
    const resolvedPath = `${url.pathname}${url.search}${url.hash}`;

    if (!isProtectedRoute(url.pathname) || !canAccessPath(role, url.pathname)) {
      return defaultRoute;
    }

    return resolvedPath;
  } catch {
    return defaultRoute;
  }
}

export function isAuthRoute(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/admin' ||
    pathname === '/platform' ||
    pathname === '/platform/login' ||
    pathname === '/verify-email' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/register')
  );
}

export function isProtectedRoute(pathname: string): boolean {
  if (pathname === '/admin' || pathname === '/platform') {
    return false;
  }

  const protectedPrefixes = [
    '/home',
    '/services',
    '/orders',
    '/wallet',
    '/profile',
    '/notifications',
    '/security',
    '/disputes',
    '/support',
    '/dashboard',
    '/job-pool',
    '/my-jobs',
    '/earnings',
    '/withdraw',
    '/tenant',
    '/admin',
  ];

  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const sharedProtectedRoutes = [
    '/wallet',
    '/profile',
    '/notifications',
    '/security',
    '/disputes',
    '/support',
  ];

  if (sharedProtectedRoutes.includes(pathname)) {
    return true;
  }

  if (
    pathname === '/home' ||
    pathname === '/services' ||
    pathname === '/orders'
  ) {
    return (
      role === UserRole.INDIVIDUAL ||
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.CBT_CENTER
    );
  }

  if (
    pathname === '/dashboard' ||
    pathname === '/job-pool' ||
    pathname === '/my-jobs' ||
    pathname === '/earnings' ||
    pathname === '/withdraw'
  ) {
    return role === UserRole.CBT_CENTER || role === UserRole.CBT_STAFF;
  }

  if (pathname === '/staff') {
    return role === UserRole.CBT_CENTER;
  }

  if (pathname.startsWith('/tenant')) {
    return role === UserRole.TENANT_ADMIN;
  }

  if (pathname.startsWith('/admin')) {
    return role === UserRole.SUPER_ADMIN;
  }

  return true;
}
