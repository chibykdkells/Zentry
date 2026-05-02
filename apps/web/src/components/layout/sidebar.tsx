'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, LucideIcon } from 'lucide-react';
import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { getDefaultRouteForRole } from '@/lib/auth-routes';
import { disconnectSocket } from '@/lib/socket-client';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';
import { cn } from '@/lib/utils';

interface SidebarItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface SidebarProps {
  brandLabel: string;
  sectionLabel: string;
  items: SidebarItem[];
  secondaryItems?: SidebarItem[];
}

export function Sidebar({
  brandLabel,
  sectionLabel,
  items,
  secondaryItems = [],
}: SidebarProps) {
  const pathname = usePathname();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);
  const [loggingOut, setLoggingOut] = useState(false);
  const tenantSlug =
    typeof window !== 'undefined' ? resolveTenantSlugForRequest() : null;
  const homeHref = user
    ? appendTenantContextToPath(getDefaultRouteForRole(user.role), tenantSlug)
    : appendTenantContextToPath('/home', tenantSlug);

  const isActivePath = (href: string) => {
    const cleanHref = href.split('?')[0] ?? href;
    return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
  };

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Clear local auth state even if the server session is already gone.
    } finally {
      disconnectSocket();
      clearAuth();
      setLoggingOut(false);
      window.location.assign(appendTenantContextToPath('/login', tenantSlug));
    }
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-brand-navy md:flex md:h-full md:min-h-0 md:overflow-y-auto">
      <Link
        href={homeHref}
        className="flex items-center gap-3 border-b border-white/10 px-6 py-6 transition hover:bg-white/5"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-accent">
          <span className="text-sm font-black text-white">Z</span>
        </div>
        <div>
          <span className="block text-xl font-black tracking-tight text-white">
            {brandLabel}
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            {sectionLabel}
          </span>
        </div>
      </Link>

      <nav className="flex-1 px-4 py-6">
        <div className="mb-3 px-2 text-xs uppercase tracking-wider text-slate-400">
          {sectionLabel}
        </div>
        <div className="space-y-0.5">
          {items.map((item) => {
            const active = isActivePath(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/8 hover:text-white',
                )}
              >
                {Icon ? (
                  <Icon
                    size={16}
                    className={cn(
                      'shrink-0 transition-colors',
                      active ? 'text-[#F5A623]' : 'text-slate-500 group-hover:text-slate-300',
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0 transition',
                      active ? 'bg-[#F5A623]' : 'bg-white/20 group-hover:bg-white/40',
                    )}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </div>

        {secondaryItems.length ? (
          <>
            <div className="mb-2 mt-7 px-2 text-xs uppercase tracking-wider text-slate-500">
              Account
            </div>
            <div className="space-y-0.5">
              {secondaryItems.map((item) => {
                const active = isActivePath(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    {Icon ? (
                      <Icon
                        size={16}
                        className={cn(
                          'shrink-0 transition-colors',
                          active ? 'text-[#F5A623]' : 'text-slate-500 group-hover:text-slate-300',
                        )}
                      />
                    ) : (
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0 transition',
                          active ? 'bg-[#F5A623]' : 'bg-white/20 group-hover:bg-white/40',
                        )}
                      />
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        {user ? (
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm font-semibold text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="mt-1 text-xs text-slate-400">{user.email}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
            'text-slate-300 hover:bg-white/10 hover:text-white',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <LogOut size={16} />
          {loggingOut ? 'Signing out...' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}
