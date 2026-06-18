'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { isAuthRoute } from '@/lib/auth-routes';
import { useAuthStore } from '@/stores/auth.store';
import {
  discoverCustomDomainTenantSlug,
  isCustomTenantDomain,
  persistActiveTenantSlug,
} from '@/lib/tenant-runtime';

export function AuthBootstrap() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  // On a custom domain (e.g. ecafe.app), the tenant slug cannot be extracted
  // from the hostname pattern. Discover it once via API and persist to cookie
  // so all subsequent API calls include the correct x-tenant-slug header.
  useEffect(() => {
    const hostname =
      typeof window !== 'undefined' ? window.location.hostname : '';
    if (!isCustomTenantDomain(hostname)) return;

    void discoverCustomDomainTenantSlug(hostname).then((slug) => {
      if (slug) persistActiveTenantSlug(slug);
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated || !user || accessToken || isAuthRoute(pathname)) {
      return;
    }

    let isCancelled = false;
    const bootstrapUserId = user.id;

    const restoreSession = async () => {
      try {
        const response = await apiClient.post<{
          data: { accessToken: string };
        }>('/auth/refresh');

        if (!isCancelled) {
          const currentState = useAuthStore.getState();

          if (
            currentState.user?.id === bootstrapUserId &&
            !currentState.accessToken
          ) {
            setAccessToken(response.data.data.accessToken);
          }
        }
      } catch {
        if (!isCancelled) {
          const currentState = useAuthStore.getState();

          if (
            currentState.user?.id === bootstrapUserId &&
            !currentState.accessToken
          ) {
            clearAuth();

            // Redirect to login — AuthBootstrap doesn't go through the
            // api-client interceptor, so we must redirect manually here.
            if (typeof window !== 'undefined') {
              const tenantSlug = resolveTenantSlugForRequest();
              const loginUrl = new URL(
                tenantSlug ? '/login' : '/access-required',
                window.location.origin,
              );
              loginUrl.searchParams.set('reason', 'session-expired');
              if (tenantSlug) {
                loginUrl.searchParams.set('tenant', tenantSlug);
              }
              const currentPath = `${window.location.pathname}${window.location.search}`;
              if (currentPath !== loginUrl.pathname) {
                loginUrl.searchParams.set('next', currentPath);
              }
              window.location.href = loginUrl.toString();
            }
          }
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, clearAuth, hasHydrated, pathname, setAccessToken, user]);

  return null;
}
