'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TopBar } from '@/components/layout/top-bar';
import { useAuthStore } from '@/stores/auth.store';
import { getNavigationForRole } from '@/lib/navigation';
import { useTenantStore } from '@/stores/tenant.store';
import { UserRole } from '@zentry/types';

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
      return 'Zentry CBT';
    case UserRole.SUPER_ADMIN:
      return 'Zentry Admin';
    case UserRole.INDIVIDUAL:
    default:
      return 'Zentry';
  }
}

export function ProtectedShell({ title, children }: ProtectedShellProps) {
  const user = useAuthStore((state) => state.user);
  const tenant = useTenantStore((state) => state.tenant);
  // Defer tenant reads until after hydration — server has no localStorage,
  // so tenant is null server-side but populated on the client. Using the raw
  // value without this guard causes a React hydration mismatch warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const role = user?.role;

  const { primary, secondary } = getNavigationForRole(role);
  const sectionLabel =
    role === UserRole.CBT_CENTER || role === UserRole.CBT_STAFF
      ? 'Fulfiller'
      : role === UserRole.SUPER_ADMIN
        ? 'Oversight'
        : role === UserRole.TENANT_ADMIN
          ? 'Business menu'
        : 'Account';

  return (
    <div className="min-h-screen flex flex-col md:h-screen md:overflow-hidden">
      <TopBar title={title} />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          brandLabel={getSidebarTitle(role, mounted ? tenant?.name : null)}
          sectionLabel={sectionLabel}
          items={primary.map(({ label, href }) => ({ label, href }))}
          secondaryItems={secondary.map(({ label, href }) => ({ label, href }))}
        />

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0 md:h-full">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
