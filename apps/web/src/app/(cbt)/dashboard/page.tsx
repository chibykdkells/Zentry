'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Clock3,
  Hourglass,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { useCbtDashboard } from '@/hooks/use-cbt-orders';
import { useAuthStore } from '@/stores/auth.store';
import { formatNaira } from '@/lib/format';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CbtDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { dashboard, loading, error, reload } = useCbtDashboard();

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <SkeletonBlock className="h-14 w-56 rounded-2xl" />
        <SkeletonBlock className="h-44 rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
          <SkeletonBlock className="h-32 rounded-[1.5rem]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <EmptyState
          title="CBT dashboard unavailable"
          message={error}
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

  if (!dashboard) return null;

  const firstName = user?.firstName ?? 'Center';

  if (dashboard.approvalStatus === 'PENDING') {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 pb-28 md:p-8">
        <div className="pt-1">
          <p className="text-sm text-brand-muted">{getGreeting()}</p>
          <h1 className="mt-0.5 text-[1.65rem] font-bold leading-tight text-brand-ink">
            {firstName} 👋
          </h1>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <Hourglass size={26} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Awaiting approval</h2>
          <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-slate-600">
            <span className="font-semibold">{dashboard.centerName}</span> is registered and
            pending review. You&apos;ll be notified once approved and can start picking up jobs.
          </p>
        </div>
      </div>
    );
  }

  if (dashboard.approvalStatus === 'REJECTED') {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 pb-28 md:p-8">
        <div className="pt-1">
          <p className="text-sm text-brand-muted">{getGreeting()}</p>
          <h1 className="mt-0.5 text-[1.65rem] font-bold leading-tight text-brand-ink">
            {firstName} 👋
          </h1>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
            <XCircle size={26} className="text-rose-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Application rejected</h2>
          <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-slate-600">
            The application for{' '}
            <span className="font-semibold">{dashboard.centerName}</span> was not approved.
            Please contact support for more information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-5 pb-28 md:px-8 md:py-8">

      {/* Greeting */}
      <div className="pt-1">
        <p className="text-sm text-brand-muted">{getGreeting()}</p>
        <h1 className="mt-0.5 text-[1.65rem] font-bold leading-tight text-brand-ink">
          {firstName} 👋
        </h1>
        <p className="mt-0.5 text-sm text-brand-muted">{dashboard.centerName}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Available Jobs"
          value={String(dashboard.metrics.availableJobs)}
          sub="in pool"
          icon={<Briefcase size={18} />}
          accent="navy"
          href="/job-pool"
        />
        <StatTile
          label="Active Jobs"
          value={String(dashboard.metrics.activeJobs)}
          sub="in progress"
          icon={<Clock3 size={18} />}
          accent="teal"
          href="/my-jobs"
        />
        <StatTile
          label="Total Earned"
          value={formatNaira(dashboard.metrics.totalEarned)}
          sub="all time"
          icon={<TrendingUp size={18} />}
          accent="green"
          href="/earnings"
        />
        <StatTile
          label="Available"
          value={formatNaira(dashboard.metrics.availableBalance)}
          sub="withdrawable"
          icon={<TrendingUp size={18} />}
          accent="amber"
          href="/withdraw"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/job-pool"
          className="flex items-center justify-between rounded-2xl bg-brand-navy px-5 py-4 text-white transition hover:bg-brand-navy-strong active:scale-[0.98]"
        >
          <div>
            <p className="text-sm font-bold">Open Job Pool</p>
            <p className="mt-0.5 text-xs text-white/60">
              {dashboard.metrics.availableJobs} jobs waiting
            </p>
          </div>
          <ArrowRight size={18} className="text-brand-accent" />
        </Link>
        <Link
          href="/my-jobs"
          className="flex items-center justify-between rounded-2xl border border-brand-line bg-brand-surface px-5 py-4 transition hover:shadow-sm active:scale-[0.98]"
        >
          <div>
            <p className="text-sm font-bold text-brand-ink">My Jobs</p>
            <p className="mt-0.5 text-xs text-brand-muted">
              {dashboard.metrics.activeJobs} active
            </p>
          </div>
          <ArrowRight size={18} className="text-brand-muted" />
        </Link>
      </div>

      {/* Recent available jobs preview */}
      {dashboard.availableJobs.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-brand-ink">New in Pool</h2>
            <Link href="/job-pool" className="text-xs font-semibold text-brand-accent hover:underline">
              See all
            </Link>
          </div>
          <div className="space-y-2.5">
            {dashboard.availableJobs.slice(0, 3).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-2xl border border-brand-line bg-brand-surface px-4 py-3.5 shadow-sm"
              >
                <div className="min-w-0 pr-3">
                  <p className="truncate text-sm font-semibold text-brand-ink">
                    {job.service.name}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-muted">
                    {job.orderNumber} · {job.service.category.name}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-600">
                  {formatNaira(job.cbtCommission)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: 'navy' | 'teal' | 'green' | 'amber';
  href: string;
}) {
  const accentMap = {
    navy:  { icon: 'bg-brand-navy/10 text-brand-navy',   dot: 'bg-brand-navy' },
    teal:  { icon: 'bg-cyan-100 text-cyan-700',           dot: 'bg-cyan-600' },
    green: { icon: 'bg-emerald-100 text-emerald-700',     dot: 'bg-emerald-600' },
    amber: { icon: 'bg-amber-100 text-amber-700',         dot: 'bg-amber-500' },
  };
  const a = accentMap[accent];
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-[1.5rem] border border-brand-line bg-brand-surface p-5 shadow-sm transition hover:shadow-md active:scale-[0.98]"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.icon}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-muted">{label}</p>
        <p className="mt-1 text-xl font-black tracking-tight text-brand-ink">{value}</p>
        <p className="mt-0.5 text-xs text-brand-muted">{sub}</p>
      </div>
    </Link>
  );
}
