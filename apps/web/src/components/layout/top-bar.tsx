'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTenantStore } from '@/stores/tenant.store';
import { getDefaultRouteForRole, inferRoleFromPath } from '@/lib/auth-routes';
import { cn } from '@/lib/utils';
import { useNotificationsUnreadCount } from '@/hooks/use-notifications';

interface TopBarProps {
  title?: string;
  className?: string;
}

export function TopBar({ title, className }: TopBarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const tenant = useTenantStore((state) => state.tenant);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: unreadCount = 0 } = useNotificationsUnreadCount();
  const effectiveRole = user?.role ?? inferRoleFromPath(pathname);
  const homeHref = effectiveRole ? getDefaultRouteForRole(effectiveRole) : '/home';

  const resolvedTenant = mounted ? tenant : null;
  const brandName = resolvedTenant?.name ?? 'ZenDocx';
  const brandInitial = brandName.charAt(0).toUpperCase();

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'Z';
  const notificationsActive = pathname === '/notifications';
  const profileActive =
    pathname === '/profile' || pathname === '/security' || pathname === '/wallet';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 md:hidden flex items-center justify-between px-4 h-14',
        'border-b border-brand-line bg-white/95 backdrop-blur-md',
        className,
      )}
    >
      {/* Left: Logo or page title */}
      <div className="flex items-center gap-2">
        <Link href={homeHref} className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-navy">
            <span className="text-brand-accent font-black text-xs">{brandInitial}</span>
          </div>
          <div className="min-w-0">
            {title ? (
              <>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted">
                  Workspace
                </span>
                <span className="block truncate text-sm font-semibold text-brand-ink">{title}</span>
              </>
            ) : (
              <span className="text-lg font-black tracking-tight text-brand-navy">
                {brandName}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Right: Notifications + Avatar */}
      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
            notificationsActive
              ? 'bg-brand-navy/[0.08]'
              : 'hover:bg-brand-surface-soft',
          )}
        >
          <Bell size={20} className={cn(notificationsActive ? 'text-brand-navy' : 'text-slate-600')} />
          {unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 min-w-[1.1rem] rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Link>

        <Link
          href="/profile"
          className={cn(
            'rounded-full transition',
            profileActive && 'ring-2 ring-brand-navy/15 ring-offset-2 ring-offset-white',
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
        </Link>
      </div>
    </header>
  );
}
