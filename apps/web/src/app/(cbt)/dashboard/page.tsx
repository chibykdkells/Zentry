'use client';

import { type ElementType, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Briefcase, Clock3, ShieldCheck, TrendingUp } from 'lucide-react';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { useCbtDashboard } from '@/hooks/use-cbt-orders';
import { formatDate, formatNaira } from '@/lib/format';

export default function CbtDashboardPage() {
  const { dashboard, loading, error, reload } = useCbtDashboard();

  const [openTile, setOpenTile] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem] col-span-2 sm:col-span-1" />
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <DashTile
          icon={Briefcase}
          label="Job Pool"
          value={`${dashboard.metrics.availableJobs} available`}
          color="bg-[#0D1B3E] text-white"
          onClick={() => setOpenTile('job-pool')}
        />
        <DashTile
          icon={Clock3}
          label="Active Jobs"
          value={`${dashboard.metrics.activeJobs} in progress`}
          color="bg-cyan-600 text-white"
          onClick={() => setOpenTile('active-jobs')}
        />
        <DashTile
          icon={TrendingUp}
          label="Earnings"
          value={formatNaira(dashboard.metrics.totalEarned)}
          color="bg-emerald-600 text-white"
          onClick={() => setOpenTile('earnings')}
        />
        <DashTile
          icon={ShieldCheck}
          label="Status"
          value={dashboard.approvalStatus}
          color="bg-amber-500 text-white"
          onClick={() => setOpenTile('status')}
        />
      </div>

      {/* Job Pool modal */}
      <DetailModal
        open={openTile === 'job-pool'}
        onClose={() => setOpenTile(null)}
        title="Open job pool"
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
      </DetailModal>

      {/* Active Jobs modal */}
      <DetailModal
        open={openTile === 'active-jobs'}
        onClose={() => setOpenTile(null)}
        title="Active jobs"
        description="Jobs currently assigned to your center."
      >
        {dashboard.myJobs.length ? (
          <div className="space-y-3">
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
          <EmptyState
            title="No active jobs"
            message="No jobs are currently assigned to this center."
            icon={Clock3}
          />
        )}
      </DetailModal>

      {/* Earnings modal */}
      <DetailModal
        open={openTile === 'earnings'}
        onClose={() => setOpenTile(null)}
        title="Earnings"
      >
        <dl className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Total earned</dt>
            <dd className="mt-1 text-xl font-bold text-slate-900">{formatNaira(dashboard.metrics.totalEarned)}</dd>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Available balance</dt>
            <dd className="mt-1 text-xl font-bold text-slate-900">{formatNaira(dashboard.metrics.availableBalance)}</dd>
          </div>
        </dl>
        <div className="mt-5">
          <Link
            href="/earnings"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            View earnings
          </Link>
        </div>
      </DetailModal>

      {/* Status modal */}
      <DetailModal
        open={openTile === 'status'}
        onClose={() => setOpenTile(null)}
        title="Center status"
      >
        <dl className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Approval status</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{dashboard.approvalStatus}</dd>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Center name</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{dashboard.centerName}</dd>
          </div>
        </dl>
        <div className="mt-5">
          <Link
            href="/earnings"
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            View earnings
          </Link>
        </div>
      </DetailModal>
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
