'use client';

import { type ElementType, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, Briefcase, Building2, Clock3, DollarSign, Receipt, Users } from 'lucide-react';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
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

  const [openTile, setOpenTile] = useState<string | null>(null);

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
      <PageHeader
        title="Platform Overview"
        description="Business growth, money pressure, support load, and payout readiness in one view."
        actions={
          <div className="flex gap-2">
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center rounded-2xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy-strong"
            >
              Users
            </Link>
            <Link
              href="/admin/finance"
              className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
            >
              Finance
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <DashTile
          icon={AlertCircle}
          label="Operations"
          value={`${overview.metrics.pendingPoolJobs + overview.metrics.awaitingRelease + overview.metrics.readyForRelease} items`}
          color="bg-rose-500 text-white"
          onClick={() => setOpenTile('operations')}
        />
        <DashTile
          icon={DollarSign}
          label="Finance"
          value={`${formatNaira(walletOverview.successfulFundingVolume)} inflow`}
          color="bg-emerald-600 text-white"
          onClick={() => setOpenTile('finance')}
        />
        <DashTile
          icon={Briefcase}
          label="Job Queue"
          value={`${overview.metrics.pendingPoolJobs} waiting`}
          color="bg-[#0D1B3E] text-white"
          onClick={() => setOpenTile('jobs')}
        />
        <DashTile
          icon={Clock3}
          label="Release"
          value={`${overview.scheduler.readyCount} ready`}
          color="bg-amber-500 text-white"
          onClick={() => setOpenTile('release')}
        />
      </div>

      {/* Operations modal */}
      <DetailModal
        open={openTile === 'operations'}
        onClose={() => setOpenTile(null)}
        title="Operations snapshot"
        width="lg"
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
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </DetailModal>

      {/* Finance modal */}
      <DetailModal
        open={openTile === 'finance'}
        onClose={() => setOpenTile(null)}
        title="Platform finance"
        width="lg"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyTile
            label="Customer funding inflow"
            value={formatNaira(walletOverview.successfulFundingVolume)}
          />
          <MoneyTile
            label="Realized Zendocx revenue"
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
            label="Withdrawals already settled"
            value={formatNaira(walletOverview.withdrawalVolume)}
          />
          <MoneyTile
            label="Withdrawals awaiting action"
            value={`${formatNaira(walletOverview.payoutReviewAmount)} · ${walletOverview.payoutReviewCount}`}
          />
          <MoneyTile
            label="Funding fees captured"
            value={formatNaira(walletOverview.capturedFundingFeeVolume)}
          />
          <MoneyTile
            label="Pending funding reconciliations"
            value={walletOverview.pendingFundingCount.toString()}
          />
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Held funds by business</h2>

          {walletOverview.heldFundsByTenant.length ? (
            <div className="mt-4 space-y-3">
              {walletOverview.heldFundsByTenant.slice(0, 6).map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
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
      </DetailModal>

      {/* Job Queue modal */}
      <DetailModal
        open={openTile === 'jobs'}
        onClose={() => setOpenTile(null)}
        title="Jobs waiting for pickup"
        width="lg"
        footer={
          <Link
            href="/admin/orders"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
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
      </DetailModal>

      {/* Release modal */}
      <DetailModal
        open={openTile === 'release'}
        onClose={() => setOpenTile(null)}
        title="Release pipeline"
        width="lg"
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
      </DetailModal>
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
