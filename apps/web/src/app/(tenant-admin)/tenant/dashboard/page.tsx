'use client';

import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import {
  ArrowRight,
  Briefcase,
  Clock3,
  Settings2,
  ShieldAlert,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { useTenantOverview } from '@/hooks/use-tenant-admin';
import {
  useTenantProviderReadiness,
  useTenantServiceManagementCatalog,
} from '@/hooks/use-tenant-services';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';

export default function TenantDashboardPage() {
  const { overview, loading, error, reload } = useTenantOverview();
  const { services, loading: servicesLoading } = useTenantServiceManagementCatalog({});
  const { readiness, loading: readinessLoading } = useTenantProviderReadiness();

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
    : String(services.filter((service) => service.isSelected).length);
  const automatedServices = servicesLoading
    ? '...'
    : String(
        services.filter((service) => service.deliveryMode === 'API_AUTOMATED').length,
      );
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Business command center"
        title={`${overview.tenant.name} at a glance`}
        description="Track this business's customers, operators, active work, and payout posture from one operating view."
        actions={
          <>
            <Link
              href="/tenant/users"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
            >
              Manage users
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/tenant/services"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Business services
            </Link>
            <Link
              href="/wallet"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Open wallet
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
        <FocusCard
          icon={Wallet}
          eyebrow="Money"
          title="Wallet and payout state"
          description="Keep the business balance, held funds, and payout queue visible without leaving the dashboard."
          tone="from-slate-50 to-white"
          highlights={[
            {
              label: 'Available now',
              value: formatNaira(overview.metrics.availableBalance),
            },
            {
              label: 'Held funds',
              value: formatNaira(overview.metrics.heldFunds),
            },
            {
              label: 'Ready for payout',
              value: String(overview.metrics.readyReleaseCount),
            },
          ]}
          href="/wallet"
          cta="Open wallet"
        />
        <FocusCard
          icon={Users}
          eyebrow="People"
          title="Users and operators"
          description="See how many customers and CBT centers are inside this business, then jump straight into user management."
          tone="from-amber-50/70 to-white"
          highlights={[
            {
              label: 'Customers',
              value: String(overview.metrics.individualUsers),
            },
            {
              label: 'CBT centers',
              value: String(overview.metrics.cbtUsers),
            },
            {
              label: 'Newest sign-ins',
              value: String(overview.recentUsers.length),
            },
          ]}
          href="/tenant/users"
          cta="Manage users"
        />
        <FocusCard
          icon={Settings2}
          eyebrow="Service setup"
          title="Catalog and API routing"
          description="This tenant uses the platform service catalog by default, with the option to hide services or switch automated calls to its own API."
          tone="from-emerald-50/70 to-white"
          highlights={[
            {
              label: 'Visible services',
              value: visibleServices,
            },
            {
              label: 'Automated services',
              value: automatedServices,
            },
            {
              label: 'Connection',
              value: `${providerScope} • ${providerMode}`,
            },
          ]}
          footer={
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
              Provider health: <span className="font-semibold text-slate-900">{providerHealth}</span>
            </div>
          }
          actions={
            <>
              <Link
                href="/tenant/services"
                className="inline-flex items-center justify-center rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
              >
                Business services
              </Link>
              <Link
                href="/tenant/providers"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                API integrations
              </Link>
            </>
          }
        />
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
          title="Needs attention now"
          description="The fastest way to understand what the business admin should check next."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                label: 'Requests still active',
                value: overview.metrics.activeOrders,
              },
              {
                label: 'Disputes already open',
                value: overview.metrics.disputedOrders,
              },
              {
                label: 'Ready for payout release',
                value: overview.metrics.readyReleaseCount,
              },
              {
                label: 'Business balance available',
                value: formatNaira(overview.metrics.availableBalance),
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
              label="Completed requests"
              value={String(overview.metrics.completedOrders)}
            />
            <MiniFinanceTile
              label="Held customer funds"
              value={formatNaira(overview.metrics.heldFunds)}
            />
            <MiniFinanceTile
              label="Customers + CBT centers"
              value={String(overview.metrics.individualUsers + overview.metrics.cbtUsers)}
            />
            <MiniFinanceTile
              label="Blocked by dispute"
              value={String(overview.metrics.blockedReleaseCount)}
            />
          </div>
        </AccountPanel>

        <AccountPanel
          title="Newest users in this business"
          description="The latest people who joined or were provisioned into this tenant."
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
          title="Money and payout posture"
          description="Use this to understand what is waiting, what is ready, and what the business can already move."
        >
          <div className="grid gap-3 sm:grid-cols-3">
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

          <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">How to read this</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Waiting means the dispute window is still open. Ready means the work is clear
              for payout. Blocked means a dispute is holding the release back.
            </p>
          </div>
        </AccountPanel>

        <AccountPanel
          title="Completed job queue"
          description="See which completed manual jobs are still waiting, ready, or blocked."
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

function FocusCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  tone,
  highlights,
  href,
  cta,
  footer,
  actions,
}: {
  icon: ElementType;
  eyebrow: string;
  title: string;
  description: string;
  tone: string;
  highlights: Array<{ label: string; value: string }>;
  href?: string;
  cta?: string;
  footer?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article
      className={`rounded-[1.5rem] border border-slate-200 bg-gradient-to-br ${tone} p-5 shadow-sm`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
        <Icon size={18} />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>

      <div className="mt-4 space-y-2.5">
        {highlights.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"
          >
            <span className="text-sm text-slate-500">{item.label}</span>
            <span className="text-sm font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}

      {actions ? (
        <div className="mt-4 flex flex-wrap gap-3">{actions}</div>
      ) : href && cta ? (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
        >
          {cta}
          <ArrowRight size={16} />
        </Link>
      ) : null}
    </article>
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
