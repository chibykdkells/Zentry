'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, Loader2, Timer } from 'lucide-react';
import { MobileSheet } from '@/components/shared/mobile-sheet';
import { EmptyState } from '@/components/shared/empty-state';
import { FilePreviewGallery } from '@/components/shared/file-preview-gallery';
import { FilterChipGroup } from '@/components/shared/filter-chip-group';
import { PageHeader } from '@/components/shared/page-header';
import { SkeletonBlock, SkeletonLine } from '@/components/shared/skeleton-loader';
import {
  useCbtJobDetail,
  useCompleteCbtJob,
  useCbtMyJobs,
  useRequestTimeExtension,
  useStartCbtJob,
} from '@/hooks/use-cbt-orders';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';
import { OrderStatus } from '@zendocx/types';

const ALL_FILTER_VALUE = 'ALL';
const statusOptions: Array<{
  label: string;
  value: OrderStatus | typeof ALL_FILTER_VALUE;
}> = [
  { label: 'All jobs', value: ALL_FILTER_VALUE },
  { label: 'Assigned', value: OrderStatus.ASSIGNED },
  { label: 'In progress', value: OrderStatus.IN_PROGRESS },
  { label: 'Completed', value: OrderStatus.COMPLETED },
];

export default function MyJobsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | typeof ALL_FILTER_VALUE>(ALL_FILTER_VALUE);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');
  const { metrics, jobs, meta, loading, error, reload } = useCbtMyJobs({
    page,
    limit: 8,
    status,
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
  const startJob = useStartCbtJob();
  const completeJob = useCompleteCbtJob();
  const requestExtension = useRequestTimeExtension();
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');

  const handleStartJob = async (orderId: string) => {
    try {
      const response = await startJob.mutateAsync(orderId);
      toast.success(response.message ?? 'Job moved into progress.');
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Could not start this job right now.'),
      );
    }
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    if (usesMobileSheet) {
      setIsMobileDetailOpen(true);
    }
  };

  const detailContent = (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D1B3E]/55">
          Execution workspace
        </p>
        <h2 className="text-lg font-semibold text-slate-900">Job detail</h2>
        <p className="mt-1 text-sm text-slate-500">
          The selected assignment’s current execution context.
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
            icon={ClipboardList}
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
            <MetricPill label="Assigned" value={detail.assignedAt ? formatDate(detail.assignedAt) : 'Not assigned'} />
            <MetricPill label="Completed" value={detail.completedAt ? formatDate(detail.completedAt) : 'Not completed'} />
          </div>

          {detail.deliveryDeadline && (detail.status === OrderStatus.ASSIGNED || detail.status === OrderStatus.IN_PROGRESS) ? (
            <DeadlineTimer deadline={detail.deliveryDeadline} />
          ) : null}

          {detail.deliveryDeadline &&
           (detail.status === OrderStatus.ASSIGNED || detail.status === OrderStatus.IN_PROGRESS) &&
           !(detail.timeExtensionRequests?.length) ? (
            showExtensionForm ? (
              <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <h3 className="text-sm font-semibold text-amber-900">Request extra time</h3>
                </div>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why you need more time..."
                  className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowExtensionForm(false); setExtensionReason(''); }}
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={extensionReason.trim().length < 10 || requestExtension.isPending}
                    onClick={async () => {
                      try {
                        const res = await requestExtension.mutateAsync({ orderId: detail.id, reason: extensionReason.trim() });
                        toast.success(res.message ?? 'Extension request sent.');
                        setShowExtensionForm(false);
                        setExtensionReason('');
                      } catch (err) {
                        toast.error(getApiErrorMessage(err, 'Could not send extension request.'));
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {requestExtension.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Submit request
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowExtensionForm(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100"
              >
                <AlertTriangle size={15} />
                Request extra time
              </button>
            )
          ) : detail.timeExtensionRequests?.length ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              Extension request pending — awaiting tenant admin review.
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Submitted data</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(detail.submittedData).map(([key, value]) => (
                <span key={key} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                  {key}: {value}
                </span>
              ))}
            </div>
          </div>

          <FilePreviewGallery
            title="Requester files"
            files={detail.requesterDocuments}
            emptyMessage="No supporting files were attached to this request."
          />

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Execution note</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Start and completion are now live. Upload the result file here
              to mark the job complete and begin the dispute-window handoff.
            </p>
          </div>

          {detail.resultFileUrl ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
              <h3 className="text-sm font-semibold text-emerald-900">Submitted result</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Result uploaded {detail.resultUploadedAt ? formatDate(detail.resultUploadedAt) : 'recently'}.
              </p>
              <div className="mt-4">
                <FilePreviewGallery
                  title="Uploaded result"
                  files={[detail.resultFileUrl]}
                  emptyMessage="The result file is not available yet."
                  className="border-emerald-200 bg-white/70"
                />
              </div>
            </div>
          ) : null}

          {(detail.status === OrderStatus.ASSIGNED ||
            detail.status === OrderStatus.IN_PROGRESS) ? (
            <CompleteJobPanel
              key={detail.id}
              orderId={detail.id}
              loading={completeJob.isPending}
              onComplete={async ({ file, notes }) => {
                try {
                  const response = await completeJob.mutateAsync({
                    orderId: detail.id,
                    file,
                    cbtNotes: notes,
                  });
                  toast.success(
                    response.message ?? 'Job completed successfully.',
                  );
                } catch (error) {
                  toast.error(
                    getApiErrorMessage(
                      error,
                      'Could not complete this job right now.',
                    ),
                  );
                }
              }}
            />
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/job-pool"
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to job pool
            </Link>
            <button
              type="button"
              disabled={startJob.isPending || detail.status !== OrderStatus.ASSIGNED}
              onClick={() => handleStartJob(detail.id)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startJob.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {startJob.isPending ? 'Starting...' : 'Mark as in progress'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Select a job"
            message="Choose one of your jobs to inspect its current execution state."
            icon={ClipboardList}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:flex md:h-full md:flex-col xl:overflow-hidden md:space-y-6 md:p-8">
      <PageHeader
        title="My Jobs"
        description="Follow each claimed job, review files, and submit finished work."
        actions={
          <Link
            href="/job-pool"
            className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
          >
            Job Pool
          </Link>
        }
      />

      <div className="grid gap-2.5 md:grid-cols-3 md:gap-4">
        <MetricCard title="Assigned" value={String(metrics?.assigned ?? 0)} icon={ClipboardList} />
        <MetricCard title="In progress" value={String(metrics?.inProgress ?? 0)} icon={Clock3} />
        <MetricCard title="Completed" value={String(metrics?.completed ?? 0)} icon={CheckCircle2} />
      </div>

      <div className="grid gap-5 md:gap-6 xl:h-[min(48rem,calc(100vh-18rem))] xl:grid-cols-[1.05fr_0.95fr] xl:overflow-hidden">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6 xl:flex xl:min-h-0 xl:flex-col">
          <FilterChipGroup
            value={status}
            onChange={(value) => {
              setPage(1);
              setStatus(value as OrderStatus | typeof ALL_FILTER_VALUE);
            }}
            options={statusOptions.map((option) => ({
              id: option.value,
              label: option.label,
            }))}
          />

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
                title="My jobs unavailable"
                message={error}
                icon={ClipboardList}
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
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          {job.service.name}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                          {job.orderNumber} • {job.status}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {job.requester.firstName} {job.requester.lastName} • {job.requester.email}
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
                title="No assigned jobs yet"
                message="Once work is linked to your center, it will appear here grouped by live status."
                icon={ClipboardList}
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
          detail ? `${detail.orderNumber} • ${detail.status}` : 'Inspect the selected assignment.'
        }
      >
        {detailContent}
      </MobileSheet>
    </div>
  );
}

function DeadlineTimer({ deadline }: { deadline: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 120;
  const expired = secondsLeft === 0;

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${
        expired
          ? 'border-red-200 bg-red-50 text-red-700'
          : isUrgent
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      <Timer size={16} />
      <span className="text-sm font-semibold">
        {expired
          ? 'Deadline expired'
          : `Deliver within ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      </span>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-[#0D1B3E]">
        <Icon size={18} />
      </div>
      <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{title}</p>
    </article>
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

function CompleteJobPanel({
  orderId,
  loading,
  onComplete,
}: {
  orderId: string;
  loading: boolean;
  onComplete: (input: { file: File; notes: string }) => Promise<void>;
}) {
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [cbtNotes, setCbtNotes] = useState('');

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
      <h3 className="text-sm font-semibold text-slate-900">
        Upload result and complete
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Attach the finished output for the requester. Completing the job starts
        the dispute window automatically.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Result file
          </span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(event) => setResultFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          <span className="mt-2 block text-xs text-slate-400">
            Accepts PDF, JPG, PNG, or WEBP up to 5MB.
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Completion notes
          </span>
          <textarea
            value={cbtNotes}
            onChange={(event) => setCbtNotes(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
            placeholder="Add any useful notes the requester should know about this result."
          />
        </label>
      </div>

      <div
        className={
          usesMobileSheet
            ? 'sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white/95 px-5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm'
            : 'mt-5'
        }
      >
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (!resultFile) {
              toast.error('Attach the result file before completing this job.');
              return;
            }

            await onComplete({ file: resultFile, notes: cbtNotes });
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Uploading result...' : 'Complete job with result'}
        </button>
      </div>
      <input type="hidden" value={orderId} readOnly />
    </div>
  );
}
