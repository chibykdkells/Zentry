'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const ADMIN_CACHE_RESET_KEY = 'zendocx-admin-cache-reset-v1';

function isProtectedOversightRoute(pathname: string) {
  return pathname.startsWith('/admin') || pathname.startsWith('/platform');
}

export function AdminCacheGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      process.env.NODE_ENV !== 'production' ||
      !isProtectedOversightRoute(pathname) ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    const resetKey = `${ADMIN_CACHE_RESET_KEY}:${pathname}`;
    const hasResetThisTab = window.sessionStorage.getItem(resetKey) === 'done';

    if (hasResetThisTab) {
      return;
    }

    void Promise.all([
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister()),
          ),
        ),
      'caches' in window
        ? window.caches
            .keys()
            .then((cacheNames) =>
              Promise.all(
                cacheNames.map((cacheName) => window.caches.delete(cacheName)),
              ),
            )
        : Promise.resolve([]),
    ])
      .then(() => {
        window.sessionStorage.setItem(resetKey, 'done');
        window.location.reload();
      })
      .catch(() => undefined);
  }, [pathname]);

  return null;
}
