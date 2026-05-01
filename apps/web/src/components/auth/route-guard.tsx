'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { getDefaultRouteForRole } from '@/lib/auth-routes';
import {
  appendTenantContextToPath,
  resolveTenantSlugForRequest,
} from '@/lib/tenant-runtime';
import { UserRole } from '@zendocx/types';

interface RouteGuardProps {
  children: React.ReactNode;
  /** If provided, any authenticated user whose role is NOT in this list is
   *  redirected to their own default home route. */
  requiredRoles?: UserRole[];
}

/**
 * Drop this around `{children}` in any protected layout.
 *
 * Behaviour:
 *  - While AuthBootstrap is restoring the session (user in store, no token yet):
 *      renders a centred spinner so the page content doesn't flash a 401 error.
 *  - Once bootstrap finishes with no session (user cleared): redirects to /login.
 *  - If the authenticated user's role is not in requiredRoles: redirects to their
 *      correct home (role-based routing).
 *  - Otherwise: renders children normally.
 */
export function RouteGuard({ children, requiredRoles }: RouteGuardProps) {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const router = useRouter();
  const pathname = usePathname();

  // The guard needs to wait for persisted auth metadata to hydrate before deciding
  // whether a tenant user is truly unauthenticated. Otherwise a hard page load can
  // briefly look like a signed-out state and bounce the user back to login.
  const isBootstrapping = !hasHydrated || (!!user && !accessToken);
  const isAuthenticated = !!user && !!accessToken;
  const tenantSlug =
    typeof window !== 'undefined' ? resolveTenantSlugForRequest() : null;
  const hasWrongRole =
    isAuthenticated &&
    !!requiredRoles &&
    !!user &&
    !requiredRoles.includes(user.role);

  useEffect(() => {
    if (isBootstrapping) return;

    if (!isAuthenticated) {
      if (pathname.startsWith('/admin')) {
        router.replace('/platform');
        return;
      }

      if (tenantSlug) {
        router.replace(appendTenantContextToPath('/login', tenantSlug));
        return;
      }

      router.replace('/access-required?reason=tenant-link');
      return;
    }

    if (hasWrongRole && user) {
      router.replace(
        appendTenantContextToPath(getDefaultRouteForRole(user.role), tenantSlug),
      );
    }
  }, [
    hasWrongRole,
    isAuthenticated,
    isBootstrapping,
    pathname,
    router,
    tenantSlug,
    user,
  ]);

  if (isBootstrapping || !isAuthenticated || hasWrongRole) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-line border-t-brand-navy" />
          <p className="text-sm text-brand-muted">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
