'use client';

import { useEffect, useState } from 'react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { RouteGuard } from '@/components/auth/route-guard';
import { tenantPrimaryNav, tenantSecondaryNav } from '@/lib/navigation';
import { useTenantStore } from '@/stores/tenant.store';
import { UserRole } from '@zendocx/types';

export default function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = useTenantStore((state) => state.tenant);
  // Defer tenant name until after hydration to avoid server/client mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen flex flex-col md:h-screen md:overflow-hidden">
      <TopBar title="Business Workspace" />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          brandLabel={mounted ? (tenant?.name ?? 'Business Workspace') : 'Business Workspace'}
          sectionLabel="Business menu"
          items={tenantPrimaryNav}
          secondaryItems={tenantSecondaryNav}
        />
        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0 md:h-full">
          <RouteGuard requiredRoles={[UserRole.TENANT_ADMIN]}>
            {children}
          </RouteGuard>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
