import type { TenantConfig } from '@/stores/tenant.store';
import { extractTenantSlugFromPlatformHostname } from '@/lib/platform-domain';

export const TENANT_THEME_STORAGE_KEY = 'zendocx-tenant-config';
export const TENANT_SLUG_STORAGE_KEY = 'zendocx-tenant-slug';
export const TENANT_SLUG_COOKIE = 'zendocx-tenant-slug';

export const tenantFontMap: Record<string, string> = {
  modern: '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", sans-serif',
  classic: 'Georgia, "Times New Roman", serif',
  clean: '"Trebuchet MS", "Segoe UI", sans-serif',
};

export function darkenHex(hex: string, amount = 0.12) {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) {
    return hex;
  }

  const toChannel = (index: number) => {
    const channel = Number.parseInt(sanitized.slice(index, index + 2), 16);
    const darkened = Math.max(0, Math.min(255, Math.round(channel * (1 - amount))));
    return darkened.toString(16).padStart(2, '0');
  };

  return `#${toChannel(0)}${toChannel(2)}${toChannel(4)}`;
}

export function resetTenantTheme(target?: HTMLElement) {
  if (typeof document === 'undefined' && !target) {
    return;
  }

  const root = target ?? document.documentElement;

  root.style.setProperty('--brand-navy', '#0D1B3E');
  root.style.setProperty('--brand-navy-strong', '#132754');
  root.style.setProperty('--brand-accent', '#F5A623');
  root.style.setProperty('--brand-ink', '#10203C');
  root.style.setProperty('--brand-button', '#0D1B3E');
  root.style.setProperty('--brand-button-strong', '#132754');
  root.style.setProperty('--font-sans', tenantFontMap.modern);
}

export function applyTenantTheme(tenant: TenantConfig | null, target?: HTMLElement) {
  if (typeof document === 'undefined' && !target) {
    return;
  }

  const root = target ?? document.documentElement;

  if (!tenant) {
    resetTenantTheme(root);
    return;
  }

  root.style.setProperty('--brand-navy', tenant.primaryColor);
  root.style.setProperty('--brand-navy-strong', darkenHex(tenant.primaryColor));
  root.style.setProperty('--brand-accent', tenant.accentColor);
  root.style.setProperty('--brand-ink', tenant.textColor);
  root.style.setProperty('--brand-button', tenant.buttonColor);
  root.style.setProperty('--brand-button-strong', darkenHex(tenant.buttonColor));
  root.style.setProperty(
    '--font-sans',
    tenantFontMap[tenant.fontStyle] ?? tenantFontMap.modern,
  );
}

export function getTenantThemeBootstrapScript() {
  return `
    (() => {
      try {
        const root = document.documentElement;

        const authRaw = window.localStorage.getItem('zendocx-auth');
        let userTenantId = undefined; // undefined = no auth; null = platform user; string = tenant user
        if (authRaw) {
          try {
            const auth = JSON.parse(authRaw);
            if (auth && auth.state && auth.state.user) {
              userTenantId = auth.state.user.tenantId; // null or string
            }
          } catch {}
        }

        // Platform-level users (tenantId === null) never get tenant theming.
        if (userTenantId === null) return;

        const themeRaw = window.localStorage.getItem('${TENANT_THEME_STORAGE_KEY}');
        if (!themeRaw) return;

        const tenant = JSON.parse(themeRaw);
        if (!tenant || typeof tenant !== 'object') return;

        // For authenticated tenant users the stored theme was set for their tenantId —
        // skip slug validation entirely so a stale dev-slug cookie never blocks it.
        if (userTenantId === undefined) {
          // Unauthenticated visitor: validate the stored theme matches the current slug.
          const slugRaw = window.localStorage.getItem('${TENANT_SLUG_STORAGE_KEY}');
          const searchParams = new URLSearchParams(window.location.search);
          const explicitSlug = (searchParams.get('tenant') || searchParams.get('slug') || '').trim().toLowerCase();
          const cookieMatch = document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith('${TENANT_SLUG_COOKIE}='));
          const cookieSlug = cookieMatch ? decodeURIComponent(cookieMatch.split('=').slice(1).join('=')).trim().toLowerCase() : '';
          const host = window.location.hostname.toLowerCase();
          let hostSlug = '';

          hostSlug = extractTenantSlugFromPlatformHostname(
            host,
            new Set(['www', 'api', 'platform', 'admin', 'app']),
          ) || '';

          const activeSlug = explicitSlug || cookieSlug || (slugRaw || '').trim().toLowerCase() || hostSlug;
          if (activeSlug && tenant.slug !== activeSlug) return;
        }

        const darkenHex = (hex, amount = 0.12) => {
          const sanitized = String(hex || '').replace('#', '');
          if (sanitized.length !== 6) return hex;
          const toChannel = (index) => {
            const channel = Number.parseInt(sanitized.slice(index, index + 2), 16);
            const darkened = Math.max(0, Math.min(255, Math.round(channel * (1 - amount))));
            return darkened.toString(16).padStart(2, '0');
          };
          return '#' + toChannel(0) + toChannel(2) + toChannel(4);
        };

        const fontMap = {
          modern: ${JSON.stringify(tenantFontMap.modern)},
          classic: ${JSON.stringify(tenantFontMap.classic)},
          clean: ${JSON.stringify(tenantFontMap.clean)},
        };

        root.style.setProperty('--brand-navy', tenant.primaryColor || '#0D1B3E');
        root.style.setProperty('--brand-navy-strong', darkenHex(tenant.primaryColor || '#0D1B3E'));
        root.style.setProperty('--brand-accent', tenant.accentColor || '#F5A623');
        root.style.setProperty('--brand-ink', tenant.textColor || '#10203C');
        root.style.setProperty('--brand-button', tenant.buttonColor || tenant.primaryColor || '#0D1B3E');
        root.style.setProperty('--brand-button-strong', darkenHex(tenant.buttonColor || tenant.primaryColor || '#0D1B3E'));
        root.style.setProperty('--font-sans', fontMap[tenant.fontStyle] || fontMap.modern);
      } catch {
        // Keep default brand values if tenant theme bootstrap fails.
      }
    })();
  `;
}
