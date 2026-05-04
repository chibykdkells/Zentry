'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthProfile } from '@/hooks/use-auth-profile';
import { useOrders } from '@/hooks/use-orders';
import { WalletCard } from '@/components/wallet/wallet-card';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';
import { formatDate } from '@/lib/format';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const serviceShortcuts = [
  { label: 'JAMB', emoji: '🎓', bg: 'bg-[#F6F1E7]' },
  { label: 'NIMC', emoji: '🪪', bg: 'bg-slate-100' },
  { label: 'NECO', emoji: '📝', bg: 'bg-amber-50' },
  { label: 'VTU', emoji: '⚡', bg: 'bg-sky-50' },
];

const statusStyles: Record<string, { cls: string; label: string }> = {
  PENDING:     { cls: 'bg-amber-100 text-amber-700',   label: 'Pending' },
  ASSIGNED:    { cls: 'bg-blue-100 text-blue-700',     label: 'Assigned' },
  IN_PROGRESS: { cls: 'bg-cyan-100 text-cyan-700',     label: 'In Progress' },
  COMPLETED:   { cls: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  DISPUTED:    { cls: 'bg-rose-100 text-rose-700',     label: 'Disputed' },
  CANCELLED:   { cls: 'bg-slate-100 text-slate-500',   label: 'Cancelled' },
};

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { profile, loading } = useAuthProfile();
  const { orders, loading: ordersLoading } = useOrders();
  const tenantSlug =
    typeof window !== 'undefined' ? resolveTenantSlugForRequest() : null;

  const wallet = profile?.wallet ?? { availableBalance: '0', escrowBalance: '0' };
  const firstName = profile?.firstName ?? user?.firstName ?? 'Welcome';
  const recentOrders = orders.slice(0, 3);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-5 pb-28 md:max-w-2xl md:px-6 md:py-8">

      {/* Greeting */}
      <div className="pt-1">
        <p className="text-sm text-brand-muted">{getGreeting()}</p>
        <h1 className="mt-0.5 text-[1.65rem] font-bold leading-tight text-brand-ink">
          {loading ? <span className="inline-block h-8 w-36 animate-pulse rounded-lg bg-slate-200" /> : `${firstName} 👋`}
        </h1>
      </div>

      {/* Balance card */}
      {loading ? (
        <SkeletonBlock className="h-44 rounded-3xl" />
      ) : (
        <WalletCard
          availableBalance={wallet.availableBalance}
          escrowBalance={wallet.escrowBalance}
          onFundClick={() =>
            window.location.assign(appendTenantContextToPath('/wallet', tenantSlug))
          }
          actionLabel="Fund Account"
          secondaryAction={{
            label: 'History',
            onClick: () =>
              window.location.assign(appendTenantContextToPath('/wallet', tenantSlug)),
          }}
        />
      )}

      {/* Services */}
      <section>
        <h2 className="mb-3 text-base font-bold text-brand-ink">Services</h2>
        <div className="grid grid-cols-4 gap-2.5">
          {serviceShortcuts.map(({ label, emoji, bg }) => (
            <Link
              key={label}
              href={appendTenantContextToPath('/services', tenantSlug)}
              className="flex flex-col items-center gap-2.5 rounded-2xl border border-brand-line bg-brand-surface py-4 transition hover:shadow-sm active:scale-95"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${bg}`}>
                {emoji}
              </span>
              <span className="text-xs font-semibold text-brand-ink">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Orders */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-ink">Recent Orders</h2>
          <Link
            href={appendTenantContextToPath('/orders', tenantSlug)}
            className="text-xs font-semibold text-brand-accent hover:underline"
          >
            See all
          </Link>
        </div>

        {ordersLoading ? (
          <div className="space-y-2.5">
            <SkeletonBlock className="h-[4.5rem] rounded-2xl" />
            <SkeletonBlock className="h-[4.5rem] rounded-2xl" />
            <SkeletonBlock className="h-[4.5rem] rounded-2xl" />
          </div>
        ) : recentOrders.length > 0 ? (
          <div className="space-y-2.5">
            {recentOrders.map((order) => {
              const s = statusStyles[order.status] ?? { cls: 'bg-slate-100 text-slate-500', label: order.status };
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-2xl border border-brand-line bg-brand-surface px-4 py-3.5 shadow-sm"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-semibold text-brand-ink">
                      {order.service.name}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      {order.orderNumber} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-center">
            <p className="text-sm text-brand-muted">
              No orders yet — start by browsing available services.
            </p>
            <Link
              href={appendTenantContextToPath('/services', tenantSlug)}
              className="mt-3 inline-flex rounded-xl bg-brand-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-navy-strong"
            >
              Browse services
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
