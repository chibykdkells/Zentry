'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { isAuthRoute } from '@/lib/auth-routes';
import { useAuthStore } from '@/stores/auth.store';

export function AuthBootstrap() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  useEffect(() => {
    if (!user || accessToken || isAuthRoute(pathname)) {
      return;
    }

    let isCancelled = false;
    const bootstrapUserId = user.id;

    const restoreSession = async () => {
      try {
        const response = await apiClient.post<{
          data: { accessToken: string };
        }>('/auth/refresh');

        if (!isCancelled) {
          const currentState = useAuthStore.getState();

          if (
            currentState.user?.id === bootstrapUserId &&
            !currentState.accessToken
          ) {
            setAccessToken(response.data.data.accessToken);
          }
        }
      } catch {
        if (!isCancelled) {
          const currentState = useAuthStore.getState();

          if (
            currentState.user?.id === bootstrapUserId &&
            !currentState.accessToken
          ) {
            clearAuth();
          }
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, clearAuth, pathname, setAccessToken, user]);

  return null;
}
