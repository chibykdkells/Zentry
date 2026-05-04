'use client';

import { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { ProtectedShell } from '@/components/layout/protected-shell';
import { EmptyState } from '@/components/shared/empty-state';
import { AccountPanel } from '@/components/shared/account-panel';
import { FilterChipGroup } from '@/components/shared/filter-chip-group';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsUnreadCount,
  type ApiNotification,
} from '@/hooks/use-notifications';
import {
  useDisablePushNotifications,
  useEnablePushNotifications,
  usePushConfig,
  usePushSubscriptionStatus,
} from '@/hooks/use-push-notifications';
import { cn } from '@/lib/utils';

function NotificationIcon() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0D1B3E] shadow-sm">
      <Bell size={18} />
    </div>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return 'unsupported';
    }

    return Notification.permission;
  });

  const { data, isLoading } = useNotifications({
    unreadOnly: filter === 'unread',
  });
  const { data: unreadCount = 0 } = useNotificationsUnreadCount();
  const { data: pushConfig } = usePushConfig();
  const { data: pushStatus } = usePushSubscriptionStatus();
  const enablePush = useEnablePushNotifications();
  const disablePush = useDisablePushNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const totalCount = data?.pagination?.total ?? 0;

  const visibleNotifications = useMemo(() => {
    const notifications: ApiNotification[] = data?.notifications ?? [];
    if (filter === 'read') return notifications.filter((n) => n.isRead);
    return notifications;
  }, [data?.notifications, filter]);

  async function enableBrowserAlerts() {
    if (typeof Notification === 'undefined') {
      setBrowserPermission('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
  }

  return (
    <ProtectedShell title="Notifications">
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:flex md:h-full md:flex-col md:overflow-hidden md:space-y-6 md:p-8">
        <PageHeader
          title="Notifications"
          description="Account, wallet, and order updates in real time."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {browserPermission === 'default' ? (
                <button
                  type="button"
                  onClick={() => { void enableBrowserAlerts(); }}
                  className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
                >
                  Enable browser alerts
                </button>
              ) : null}
              {pushConfig?.enabled ? (
                pushStatus?.isSubscribed ? (
                  <button
                    type="button"
                    onClick={() => { void disablePush.mutateAsync(); }}
                    disabled={disablePush.isPending}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Disable push
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { if (pushConfig.publicKey) { void enablePush.mutateAsync(pushConfig.publicKey); } }}
                    disabled={enablePush.isPending || !pushConfig.publicKey}
                    className="rounded-2xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy-strong disabled:opacity-50"
                  >
                    Enable push
                  </button>
                )
              ) : null}
              <FilterChipGroup
                value={filter}
                onChange={(value) => setFilter(value as 'all' | 'unread' | 'read')}
                options={[
                  { id: 'all', label: `All (${totalCount})` },
                  { id: 'unread', label: `Unread (${unreadCount})` },
                  { id: 'read', label: `Read (${Math.max(totalCount - unreadCount, 0)})` },
                ]}
              />
            </div>
          }
        />

        <AccountPanel
          title="Inbox"
          description="Real-time notifications from orders, wallet, and account events."
          actions={
            unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50"
              >
                Mark all as read
              </button>
            ) : null
          }
        >
          {pushConfig?.enabled ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {pushStatus?.isSubscribed
                ? 'Background push is active for this browser. You can receive updates even when ZenDocx is not open.'
                : 'Background push is available. Enable it to receive updates when ZenDocx is in the background.'}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Background push is not configured on this environment yet. Real-time in-app updates still work normally.
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              Loading notifications…
            </div>
          ) : visibleNotifications.length ? (
            <ScrollCardBody bodyClassName="space-y-3">
              {visibleNotifications.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    'flex flex-col gap-4 rounded-2xl border p-4 md:flex-row md:items-start md:justify-between',
                    item.isRead
                      ? 'border-slate-100 bg-slate-50/70'
                      : 'border-[#0D1B3E]/10 bg-[#0D1B3E]/[0.03]',
                  )}
                >
                  <div className="flex gap-3">
                    <NotificationIcon />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </h2>
                        {!item.isRead ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {item.message}
                      </p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        {item.type.replace(/_/g, ' ')} •{' '}
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {!item.isRead ? (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(item.id)}
                      disabled={markRead.isPending}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </article>
              ))}
            </ScrollCardBody>
          ) : (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="No notifications in this view"
                message="Switch filters or wait for new account, wallet, and order updates to appear here."
                icon={Bell}
              />
            </div>
          )}
        </AccountPanel>
      </div>
    </ProtectedShell>
  );
}
