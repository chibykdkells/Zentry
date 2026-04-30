'use client';

import { create } from 'zustand';
import { TENANT_THEME_STORAGE_KEY } from '@/lib/tenant-theme';

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  buttonColor: string;
  fontStyle: string;
  customDomain: string | null;
}

interface TenantStore {
  tenant: TenantConfig | null;
  setTenant: (tenant: TenantConfig) => void;
  clearTenant: () => void;
}

function persistTenant(tenant: TenantConfig | null) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (tenant) {
      window.localStorage.setItem(TENANT_THEME_STORAGE_KEY, JSON.stringify(tenant));
    } else {
      window.localStorage.removeItem(TENANT_THEME_STORAGE_KEY);
    }
  } catch {
    // Ignore constrained storage environments.
  }
}

/**
 * Read the cached tenant from localStorage on module initialisation.
 *
 * Skips loading if the persisted auth state shows this is a platform-level
 * user (tenantId === null), preventing a previous tenant's branding from
 * leaking into a new session for a different user type.
 *
 * Returns null on the server (no localStorage) — client components that
 * render brand-sensitive text already use the `mounted` pattern so this
 * never causes a hydration mismatch.
 */
function getInitialTenant(): TenantConfig | null {
  if (typeof window === 'undefined') return null;

  try {
    // If the persisted auth shows a platform user (no tenantId), don't load
    // a stale tenant from a previous session.
    const authRaw = window.localStorage.getItem('zendocx-auth');
    if (authRaw) {
      const parsed = JSON.parse(authRaw) as {
        state?: { user?: { tenantId?: string | null } };
      };
      if (parsed?.state?.user?.tenantId === null) return null;
    }

    const raw = window.localStorage.getItem(TENANT_THEME_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TenantConfig) : null;
  } catch {
    return null;
  }
}

export const useTenantStore = create<TenantStore>()((set) => ({
  // Initialize synchronously from localStorage so the in-memory store matches
  // what the beforeInteractive bootstrap script already applied to the DOM.
  // This prevents a flash from the bootstrap-applied tenant theme → default
  // brand → re-fetched tenant theme.
  tenant: getInitialTenant(),

  setTenant: (tenant) => {
    persistTenant(tenant);
    set({ tenant });
  },

  clearTenant: () => {
    persistTenant(null);
    set({ tenant: null });
  },
}));
