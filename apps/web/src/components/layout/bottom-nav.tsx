'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useState } from 'react';
import { getNavigationForRole } from '@/lib/navigation';
import { inferRoleFromPath } from '@/lib/auth-routes';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';
import { MoreSheet } from './more-sheet';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const effectiveRole = user?.role ?? inferRoleFromPath(pathname);
  const tenantSlug =
    typeof window !== 'undefined' ? resolveTenantSlugForRequest() : null;

  const { primary } = getNavigationForRole(effectiveRole);
  const navItems = primary.slice(0, 4).map((item) => ({
    ...item,
    href: appendTenantContextToPath(item.href, tenantSlug),
  }));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const cleanHref = item.href.split('?')[0] ?? item.href;
            const isActive =
              pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-0',
                  isActive
                    ? 'text-amber-500'
                    : 'text-slate-400 hover:text-slate-600',
                )}
              >
                <item.icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span className="text-[10px] font-medium leading-none truncate">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 w-1 h-1 rounded-full bg-amber-500" />
                )}
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-600 transition-all duration-200"
          >
            <MoreHorizontal size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
