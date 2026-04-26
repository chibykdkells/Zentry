'use client';

import Link from 'next/link';
import { Activity, Building2, Receipt, Users } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { InfoHint } from '@/components/shared/info-hint';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { useAdminOperationsOverview } from '@/hooks/use-admin-operations';
import { useAdminWalletOverview } from '@/hooks/use-admin-wallets';
import { formatNaira } from '@/lib/format';

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
        title="See business growth, support exposure, and payout posture in one place"
        description="This dashboard is now centered on businesses, people, money movement, and live usage so the platform owner can make support and rollout decisions faster."
        actions={
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Open business and user control
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
        <AccountPanel
          title="Workspace highlights"
          description="A short human-language guide to what matters in this workspace."
        >
          <div className="space-y-4">
            {[
              {
                title: 'Businesses',
                description:
                  'A business is a tenant portal. It contains its own users, jobs, settings, and wallet activity.',
              },
              {
                title: 'Live users',
                description:
                  'This count shows people currently connected through the live session layer, not just people who have logged in before.',
              },
              {
                title: 'Held funds',
                description:
                  'Held funds are customer payments still waiting for completion, dispute clearance, or release. This helps support teams trace issues faster.',
              },
              {
                title: 'Platform earnings',
                description:
                  'Platform earnings are the commissions retained by the platform owner, separate from CBT payouts and customer balances.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </h2>
                  <InfoHint text={item.description} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </AccountPanel>

        <AccountPanel
          title="Platform money snapshot"
          description="A short view of platform earnings, customer funds still on hold, and which businesses are carrying the largest support exposure."
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
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Held funds by business
              </h2>
              <InfoHint text="Use this view when support needs to confirm which business portals currently have customer funds still waiting on completion or dispute clearance." />
            </div>

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
          description="These are manual requests still waiting for a CBT center to pick them up."
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
          title="Platform posture"
          description="A quick support-oriented reading of what needs attention across the platform."
        >
          <div className="space-y-3">
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
            <PostureRow
              label="Jobs waiting for payout release"
              value={String(overview.metrics.awaitingRelease + overview.metrics.readyForRelease)}
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
