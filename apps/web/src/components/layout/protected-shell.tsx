'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TopBar } from '@/components/layout/top-bar';
import { useAuthStore } from '@/stores/auth.store';
import { getNavigationForRole } from '@/lib/navigation';
import { appendTenantContextToPath } from '@/lib/tenant-runtime';
import { hasTenantAdminPermission } from '@/lib/tenant-admin-permissions';
import { useTenantStore } from '@/stores/tenant.store';
import { useHydrated } from '@/hooks/use-hydrated';
import { UserRole } from '@zendocx/types';

interface ProtectedShellProps {
  title: string;
  children: React.ReactNode;
}

function getSidebarTitle(role: UserRole | undefined, tenantName: string | null | undefined): string {
  // Any user belonging to a tenant shows that tenant's name
  if (tenantName) {
    switch (role) {
      case UserRole.CBT_CENTER:
        return `${tenantName} CBT`;
      case UserRole.TENANT_ADMIN:
        return tenantName;
      case UserRole.INDIVIDUAL:
        return tenantName;
      default:
        return tenantName;
    }
  }

  // Platform-level users (no tenant)
  switch (role) {
    case UserRole.CBT_CENTER:
    case UserRole.CBT_STAFF:
      return 'ZenDocx CBT';
    case UserRole.SUPER_ADMIN:
      return 'ZenDocx Admin';
    case UserRole.INDIVIDUAL:
    default:
      return 'ZenDocx';
  }
}

export function ProtectedShell({ title, children }: ProtectedShellProps) {
  const user = useAuthStore((state) => state.user);
  const tenant = useTenantStore((state) => state.tenant);
  const hydrated = useHydrated();

  const role = user?.role;
  const tenantSlug = hydrated ? tenant?.slug ?? null : null;

  const { primary, secondary } = getNavigationForRole(role);
  const visiblePrimary =
    role === UserRole.TENANT_ADMIN
      ? primary.filter(({ href }) => {
          if (href === '/tenant/dashboard') return true;
          if (href === '/tenant/users') {
            return hasTenantAdminPermission(user, 'MANAGE_USERS');
          }
          if (href === '/wallet') {
            return hasTenantAdminPermission(user, 'MANAGE_WALLET');
          }
          if (href === '/tenant/cbt-management') {
            return hasTenantAdminPermission(user, 'MANAGE_CBT_CENTERS');
          }
          if (href === '/tenant/services') {
            return hasTenantAdminPermission(user, 'MANAGE_SERVICES');
          }
          if (href === '/tenant/providers') {
            return hasTenantAdminPermission(
              user,
              'MANAGE_SERVICE_CONNECTIONS',
            );
          }
          if (href === '/tenant/settings') {
            return (
              hasTenantAdminPermission(user, 'MANAGE_BUSINESS_SETTINGS') ||
              hasTenantAdminPermission(user, 'MANAGE_BUSINESS_ADMINS')
            );
          }
          return true;
        })
      : primary;
  const sectionLabel =
    role === UserRole.CBT_CENTER || role === UserRole.CBT_STAFF
      ? 'Fulfiller'
      : role === UserRole.SUPER_ADMIN
        ? 'Platform'
        : role === UserRole.TENANT_ADMIN
          ? 'Business'
          : 'Account';

  return (
    <div className="flex flex-col min-h-screen md:h-screen">
      <TopBar title={title} />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          brandLabel={getSidebarTitle(role, hydrated ? tenant?.name : null)}
          sectionLabel={sectionLabel}
          items={visiblePrimary.map(({ label, href }) => ({
            label,
            href: appendTenantContextToPath(href, tenantSlug),
          }))}
          secondaryItems={secondary.map(({ label, href }) => ({
            label,
            href: appendTenantContextToPath(href, tenantSlug),
          }))}
        />

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
