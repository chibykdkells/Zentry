'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '@zentry/types';
import {
  AppNotification,
  buildNotificationsForRole,
} from '@/lib/notification-content';

interface NotificationState {
  notifications: AppNotification[];
  seededForRole: UserRole | null;
  unreadCount: number;
  seedNotifications: (role?: UserRole) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

function getUnreadCount(notifications: AppNotification[]): number {
  return notifications.filter((item) => !item.read).length;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      seededForRole: null,
      unreadCount: 0,

      seedNotifications: (role) => {
        if (!role || get().seededForRole === role) {
          return;
        }

        const notifications = buildNotificationsForRole(role);
        set({
          notifications,
          seededForRole: role,
          unreadCount: getUnreadCount(notifications),
        });
      },

      markRead: (id) => {
        const notifications = get().notifications.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        );

        set({
          notifications,
          unreadCount: getUnreadCount(notifications),
        });
      },

      markAllRead: () => {
        const notifications = get().notifications.map((item) => ({
          ...item,
          read: true,
        }));

        set({
          notifications,
          unreadCount: 0,
        });
      },

      clearNotifications: () =>
        set({
          notifications: [],
          seededForRole: null,
          unreadCount: 0,
        }),
    }),
    {
      name: 'zentry-notifications',
      partialize: (state) => ({
        notifications: state.notifications,
        seededForRole: state.seededForRole,
        unreadCount: state.unreadCount,
      }),
    },
  ),
);
