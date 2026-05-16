'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useTenantStore, type TenantConfig } from '@/stores/tenant.store';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import {
  discoverCustomDomainTenantSlug,
  persistActiveTenantSlug,
  resolveTenantSlugForRequest,
} from '@/lib/tenant-runtime';
import { applyTenantTheme, resetTenantTheme } from '@/lib/tenant-theme';

export function TenantBootstrap() {
  const tenant = useTenantStore((state) => state.tenant);
  const setTenant = useTenantStore((state) => state.setTenant);
  const clearTenant = useTenantStore((state) => state.clearTenant);
  // user is persisted in localStorage — available synchronously on first render
  const user = useAuthStore((state) => state.user);

  // Synchronously reset the brand ONLY for platform-level users (tenantId === null).
  // Reading from the store directly (not React state) lets us act before the first
  // paint without waiting for an async effect.
  //
  // We must NOT reset unconditionally here: the tenant store now initialises from
  // localStorage so its value already matches what the beforeInteractive bootstrap
  // script applied to the DOM. Resetting would cause a visible flash for tenant users.
  useLayoutEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser !== null && currentUser.tenantId === null) {
      clearTenant();
      resetTenantTheme();
    }
  }, [clearTenant]);

  // Re-apply the tenant theme whenever the in-memory tenant config changes.
  // On mount the tenant store is already populated from localStorage, so this
  // is effectively a no-op for returning users — no visible flash.
  useLayoutEffect(() => {
    applyTenantTheme(tenant);
  }, [tenant]);

  useEffect(() => {
    // Authenticated platform-level users (tenantId === null, e.g. SUPER_ADMIN
    // registered directly on the platform) never have a tenant context.
    // Short-circuit so a stale slug in localStorage/cookie cannot load an
    // unrelated tenant's branding.
    // Unauthenticated users (user === null) still reach the fetch below so that
    // auth pages can display the correct tenant brand.
    if (user !== null && user.tenantId === null) {
      clearTenant();
      return;
    }

    const load = async () => {
      try {
        const params: Record<string, string> = {};

        if (user?.tenantId) {
          // Authenticated tenant users: ALWAYS resolve by tenantId.
          // Slug-based resolution is unreliable for authenticated users —
          // on localhost the slug fallback defaults to a dev slug that may not
          // match the real tenant, causing clearTenant() to erase the brand.
          params.tenantId = user.tenantId;
        } else {
          // Unauthenticated users or platform-level users (no tenantId):
          // resolve by subdomain / URL slug so auth pages show the right brand.
          const tenantSlug = resolveTenantSlugForRequest();
          if (tenantSlug) {
            params.slug = tenantSlug;
          } else if (typeof window !== 'undefined') {
            const discoveredSlug = await discoverCustomDomainTenantSlug(
              window.location.hostname,
            );
            if (discoveredSlug) {
              persistActiveTenantSlug(discoveredSlug);
              params.slug = discoveredSlug;
            }
          }
        }

        const res = await apiClient.get<{ data: TenantConfig | null }>(
          '/tenants/config',
          { params: Object.keys(params).length ? params : undefined },
        );
        const resolved = res.data.data;
        if (!resolved) {
          clearTenant();
          return;
        }

        setTenant(resolved);
      } catch {
        // Tenant not resolved (e.g. platform-level or localhost) — use defaults
        clearTenant();
        resetTenantTheme();
      }
    };

    void load();
  }, [user, clearTenant, setTenant]);

  return null;
}
