'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Briefcase, Loader2, Search } from 'lucide-react';
import { MobileSheet } from '@/components/shared/mobile-sheet';
import { EmptyState } from '@/components/shared/empty-state';
import { FilePreviewGallery } from '@/components/shared/file-preview-gallery';
import { PageHeader } from '@/components/shared/page-header';
import { SkeletonBlock, SkeletonLine } from '@/components/shared/skeleton-loader';
import {
  useCbtJobDetail,
  useCbtJobPool,
  useClaimCbtJob,
} from '@/hooks/use-cbt-orders';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';

export default function JobPoolPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');
  const { jobs, meta, loading, error, reload } = useCbtJobPool({
    page,
    limit: 8,
    search,
  });
  const effectiveSelectedJobId = jobs.some((job) => job.id === selectedJobId)
    ? selectedJobId
    : (jobs[0]?.id ?? null);
  const {
    job: detail,
    loading: detailLoading,
    error: detailError,
    reload: reloadDetail,
  } = useCbtJobDetail(effectiveSelectedJobId);
  const claimJob = useClaimCbtJob();
  const showInlineDetailActions = !usesMobileSheet;

  const handleClaimJob = async (orderId: string) => {
    try {
      const response = await claimJob.mutateAsync(orderId);
      toast.success(response.message ?? 'Job claimed successfully.');
      router.push('/my-jobs');
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = getApiErrorMessage(error, 'Could not claim this job right now.');
      toast.error(message);
      // Job was already claimed by someone else — refresh pool and clear selection
      if (status === 409) {
        setSelectedJobId(null);
        void claimJob.reset();
      }
    }
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    if (usesMobileSheet) {
      setIsMobileDetailOpen(true);
    }
  };

  const detailActions = detail ? (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href="/my-jobs"
        className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Review my jobs
      </Link>
      <button
        type="button"
        disabled={
          claimJob.isPending || detail.status !== 'PENDING' || Boolean(detail.assignedCbt)
        }
        onClick={() => handleClaimJob(detail.id)}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {claimJob.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
        {claimJob.isPending ? 'Claiming...' : 'Claim this job'}
      </button>
    </div>
  ) : null;

  const detailContent = (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D1B3E]/55">
          Review workspace
        </p>
        <h2 className="text-lg font-semibold text-slate-900">Job detail</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review the selected request and claim it when your center is ready
          to take ownership.
        </p>
      </div>

      {detailLoading ? (
        <div className="mt-6 space-y-4">
          <SkeletonBlock className="h-32 rounded-3xl" />
          <SkeletonBlock className="h-36 rounded-3xl" />
        </div>
      ) : detailError ? (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Job detail unavailable"
            message={detailError}
            icon={Briefcase}
            action={
              <button
                type="button"
                onClick={reloadDetail}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Try again
              </button>
            }
          />
        </div>
      ) : detail ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricPill label="Requester" value={detail.requester.email} />
            <MetricPill label="Status" value={detail.status} />
            <MetricPill label="Order amount" value={formatNaira(detail.totalAmount)} />
            <MetricPill label="Your commission" value={formatNaira(detail.cbtCommission)} />
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Submitted data</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(detail.submittedData).map(([key, value]) => (
                <span key={key} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                  {key}: {value}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Submitted {formatDate(detail.createdAt)} • {detail.requesterDocuments.length} supporting document
              {detail.requesterDocuments.length === 1 ? '' : 's'}
            </p>
          </div>

          <FilePreviewGallery
            title="Requester files"
            files={detail.requesterDocuments}
            emptyMessage="No supporting files were attached to this request."
          />

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Readiness note</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review the submitted files first. Once you claim this job, it
              moves to My Jobs so your center can continue processing it.
            </p>
          </div>

          {showInlineDetailActions ? detailActions : null}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Select a job"
            message="Choose a queue item to review its request context."
            icon={Briefcase}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:flex md:h-full md:flex-col xl:overflow-hidden md:space-y-6 md:p-8">
      <PageHeader
        title="Job Pool"
        description="Review eligible manual requests, inspect files, and claim jobs for your center."
        actions={
          <Link
            href="/my-jobs"
            className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
          >
            My Jobs
          </Link>
        }
      />

      <div className="grid gap-5 md:gap-6 xl:h-[min(48rem,calc(100vh-18rem))] xl:grid-cols-[1.05fr_0.95fr] xl:overflow-hidden">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6 xl:flex xl:min-h-0 xl:flex-col">
          <div className="space-y-4">
            <label className="relative block">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Search order number, service, or requester"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
              />
            </label>
          </div>

          {loading ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
                  <SkeletonLine className="h-5 w-36" />
                  <SkeletonLine className="mt-3 h-4 w-full" />
                  <SkeletonLine className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="Job pool unavailable"
                message={error}
                icon={Briefcase}
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
          ) : jobs.length ? (
            <>
              <div className="mt-6 space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
                {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleSelectJob(job.id)}
                    className={`w-full rounded-[1.5rem] border p-5 text-left transition ${
                      effectiveSelectedJobId === job.id
                        ? 'border-[#0D1B3E] bg-[#0D1B3E]/[0.03] shadow-sm'
                        : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-slate-900">
                          {job.service.name}
                        </h2>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {job.orderNumber} · {job.service.category.name}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {job.requester.firstName} {job.requester.lastName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {job.requester.email}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatNaira(job.cbtCommission)}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                          Commission
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <p className="text-sm text-slate-500">
                  Page {meta?.page ?? 1} of {meta?.totalPages ?? 1}
                </p>
                <button
                  type="button"
                  disabled={!meta?.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="No jobs available yet"
                message="As soon as unassigned manual requests exist, this pool will surface them here."
                icon={Briefcase}
              />
            </div>
          )}
        </section>

        {!usesMobileSheet ? (
          <section className="rounded-[1.75rem] border border-slate-300 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] p-5 shadow-sm ring-1 ring-[#0D1B3E]/5 md:p-6 xl:min-h-0 xl:overflow-y-auto">
            {detailContent}
          </section>
        ) : null}
      </div>

      <MobileSheet
        open={isMobileDetailOpen}
        onClose={() => setIsMobileDetailOpen(false)}
        title={detail?.service.name ?? 'Job detail'}
        description={
          detail ? `${detail.orderNumber} • ${detail.service.category.name}` : 'Review the selected request.'
        }
        footer={detailActions}
      >
        {detailContent}
      </MobileSheet>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
