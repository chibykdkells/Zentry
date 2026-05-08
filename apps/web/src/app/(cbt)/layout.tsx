'use client';

import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { RouteGuard } from '@/components/auth/route-guard';
import { useHydrated } from '@/hooks/use-hydrated';
import { cbtPrimaryNav, cbtStaffPrimaryNav, cbtSecondaryNav } from '@/lib/navigation';
import { useTenantStore } from '@/stores/tenant.store';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@zendocx/types';

export default function CbtLayout({ children }: { children: React.ReactNode }) {
  const tenant = useTenantStore((state) => state.tenant);
  const user = useAuthStore((state) => state.user);
  const hydrated = useHydrated();

  const brandLabel = hydrated
    ? tenant
      ? `${tenant.name} CBT`
      : 'ZenDocx CBT'
    : 'ZenDocx CBT';

  const primaryNav = user?.role === UserRole.CBT_STAFF ? cbtStaffPrimaryNav : cbtPrimaryNav;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="CBT Dashboard" />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          brandLabel={brandLabel}
          sectionLabel="Fulfiller"
          items={primaryNav}
          secondaryItems={cbtSecondaryNav}
        />
        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          <RouteGuard requiredRoles={[UserRole.CBT_CENTER, UserRole.CBT_STAFF]}>
            {children}
          </RouteGuard>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
