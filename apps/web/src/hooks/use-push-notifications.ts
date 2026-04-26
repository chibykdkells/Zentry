'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface PushConfigResponse {
  enabled: boolean;
  publicKey: string | null;
}

interface PushStatusResponse {
  enabled: boolean;
  isSubscribed: boolean;
  subscriptionCount: number;
}

const PUSH_CONFIG_QUERY_KEY = ['notifications', 'push-config'] as const;
const PUSH_STATUS_QUERY_KEY = ['notifications', 'push-status'] as const;

function base64UrlToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function getPushWorkerRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const existing = await navigator.serviceWorker.getRegistration('/push/');
  if (existing) {
    return existing;
  }

  return navigator.serviceWorker.register('/push-sw.js', {
    scope: '/push/',
  });
}

export function usePushConfig() {
  return useQuery<PushConfigResponse>({
    queryKey: PUSH_CONFIG_QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/push-config');
      return data.data as PushConfigResponse;
    },
    staleTime: 60_000,
  });
}

export function usePushSubscriptionStatus() {
  return useQuery<PushStatusResponse>({
    queryKey: PUSH_STATUS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/push-subscriptions/status');
      return data.data as PushStatusResponse;
    },
    staleTime: 30_000,
  });
}

export function useEnablePushNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publicKey: string) => {
      if (typeof window === 'undefined') {
        throw new Error('Push notifications are only available in the browser.');
      }

      if (!('Notification' in window)) {
        throw new Error('This browser does not support notifications.');
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted.');
      }

      const registration = await getPushWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        });
      }

      await apiClient.post('/notifications/push-subscriptions', subscription.toJSON());

      return subscription;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PUSH_STATUS_QUERY_KEY });
    },
  });
}

export function useDisablePushNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const registration = await getPushWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await apiClient.delete('/notifications/push-subscriptions', {
          data: { endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe();
      }

      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PUSH_STATUS_QUERY_KEY });
    },
  });
}
