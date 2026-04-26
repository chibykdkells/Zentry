'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import { disconnectSocket } from '@/lib/socket-client';
import { useState } from 'react';
import { getNavigationForRole } from '@/lib/navigation';
import { inferRoleFromPath } from '@/lib/auth-routes';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const effectiveRole = user?.role ?? inferRoleFromPath(pathname);
  const { primary, secondary } = getNavigationForRole(effectiveRole);
  const items = [...primary.slice(4), ...secondary];

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Clear local auth state even if the server session is already gone.
    } finally {
      disconnectSocket();
      clearAuth();
      onClose();
      setLoggingOut(false);
      window.location.href = '/login';
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-[1px] md:hidden"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl bg-white md:hidden pb-[env(safe-area-inset-bottom)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* User info */}
            <div className="border-b border-slate-100 px-6 pb-4">
              <p className="font-semibold text-slate-800">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>

            {/* Nav items */}
            <div className="py-2">
              {items.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-4 px-6 py-4 transition-colors',
                    pathname === href || pathname.startsWith(`${href}/`)
                      ? 'bg-brand-navy/[0.04]'
                      : 'hover:bg-slate-50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      pathname === href || pathname.startsWith(`${href}/`)
                        ? 'bg-brand-navy/[0.08]'
                        : 'bg-slate-100',
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        pathname === href || pathname.startsWith(`${href}/`)
                          ? 'text-brand-navy'
                          : 'text-slate-600',
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'font-medium',
                      pathname === href || pathname.startsWith(`${href}/`)
                        ? 'text-brand-navy'
                        : 'text-slate-700',
                    )}
                  >
                    {label}
                  </span>
                  <span className="ml-auto text-slate-300">›</span>
                </Link>
              ))}

              {/* Logout */}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className={cn(
                  'flex items-center gap-4 px-6 py-4 w-full hover:bg-red-50 transition-colors',
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                  <LogOut size={18} className="text-red-500" />
                </div>
                <span className="font-medium text-red-500">
                  {loggingOut ? 'Signing out...' : 'Logout'}
                </span>
              </button>
            </div>

            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
