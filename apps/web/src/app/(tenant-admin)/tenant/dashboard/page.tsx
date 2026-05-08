'use client';

import { type ElementType, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Briefcase,
  Clock3,
  Settings2,
  ShieldAlert,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { useTenantOverview } from '@/hooks/use-tenant-admin';
import {
  useTenantProviderReadiness,
  useTenantServiceManagementCatalog,
} from '@/hooks/use-tenant-services';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function TenantDashboardPage() {
  const { overview, loading, error, reload } = useTenantOverview();
  const { services, loading: servicesLoading } = useTenantServiceManagementCatalog({});
  const { readiness, loading: readinessLoading } = useTenantProviderReadiness();
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [openTile, setOpenTile] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-32 rounded-[1.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  if (!overview || error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <EmptyState
          title="Tenant dashboard unavailable"
          message={error ?? 'We could not load the tenant workspace right now.'}
          action={
            <button
              type="button"
              onClick={reload}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const visibleServices = servicesLoading
    ? '...'
    : String(services.filter((s) => s.isSelected).length);
  const automatedServices = servicesLoading
    ? '...'
    : String(services.filter((s) => s.deliveryMode === 'API_AUTOMATED').length);
  const providerMode = readinessLoading
    ? 'Checking'
    : readiness?.vtu.mode === 'live'
      ? 'Live API'
      : 'Mock mode';
  const providerScope = readinessLoading
    ? 'Connection'
    : readiness?.scope.effectiveType === 'TENANT'
      ? 'Business override'
      : 'Platform default';
  const providerHealth = readinessLoading
    ? 'Checking...'
    : readiness?.vtu.probe.status === 'healthy'
      ? 'Healthy'
      : readiness?.vtu.probe.status === 'unreachable'
        ? 'Unreachable'
        : readiness?.vtu.probe.status === 'error'
          ? 'Needs attention'
          : 'Not checked yet';

  const openUser = overview.recentUsers.find((u) => u.id === openUserId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={`${overview.tenant.name}`}
        description="Customers, operators, active work, and payout posture at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tenant/users"
              className="inline-flex items-center rounded-2xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy-strong"
            >
              Users
            </Link>
            <Link
              href="/tenant/services"
              className="inline-flex items-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
            >
              Services
            </Link>
          </div>
        }
      />

      {/* Colorful stat cards — immediate numbers at a glance */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Customers"
          value={String(overview.metrics.individualUsers)}
          icon={Users}
          variant="navy"
        />
        <StatCard
          title="CBT centers"
          value={String(overview.metrics.cbtUsers)}
          icon={Users}
          variant="amber"
        />
        <StatCard
          title="Active requests"
          value={String(overview.metrics.activeOrders)}
          icon={Briefcase}
          variant="green"
        />
        <StatCard
          title="Held customer funds"
          value={formatNaira(overview.metrics.heldFunds)}
          icon={Wallet}
          variant="teal"
        />
      </div>

      {/* Dashboard tile grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <DashTile
          icon={Wallet}
          label="Wallet"
          value={formatNaira(overview.metrics.myWalletBalance)}
          color="bg-[#0D1B3E] text-white"
          onClick={() => setOpenTile('wallet')}
        />
        <DashTile
          icon={Users}
          label="Customers"
          value={`${overview.metrics.individualUsers + overview.metrics.cbtUsers} users`}
          color="bg-amber-500 text-white"
          onClick={() => setOpenTile('customers')}
        />
        <DashTile
          icon={Settings2}
          label="Services"
          value={`${visibleServices} active`}
          color="bg-emerald-600 text-white"
          onClick={() => setOpenTile('services')}
        />
        <DashTile
          icon={AlertCircle}
          label="Attention"
          value={`${overview.metrics.activeOrders + overview.metrics.disputedOrders} open`}
          color="bg-rose-500 text-white"
          onClick={() => setOpenTile('attention')}
        />
      </div>

      {/* Wallet modal */}
      <DetailModal
        open={openTile === 'wallet'}
        onClose={() => setOpenTile(null)}
        title="Wallet and payout"
        width="md"
        footer={
          <Link
            href="/wallet"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Open wallet
          </Link>
        }
      >
        <dl className="grid gap-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Your wallet balance</dt>
            <dd className="font-semibold text-slate-900">{formatNaira(overview.metrics.myWalletBalance)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">User available funds</dt>
            <dd className="font-semibold text-slate-900">{formatNaira(overview.metrics.userAvailableFunds)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Held customer funds</dt>
            <dd className="font-semibold text-slate-900">{formatNaira(overview.metrics.heldFunds)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Ready for payout</dt>
            <dd className="font-semibold text-slate-900">{overview.metrics.readyReleaseCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Completed orders</dt>
            <dd className="font-semibold text-slate-900">{overview.metrics.completedOrders}</dd>
          </div>
        </dl>
      </DetailModal>

      {/* Customers modal */}
      <DetailModal
        open={openTile === 'customers'}
        onClose={() => setOpenTile(null)}
        title="Users and operators"
        width="md"
        footer={
          <Link
            href="/tenant/users"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Manage users
          </Link>
        }
      >
        <dl className="grid gap-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Customers</dt>
            <dd className="font-semibold text-slate-900">{overview.metrics.individualUsers}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">CBT centers</dt>
            <dd className="font-semibold text-slate-900">{overview.metrics.cbtUsers}</dd>
          </div>
        </dl>
      </DetailModal>

      {/* Services modal */}
      <DetailModal
        open={openTile === 'services'}
        onClose={() => setOpenTile(null)}
        title="Catalog and API routing"
        width="md"
        footer={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/tenant/services"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
            >
              Business services
            </Link>
            <Link
              href="/tenant/providers"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              API integrations
            </Link>
          </div>
        }
      >
        <dl className="grid gap-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Visible services</dt>
            <dd className="font-semibold text-slate-900">{visibleServices}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Automated services</dt>
            <dd className="font-semibold text-slate-900">{automatedServices}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Provider scope</dt>
            <dd className="font-semibold text-slate-900">{providerScope}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Provider mode</dt>
            <dd className="font-semibold text-slate-900">{providerMode}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Provider health</dt>
            <dd className="font-semibold text-slate-900">{providerHealth}</dd>
          </div>
        </dl>
      </DetailModal>

      {/* Attention modal */}
      <DetailModal
        open={openTile === 'attention'}
        onClose={() => setOpenTile(null)}
        title="Needs attention"
        width="md"
      >
        <dl className="grid gap-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Active orders</dt>
            <dd className="font-semibold text-slate-900">{overview.metrics.activeOrders}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Disputed orders</dt>
            <dd className="font-semibold text-slate-900">{overview.metrics.disputedOrders}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Ready for payout</dt>
            <dd className="font-semibold text-slate-900">{overview.metrics.readyReleaseCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <dt className="text-slate-500">Your wallet balance</dt>
            <dd className="font-semibold text-slate-900">{formatNaira(overview.metrics.myWalletBalance)}</dd>
          </div>
        </dl>
      </DetailModal>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AccountPanel
          title="Newest users in this business"
          description="The latest people who joined or were provisioned into this tenant. Click any row to view details."
        >
          {overview.recentUsers.length ? (
            <div className="space-y-1">
              {overview.recentUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setOpenUserId(user.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-sm text-slate-500">{user.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {user.role === 'TENANT_ADMIN'
                      ? 'Business admin'
                      : user.role === 'CBT_CENTER'
                        ? 'CBT center'
                        : 'Customer'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent business users"
              message="Users provisioned or registered into this business portal will appear here."
              icon={Users}
            />
          )}
        </AccountPanel>

        <AccountPanel
          title="Completed job queue"
          description="Completed manual jobs still waiting on the payout cycle."
        >
          {overview.releaseQueue.length ? (
            <div className="space-y-3">
              {overview.releaseQueue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.orderNumber} · {item.service.name}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {item.requester.name} · {item.requester.email}
                      </p>
                    </div>
                    <ReleaseBadge state={item.releaseState} />
                  </div>
                  <div className="mt-3 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
                    <p>CBT payout: {formatNaira(item.cbtCommission)}</p>
                    <p>CBT: {item.assignedCbt ? item.assignedCbt.name : 'Not assigned'}</p>
                    <p>
                      Window:{' '}
                      {item.disputeWindowExpiresAt
                        ? `${formatDate(item.disputeWindowExpiresAt)}${
                            item.releaseState === 'AWAITING_WINDOW'
                              ? ` · ${formatTimeUntil(item.disputeWindowExpiresAt)}`
                              : ''
                          }`
                        : 'Not available'}
                    </p>
                    <p>Dispute: {item.dispute ? item.dispute.reason : 'None'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No completed jobs waiting"
              message="When manual jobs complete and enter the payout cycle they will appear here."
              icon={Clock3}
            />
          )}
        </AccountPanel>
      </div>

      {openUser ? (
        <DetailModal
          open
          onClose={() => setOpenUserId(null)}
          title={`${openUser.firstName} ${openUser.lastName}`}
          description={openUser.email}
          width="md"
        >
          <dl className="grid gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-8">
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Role</dt>
              <dd className="font-medium text-slate-900">
                {openUser.role === 'TENANT_ADMIN'
                  ? 'Business admin'
                  : openUser.role === 'CBT_CENTER'
                    ? 'CBT center'
                    : 'Customer'}
              </dd>
            </div>
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Joined</dt>
              <dd className="font-medium text-slate-900">{formatDate(openUser.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Last sign-in</dt>
              <dd className="font-medium text-slate-900">
                {openUser.lastLoginAt ? formatDate(openUser.lastLoginAt) : 'Never'}
              </dd>
            </div>
          </dl>
        </DetailModal>
      ) : null}
    </div>
  );
}

function ReleaseBadge({ state }: { state: 'AWAITING_WINDOW' | 'READY' | 'BLOCKED' }) {
  const classes =
    state === 'READY'
      ? 'bg-emerald-50 text-emerald-700'
      : state === 'BLOCKED'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-amber-50 text-amber-700';
  const label = state === 'READY' ? 'Ready' : state === 'BLOCKED' ? 'Blocked' : 'Waiting';
  const Icon = state === 'READY' ? UserRoundCheck : state === 'BLOCKED' ? ShieldAlert : Clock3;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', classes)}>
      <Icon size={14} />
      {label}
    </span>
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
