import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { RouteGuard } from '@/components/auth/route-guard';
import { adminPrimaryNav, adminSecondaryNav } from '@/lib/navigation';
import { UserRole } from '@zendocx/types';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:h-screen md:overflow-hidden">
      <TopBar title="Admin Dashboard" />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          brandLabel="ZenDocx Admin"
          sectionLabel="Oversight"
          items={adminPrimaryNav}
          secondaryItems={adminSecondaryNav}
        />
        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0 md:h-full">
          <RouteGuard requiredRoles={[UserRole.SUPER_ADMIN]}>
            {children}
          </RouteGuard>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
