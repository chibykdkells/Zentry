'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  orderId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: ApiNotification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const NOTIFICATIONS_QUERY_KEY = 'notifications';
export const NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY = 'notifications-unread-count';

export function useNotifications(params: GetNotificationsParams = {}) {
  const user = useAuthStore((state) => state.user);

  return useQuery<NotificationsResponse>({
    queryKey: [NOTIFICATIONS_QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications', { params });
      return data.data as NotificationsResponse;
    },
    staleTime: 30_000,
    enabled: Boolean(user),
  });
}

export function useNotificationsUnreadCount() {
  const user = useAuthStore((state) => state.user);

  return useQuery<number>({
    queryKey: [NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/unread-count');
      return (data.data as { count: number }).count;
    },
    staleTime: 30_000,
    enabled: Boolean(user),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY] });
    },
  });
}
