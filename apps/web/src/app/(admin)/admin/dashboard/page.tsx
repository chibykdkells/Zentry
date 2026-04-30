'use client';

import Link from 'next/link';
import { Activity, Building2, Receipt, Users } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { useAdminOperationsOverview } from '@/hooks/use-admin-operations';
import { useAdminWalletOverview } from '@/hooks/use-admin-wallets';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';

export default function AdminDashboardPage() {
  const {
    overview,
    loading: overviewLoading,
    error: overviewError,
    reload: reloadOverview,
  } = useAdminOperationsOverview();
  const {
    overview: walletOverview,
    loading: walletLoading,
    error: walletError,
    reload: reloadWallet,
  } = useAdminWalletOverview();

  if (overviewLoading || walletLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-32 rounded-[1.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  if (!overview || !walletOverview || overviewError || walletError) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <EmptyState
          title="Platform dashboard unavailable"
          message={
            overviewError ??
            walletError ??
            'We could not load the platform admin dashboard right now.'
          }
          action={
            <button
              type="button"
              onClick={() => {
                reloadOverview();
                reloadWallet();
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Businesses',
      value: String(overview.metrics.totalTenants),
      icon: Building2,
      variant: 'navy' as const,
    },
    {
      title: 'CBT centers',
      value: String(overview.metrics.approvedCbtCenters),
      icon: Users,
      variant: 'teal' as const,
    },
    {
      title: 'Individual users',
      value: String(overview.metrics.totalIndividualUsers),
      icon: Users,
      variant: 'green' as const,
    },
    {
      title: 'Transactions',
      value: String(overview.metrics.totalTransactions),
      icon: Receipt,
      variant: 'amber' as const,
    },
    {
      title: 'Live users',
      value: String(overview.metrics.activeUsers),
      icon: Activity,
      variant: 'navy' as const,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Platform admin dashboard"
        title="Run the platform from one operating view"
        description="See business growth, money pressure, support load, and payout readiness without jumping across multiple screens."
        actions={
          <>
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
            >
              Open business and user control
            </Link>
            <Link
              href="/admin/finance"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Open finance
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
        <AccountPanel
          title="Needs attention now"
          description="The fastest reading of what the platform owner should look at next."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: 'Businesses on the platform',
                description: `${overview.metrics.totalTenants} tenant portals are live or registered.`,
              },
              {
                title: 'Live users right now',
                description: `${overview.metrics.activeUsers} users are currently active in live sessions.`,
              },
              {
                title: 'Manual jobs waiting for pickup',
                description: `${overview.metrics.pendingPoolJobs} manual jobs are still in the open pool.`,
              },
              {
                title: 'Jobs waiting for release',
                description: `${overview.metrics.awaitingRelease + overview.metrics.readyForRelease} completed jobs are still in the release pipeline.`,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </AccountPanel>

        <AccountPanel
          title="Platform money snapshot"
          description="Use this to read earnings, held customer money, and which businesses are carrying the most support exposure."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyTile
              label="Platform earnings"
              value={formatNaira(walletOverview.platformCommissionVolume)}
            />
            <MoneyTile
              label="Customer funds on hold"
              value={formatNaira(walletOverview.totalEscrowBalance)}
            />
            <MoneyTile
              label="CBT payout volume"
              value={formatNaira(walletOverview.cbtCommissionVolume)}
            />
            <MoneyTile
              label="Total withdrawals"
              value={formatNaira(walletOverview.withdrawalVolume)}
            />
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Held funds by business
            </h2>

            {walletOverview.heldFundsByTenant.length ? (
              <div className="mt-4 space-y-3">
                {walletOverview.heldFundsByTenant.slice(0, 6).map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {tenant.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                        {tenant.slug}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatNaira(tenant.heldFunds)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No business is holding customer funds right now.
              </p>
            )}
          </div>
        </AccountPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AccountPanel
          title="Jobs waiting for a CBT center"
          description="These manual requests are still waiting for a CBT center to pick them up."
          actions={
            <Link
              href="/admin/orders"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Open platform orders
            </Link>
          }
        >
          {overview.previews.availableJobs.length ? (
            <div className="space-y-3">
              {overview.previews.availableJobs.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {order.orderNumber} • {order.service.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.tenant?.name ?? 'Platform'} • {order.requester.email}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No manual jobs are waiting right now"
              message="When a customer submits a manual request that needs a CBT operator, it will appear here."
            />
          )}
        </AccountPanel>

        <AccountPanel
          title="Release pressure"
          description="Use this to understand where the platform is feeling payout or operations pressure."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyTile
              label="Ready for release"
              value={String(overview.scheduler.readyCount)}
            />
            <MoneyTile
              label="Still waiting"
              value={String(overview.scheduler.awaitingCount)}
            />
            <MoneyTile
              label="Blocked"
              value={String(overview.scheduler.blockedCount)}
            />
            <MoneyTile
              label="Dispute window"
              value={`${overview.scheduler.disputeWindowHours}h`}
            />
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Next release timing</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {overview.scheduler.nextWindowExpiryAt
                ? `The next dispute window closes on ${formatDate(overview.scheduler.nextWindowExpiryAt)} (${formatTimeUntil(overview.scheduler.nextWindowExpiryAt)}).`
                : 'No release window is currently counting down.'}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <PostureRow
              label="Manual jobs waiting for pickup"
              value={String(overview.metrics.pendingPoolJobs)}
            />
            <PostureRow
              label="Manual jobs in progress"
              value={String(overview.metrics.inProgressJobs)}
            />
            <PostureRow
              label="Manual jobs completed"
              value={String(overview.metrics.completedJobs)}
            />
          </div>
        </AccountPanel>
      </div>
    </div>
  );
}

function MoneyTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PostureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
