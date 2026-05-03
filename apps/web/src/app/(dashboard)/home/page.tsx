'use client';

import { type ElementType, useState } from 'react';
import Link from 'next/link';
import { Activity, Briefcase, LayoutGrid, Wallet } from 'lucide-react';
import { WalletCard } from '@/components/wallet/wallet-card';
import { DetailModal } from '@/components/shared/detail-modal';
import { useAuthProfile } from '@/hooks/use-auth-profile';
import { useOrders } from '@/hooks/use-orders';
import { useWallet } from '@/hooks/use-wallet';
import { formatDate, formatNaira } from '@/lib/format';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHero } from '@/components/shared/page-hero';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';
import { TransactionType } from '@zendocx/types';

export default function HomePage() {
  const { profile, loading, error } = useAuthProfile();
  const { metrics, orders } = useOrders();
  const { wallet: walletOverview } = useWallet();
  const tenantSlug =
    typeof window !== 'undefined' ? resolveTenantSlugForRequest() : null;

  const [openTile, setOpenTile] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:space-y-6 md:p-8">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-56 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-3xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile || error) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white">
          <EmptyState
            title="Dashboard unavailable"
            message={error ?? 'We could not load your dashboard right now.'}
          />
        </div>
      </div>
    );
  }

  const wallet = profile.wallet ?? {
    availableBalance: '0',
    escrowBalance: '0',
    totalEarned: '0',
    totalWithdrawn: '0',
  };

  const walletTransactions = walletOverview?.recentTransactions ?? [];

  const activityItems = [
    ...orders.slice(0, 3).map((order) => ({
      id: `order-${order.id}`,
      title: order.service.name,
      meta: `${order.orderNumber} • ${order.status}`,
      time: order.createdAt,
      amount: null as string | null,
    })),
    ...walletTransactions.slice(0, 3).map((transaction) => ({
      id: `txn-${transaction.id}`,
      title: transaction.description,
      meta: transaction.type.replaceAll('_', ' '),
      time: transaction.createdAt,
      amount: formatNaira(transaction.amount),
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:space-y-6 md:p-8">
      <PageHero
        eyebrow="Welcome back"
        title={`${profile.firstName}, here's your workspace.`}
        description="Manage requests, wallet activity, and core services from one clean dashboard."
      />

      <WalletCard
        availableBalance={wallet.availableBalance}
        escrowBalance={wallet.escrowBalance}
        onFundClick={() =>
          window.location.assign(appendTenantContextToPath('/wallet', tenantSlug))
        }
        actionLabel="Open wallet"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <DashTile
          icon={Briefcase}
          label="Orders"
          value={`${metrics?.active ?? 0} active`}
          color="bg-[#0D1B3E] text-white"
          onClick={() => setOpenTile('orders')}
        />
        <DashTile
          icon={LayoutGrid}
          label="Services"
          value="Browse"
          color="bg-amber-500 text-white"
          onClick={() => setOpenTile('services')}
        />
        <DashTile
          icon={Wallet}
          label="Wallet"
          value={formatNaira(wallet.availableBalance)}
          color="bg-emerald-600 text-white"
          onClick={() => setOpenTile('wallet')}
        />
        <DashTile
          icon={Activity}
          label="Activity"
          value={`${activityItems.length} recent`}
          color="bg-cyan-600 text-white"
          onClick={() => setOpenTile('activity')}
        />
      </div>

      {/* Orders modal */}
      <DetailModal
        open={openTile === 'orders'}
        onClose={() => setOpenTile(null)}
        title="My orders"
      >
        <dl className="grid grid-cols-2 gap-3">
          {[
            { label: 'Active', value: String(metrics?.active ?? 0) },
            { label: 'Completed', value: String(metrics?.completed ?? 0) },
            { label: 'On hold (escrow)', value: formatNaira(wallet.escrowBalance) },
            { label: 'Wallet balance', value: formatNaira(wallet.availableBalance) },
          ].map((row) => (
            <div key={row.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{row.label}</dt>
              <dd className="mt-1 text-lg font-bold text-slate-900">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <Link
            href={appendTenantContextToPath('/orders', tenantSlug)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            View all orders
          </Link>
        </div>
      </DetailModal>

      {/* Services modal */}
      <DetailModal
        open={openTile === 'services'}
        onClose={() => setOpenTile(null)}
        title="Services"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'JAMB services', note: 'Admissions, result printing, and profile recovery' },
            { label: 'NIN support', note: 'Validation, updates, and print support' },
            { label: 'Airtime & data', note: 'Everyday top-ups and digital bill support' },
            { label: 'Order tracking', note: 'Follow each request from start to finish' },
          ].map((service) => (
            <Link
              key={service.label}
              href={appendTenantContextToPath('/services', tenantSlug)}
              className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
            >
              <p className="font-semibold text-slate-800">{service.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{service.note}</p>
            </Link>
          ))}
        </div>
      </DetailModal>

      {/* Wallet modal */}
      <DetailModal
        open={openTile === 'wallet'}
        onClose={() => setOpenTile(null)}
        title="Wallet"
      >
        <dl className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Available balance</dt>
            <dd className="mt-1 text-xl font-bold text-slate-900">{formatNaira(wallet.availableBalance)}</dd>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Escrow held</dt>
            <dd className="mt-1 text-xl font-bold text-slate-900">{formatNaira(wallet.escrowBalance)}</dd>
          </div>
        </dl>
        <div className="mt-5">
          <Link
            href={appendTenantContextToPath('/wallet', tenantSlug)}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Open wallet
          </Link>
        </div>
      </DetailModal>

      {/* Activity modal */}
      <DetailModal
        open={openTile === 'activity'}
        onClose={() => setOpenTile(null)}
        title="Recent activity"
      >
        <HomeActivityFeed
          orders={orders}
          walletTransactions={walletTransactions}
        />
      </DetailModal>
    </div>
  );
}

function HomeActivityFeed({
  orders,
  walletTransactions,
}: {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    service: { name: string };
  }>;
  walletTransactions: Array<{
    id: string;
    type: TransactionType;
    description: string;
    createdAt: string;
    amount: string;
  }>;
}) {
  const items = [
    ...orders.slice(0, 3).map((order) => ({
      id: `order-${order.id}`,
      title: order.service.name,
      meta: `${order.orderNumber} • ${order.status}`,
      time: order.createdAt,
      amount: null as string | null,
    })),
    ...walletTransactions.slice(0, 3).map((transaction) => ({
      id: `txn-${transaction.id}`,
      title: transaction.description,
      meta: transaction.type.replaceAll('_', ' '),
      time: transaction.createdAt,
      amount: formatNaira(transaction.amount),
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        message="Orders, wallet movements, and service activity will appear here as you start using the platform."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDate(item.time)}</p>
            </div>
            {item.amount ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {item.amount}
              </span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function DashTile({ icon: Icon, label, value, color, onClick }: {
  icon: ElementType; label: string; value: string; color: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="group flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-sm active:scale-[0.98]">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </button>
  );
}
