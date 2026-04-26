import { Bell, CreditCard, ShieldCheck, Wallet } from 'lucide-react';
import { UserRole } from '@zentry/types';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: 'account' | 'wallet' | 'orders';
  createdAt: string;
  read: boolean;
  icon: 'bell' | 'wallet' | 'shield' | 'card';
}

export const notificationIcons = {
  bell: Bell,
  wallet: Wallet,
  shield: ShieldCheck,
  card: CreditCard,
} as const;

export function buildNotificationsForRole(role?: UserRole): AppNotification[] {
  const baseNotifications: AppNotification[] = [
    {
      id: 'account-ready',
      title: 'Account access is active',
      message:
        'Your refreshed authentication flow is working and your account is ready for dashboard activity.',
      category: 'account',
      createdAt: 'Today',
      read: false,
      icon: 'shield',
    },
    {
      id: 'wallet-ready',
      title: 'Wallet workspace is available',
      message:
        'You can now review balances and wallet readiness from the refined wallet page.',
      category: 'wallet',
      createdAt: 'Today',
      read: false,
      icon: 'wallet',
    },
    {
      id: 'catalog-live',
      title: 'Service catalog workspace is live',
      message:
        'Browse available service categories from the new services page while deeper flows are added in later phases.',
      category: 'orders',
      createdAt: 'Today',
      read: true,
      icon: 'bell',
    },
  ];

  if (role === UserRole.CBT_CENTER) {
    return [
      {
        id: 'cbt-dashboard',
        title: 'CBT dashboard is ready',
        message:
          'Your dashboard, job pool, and earnings routes are now stable destinations.',
        category: 'orders',
        createdAt: 'Today',
        read: false,
        icon: 'bell',
      },
      ...baseNotifications,
    ];
  }

  if (role === UserRole.SUPER_ADMIN) {
    return [
      {
        id: 'admin-shell',
        title: 'Admin shell is available',
        message:
          'Admin dashboard, finance, orders, and users routes are ready for later data integration.',
        category: 'account',
        createdAt: 'Today',
        read: false,
        icon: 'shield',
      },
      ...baseNotifications,
    ];
  }

  return baseNotifications;
}
