'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TopBar } from '@/components/layout/top-bar';
import { RouteGuard } from '@/components/auth/route-guard';
import { individualPrimaryNav, individualSecondaryNav } from '@/lib/navigation';
import { useTenantStore } from '@/stores/tenant.store';
import { UserRole } from '@zendocx/types';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = useTenantStore((state) => state.tenant);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen flex flex-col md:h-screen md:overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          brandLabel={mounted ? (tenant?.name ?? 'ZenDocx') : 'ZenDocx'}
          sectionLabel="Menu"
          items={individualPrimaryNav}
          secondaryItems={individualSecondaryNav}
        />
        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0 md:h-full">
          <RouteGuard requiredRoles={[UserRole.INDIVIDUAL]}>
            {children}
          </RouteGuard>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
