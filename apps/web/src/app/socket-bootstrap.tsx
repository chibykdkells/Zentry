'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { connectSocket, disconnectSocket } from '@/lib/socket-client';
import {
  NOTIFICATIONS_QUERY_KEY,
  NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
} from '@/hooks/use-notifications';

function showBrowserNotification(title: string, body?: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return;
  }

  if (Notification.permission !== 'granted' || document.visibilityState === 'visible') {
    return;
  }

  void new Notification(title, {
    body,
    icon: '/icons/icon-192.png',
  });
}

export function SocketBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return;
    }

    let socket;

    try {
      socket = connectSocket(accessToken);
    } catch {
      disconnectSocket();
      return;
    }

    socket.on('notification:new', (payload: { title: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY] });
      toast(payload.title ?? 'New notification', { icon: '🔔' });
      showBrowserNotification(payload.title ?? 'New notification', payload.message);
    });

    socket.on('wallet:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    });

    socket.on('job:new', () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'cbt', 'job-pool'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'cbt', 'dashboard'] });
      toast('New job available in your pool', { icon: '💼' });
      showBrowserNotification('New job available', 'A fresh job just entered your CBT pool.');
    });

    socket.on('job:claimed', () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'cbt', 'job-pool'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'cbt', 'my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'cbt', 'dashboard'] });
    });

    socket.on('order:completed', (payload: { serviceName?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      const title = payload.serviceName
        ? `${payload.serviceName} is ready`
        : 'Order completed';
      toast(title, { icon: '✅' });
      showBrowserNotification(title, 'Open your dashboard to review the latest update.');
    });

    return () => {
      socket.off('notification:new');
      socket.off('wallet:updated');
      socket.off('job:new');
      socket.off('job:claimed');
      socket.off('order:completed');
    };
  }, [accessToken, queryClient]);

  return null;
}
