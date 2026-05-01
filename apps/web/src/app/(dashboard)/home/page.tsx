'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, CheckCircle, ReceiptText, Wallet } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { WalletCard } from '@/components/wallet/wallet-card';
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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:space-y-6 md:p-8">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-56 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:space-y-6 md:p-8">
      <PageHero
        eyebrow="Welcome back"
        title={`${profile.firstName}, here’s your workspace.`}
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

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        <StatCard
          title="Pending Orders"
          value={String(metrics?.active ?? 0)}
          icon={Briefcase}
          variant="navy"
        />
        <StatCard
          title="Completed"
          value={String(metrics?.completed ?? 0)}
          icon={CheckCircle}
          variant="teal"
        />
        <StatCard
          title="On hold"
          value={formatNaira(wallet.escrowBalance)}
          icon={ReceiptText}
          variant="orange"
        />
        <StatCard
          title="Wallet Balance"
          value={formatNaira(wallet.availableBalance)}
          icon={Wallet}
          variant="navy"
        />
      </div>

      <div className="grid gap-5 md:gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Popular services</h2>
              <p className="mt-1 text-sm text-slate-500">
                Start from a focused set of services without the visual clutter.
              </p>
            </div>
            <Link
              href={appendTenantContextToPath('/services', tenantSlug)}
              className="shrink-0 text-sm font-semibold text-[#0D1B3E] hover:text-[#132754]"
            >
              View all
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:mt-5">
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{service.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{service.note}</p>
                  </div>
                  <ArrowRight size={18} className="mt-1 text-slate-400 transition group-hover:text-[#0D1B3E]" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          <div className="mt-4">
            <HomeActivityFeed
              orders={orders}
              walletTransactions={walletOverview?.recentTransactions ?? []}
            />
          </div>
        </section>
      </div>
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
