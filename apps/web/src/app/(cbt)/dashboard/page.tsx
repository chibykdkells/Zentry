'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, Clock3, TrendingUp } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { useCbtDashboard } from '@/hooks/use-cbt-orders';
import { formatDate, formatNaira } from '@/lib/format';

export default function CbtDashboardPage() {
  const { dashboard, loading, error, reload } = useCbtDashboard();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem] col-span-2 md:col-span-1" />
        </div>
      </div>
    );
  }

  if (!dashboard || error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <EmptyState
          title="CBT dashboard unavailable"
          message={error ?? 'We could not load the CBT workspace right now.'}
          action={
            <button
              type="button"
              onClick={reload}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              CBT Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Manage center jobs from one place
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {dashboard.centerName} now shows live queue items, active work,
              and payout readiness in one simpler view.
            </p>
          </div>

          <Link
            href="/job-pool"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Open job pool
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          title="Available Jobs"
          value={String(dashboard.metrics.availableJobs)}
          icon={Briefcase}
          variant="navy"
        />
        <StatCard
          title="Active Jobs"
          value={String(dashboard.metrics.activeJobs)}
          icon={Clock3}
          variant="teal"
        />
        <StatCard
          title="Earnings"
          value={formatNaira(dashboard.metrics.totalEarned)}
          icon={TrendingUp}
          variant="green"
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <AccountPanel
          title="Open work near you"
          description="Available manual jobs your center can pick up next."
        >
          {dashboard.availableJobs.length ? (
            <div className="space-y-3">
              {dashboard.availableJobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {job.service.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {job.orderNumber} • {job.service.category.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatNaira(job.cbtCommission)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                        Commission
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    Submitted {formatDate(job.createdAt)} • {job.requesterDocCount}{' '}
                    supporting document{job.requesterDocCount === 1 ? '' : 's'}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No visible jobs right now"
              message="When unassigned manual orders exist, they will appear here automatically."
              icon={Briefcase}
            />
          )}
        </AccountPanel>

        <AccountPanel
          title="Your active context"
          description="Your current approval, balance, and recent job activity."
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Approval status
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {dashboard.approvalStatus}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Available balance
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {formatNaira(dashboard.metrics.availableBalance)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Recent assignments
              </p>
              {dashboard.myJobs.length ? (
                <div className="mt-3 space-y-3">
                  {dashboard.myJobs.map((job) => (
                    <div key={job.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {job.service.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {job.orderNumber} • {job.status}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No jobs are currently assigned to this center.
                </p>
              )}
            </div>
          </div>
        </AccountPanel>
      </div>
    </div>
  );
}
