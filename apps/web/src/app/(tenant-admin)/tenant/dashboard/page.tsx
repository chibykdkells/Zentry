'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Clock3,
  ShieldAlert,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { InfoHint } from '@/components/shared/info-hint';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { useTenantOverview } from '@/hooks/use-tenant-admin';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';

export default function TenantDashboardPage() {
  const { overview, loading, error, reload } = useTenantOverview();

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Business operations"
        title={`${overview.tenant.name} operations dashboard`}
        description="This is the business-admin workspace for one tenant. It focuses on your customers, your CBT network, current service activity, and payout readiness inside this business only."
        actions={
          <>
            <Link
              href="/tenant/users"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
            >
              Open customers
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/tenant/providers"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              API integrations
            </Link>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: 'Customer activity',
            text: 'Watch how many individual customers are active in this business and how much money is still held against open service work.',
            tone: 'from-slate-50 to-white',
          },
          {
            title: 'CBT operations',
            text: 'Keep the CBT network separate from customer accounts so operations stay easy to scan during support or daily review.',
            tone: 'from-amber-50/70 to-white',
          },
          {
            title: 'Payout readiness',
            text: 'Use the queue below to understand what is still waiting, what is ready, and what is blocked inside this business only.',
            tone: 'from-emerald-50/70 to-white',
          },
        ].map((item) => (
          <article
            key={item.title}
            className={`rounded-[1.5rem] border border-slate-200 bg-gradient-to-br ${item.tone} p-5 shadow-sm`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Workspace guide
            </p>
            <h2 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AccountPanel
          title="Business health"
          description="A quick snapshot of the people and service activity inside this one business portal."
        >
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              What this means
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These numbers are scoped to this business only, so you can read them as an operations view instead of a platform-wide admin report.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: 'Customers + CBT centers',
                value: overview.metrics.individualUsers + overview.metrics.cbtUsers,
              },
              {
                label: 'Completed requests',
                value: overview.metrics.completedOrders,
              },
              {
                label: 'Requests in dispute',
                value: overview.metrics.disputedOrders,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4"
              >
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniFinanceTile
              label="Business available balance"
              value={formatNaira(overview.metrics.availableBalance)}
            />
            <MiniFinanceTile
              label="CBT centers in this business"
              value={String(overview.metrics.cbtUsers)}
            />
            <MiniFinanceTile
              label="Customers"
              value={String(overview.metrics.individualUsers)}
            />
            <MiniFinanceTile
              label="Ready for payout release"
              value={String(overview.metrics.readyReleaseCount)}
            />
          </div>
        </AccountPanel>

        <AccountPanel
          title="Recent users"
          description="The latest people who joined or were provisioned into this business."
        >
          {overview.recentUsers.length ? (
            <div className="space-y-3">
              {overview.recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                      {user.role === 'TENANT_ADMIN'
                        ? 'Business admin'
                        : user.role === 'CBT_CENTER'
                          ? 'CBT center'
                          : 'Customer'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span>Joined {formatDate(user.createdAt)}</span>
                    <span>
                      Last sign-in {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Not yet'}
                    </span>
                  </div>
                </div>
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AccountPanel
          title="Payout readiness"
          description="This is the business-facing release queue. It helps the tenant admin know which completed manual jobs are still waiting, ready, or blocked."
        >
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
            <InfoHint text="Ready means the dispute window has passed and the payout can move when platform release processing runs. Waiting means the dispute window is still open. Blocked means a dispute is holding the payout back." />
            This section explains payout readiness in simple business language.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniFinanceTile
              label="Waiting on dispute window"
              value={String(overview.metrics.awaitingReleaseCount)}
            />
            <MiniFinanceTile
              label="Ready for payout release"
              value={String(overview.metrics.readyReleaseCount)}
            />
            <MiniFinanceTile
              label="Blocked by dispute"
              value={String(overview.metrics.blockedReleaseCount)}
            />
          </div>
        </AccountPanel>

        <AccountPanel
          title="Completed job queue"
          description="See which completed manual jobs are still waiting, which are ready, and which are blocked by a dispute."
        >
          {overview.releaseQueue.length ? (
            <div className="space-y-3">
              {overview.releaseQueue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.orderNumber} • {item.service.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.requester.name} • {item.requester.email}
                      </p>
                    </div>
                    <ReleaseBadge state={item.releaseState} />
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>CBT payout: {formatNaira(item.cbtCommission)}</p>
                    <p>
                      Assigned CBT:{' '}
                      {item.assignedCbt ? item.assignedCbt.name : 'Not assigned'}
                    </p>
                    <p>
                      Dispute window:{' '}
                      {item.disputeWindowExpiresAt
                        ? `${formatDate(item.disputeWindowExpiresAt)} ${
                            item.releaseState === 'AWAITING_WINDOW'
                              ? `• ${formatTimeUntil(item.disputeWindowExpiresAt)}`
                              : ''
                          }`
                        : 'Not available'}
                    </p>
                    <p>
                      Dispute:{' '}
                      {item.dispute ? item.dispute.reason : 'No active dispute'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No completed manual jobs are waiting right now"
              message="When this business has completed manual jobs still waiting on the payout cycle, they will appear here."
              icon={Clock3}
            />
          )}
        </AccountPanel>
      </div>
    </div>
  );
}

function MiniFinanceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
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

  const label =
    state === 'READY'
      ? 'Ready'
      : state === 'BLOCKED'
        ? 'Blocked'
        : 'Waiting';

  const Icon =
    state === 'READY' ? UserRoundCheck : state === 'BLOCKED' ? ShieldAlert : Clock3;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}
