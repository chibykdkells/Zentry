'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { MobileSheet } from '@/components/shared/mobile-sheet';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonLine } from '@/components/shared/skeleton-loader';
import {
  useAdminCbtApplications,
  useApproveCbtCenter,
  useRejectCbtCenter,
  type AdminCbtApplication,
} from '@/hooks/use-admin-cbt';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { CbtApprovalStatus } from '@zentry/types';

const STATUS_OPTIONS: Array<{ label: string; value: CbtApprovalStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: CbtApprovalStatus.PENDING },
  { label: 'Approved', value: CbtApprovalStatus.APPROVED },
  { label: 'Rejected', value: CbtApprovalStatus.REJECTED },
  { label: 'Suspended', value: CbtApprovalStatus.SUSPENDED },
];

const STATUS_STYLES: Record<CbtApprovalStatus, string> = {
  [CbtApprovalStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
  [CbtApprovalStatus.APPROVED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [CbtApprovalStatus.REJECTED]: 'bg-red-50 text-red-700 border-red-200',
  [CbtApprovalStatus.SUSPENDED]: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AdminCbtPage() {
  const [statusFilter, setStatusFilter] = useState<CbtApprovalStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');

  const { applications, meta, loading, error, reload } = useAdminCbtApplications({
    status: statusFilter,
    page,
    limit: 10,
  });

  const effectiveSelectedUserId =
    applications.some((a) => a.id === selectedUserId)
      ? selectedUserId
      : (applications[0]?.id ?? null);

  const selectedApp = applications.find((a) => a.id === effectiveSelectedUserId) ?? null;

  const approve = useApproveCbtCenter();
  const reject = useRejectCbtCenter();

  const handleSelectApp = (userId: string) => {
    setSelectedUserId(userId);
    setShowRejectInput(false);
    setRejectReason('');
    if (usesMobileSheet) setIsMobileDetailOpen(true);
  };

  const handleApprove = async (app: AdminCbtApplication) => {
    try {
      await approve.mutateAsync(app.id);
      toast.success(`${app.cbtProfile?.centerName ?? 'CBT center'} approved`);
      setShowRejectInput(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve this center right now'));
    }
  };

  const handleReject = async (app: AdminCbtApplication) => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (rejectReason.trim().length < 5) {
      toast.error('Please provide a rejection reason (at least 5 characters)');
      return;
    }
    try {
      await reject.mutateAsync({ userId: app.id, reason: rejectReason.trim() });
      toast.success(`${app.cbtProfile?.centerName ?? 'CBT center'} rejected`);
      setShowRejectInput(false);
      setRejectReason('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not reject this center right now'));
    }
  };

  const metrics = {
    total: meta?.total ?? 0,
    pending: applications.filter(
      (a) => a.cbtProfile?.approvalStatus === CbtApprovalStatus.PENDING,
    ).length,
  };

  const detailContent = (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D1B3E]/55">
          Application review
        </p>
        <h2 className="text-lg font-semibold text-slate-900">CBT center detail</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review the center profile and approve or reject the application.
        </p>
      </div>

      {selectedApp ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {selectedApp.cbtProfile?.centerName ?? '—'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedApp.firstName} {selectedApp.lastName} · {selectedApp.email}
                </p>
              </div>
              {selectedApp.cbtProfile && (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    STATUS_STYLES[selectedApp.cbtProfile.approvalStatus]
                  }`}
                >
                  {selectedApp.cbtProfile.approvalStatus}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'License number', value: selectedApp.cbtProfile?.licenseNumber },
              { label: 'Phone', value: selectedApp.phone },
              { label: 'State', value: selectedApp.cbtProfile?.state },
              { label: 'LGA', value: selectedApp.cbtProfile?.lga },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {label}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {value ?? '—'}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Address
            </p>
            <p className="mt-1.5 text-sm text-slate-700">
              {selectedApp.cbtProfile?.address ?? '—'}
            </p>
          </div>

          {selectedApp.cbtProfile?.supportingDocUrl ? (
            <a
              href={selectedApp.cbtProfile.supportingDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#0D1B3E] transition hover:bg-slate-50"
            >
              <ExternalLink size={15} />
              View supporting document
            </a>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-sm text-slate-400 italic">No supporting document uploaded</p>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Applied {formatDate(selectedApp.cbtProfile?.createdAt ?? selectedApp.createdAt)}
          </p>

          {selectedApp.cbtProfile?.rejectionReason && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Rejection reason
              </p>
              <p className="mt-1 text-sm text-red-700">
                {selectedApp.cbtProfile.rejectionReason}
              </p>
            </div>
          )}

          {showRejectInput && (
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a reason for rejection (required)..."
              rows={3}
              className="w-full rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-200"
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={
                approve.isPending ||
                reject.isPending ||
                selectedApp.cbtProfile?.approvalStatus === CbtApprovalStatus.APPROVED
              }
              onClick={() => handleApprove(selectedApp)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {approve.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {approve.isPending ? 'Approving…' : 'Approve'}
            </button>

            <button
              type="button"
              disabled={
                approve.isPending ||
                reject.isPending ||
                selectedApp.cbtProfile?.approvalStatus === CbtApprovalStatus.REJECTED
              }
              onClick={() => handleReject(selectedApp)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reject.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <XCircle size={15} />
              )}
              {reject.isPending
                ? 'Rejecting…'
                : showRejectInput
                  ? 'Confirm rejection'
                  : 'Reject'}
            </button>
          </div>

          {showRejectInput && (
            <button
              type="button"
              onClick={() => {
                setShowRejectInput(false);
                setRejectReason('');
              }}
              className="w-full rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-500 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Select an application"
            message="Choose a CBT center from the list to review their application."
            icon={ShieldCheck}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:flex md:h-full md:flex-col md:overflow-hidden md:space-y-6 md:p-8">
      <PageHero
        eyebrow="CBT Centers"
        title="Review and approve CBT center applications"
        description="Pending centers cannot access the job pool until approved. Review their profile and supporting documents before making a decision."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: 'Total centers', value: metrics.total },
          { label: 'Awaiting approval', value: metrics.pending },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-3xl font-bold tracking-tight text-slate-900">
              {item.value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{item.label}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 md:gap-6 xl:h-[min(48rem,calc(100vh-22rem))] xl:grid-cols-[1.1fr_0.9fr] xl:overflow-hidden">
        {/* List panel */}
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6 xl:flex xl:min-h-0 xl:flex-col">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.value);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === opt.value
                    ? 'border-[#0D1B3E] bg-[#0D1B3E] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                    <SkeletonLine className="h-4 w-40" />
                    <SkeletonLine className="mt-2 h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <EmptyState
                title="Could not load applications"
                message={error}
                icon={ShieldCheck}
                action={
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            ) : applications.length ? (
              <div className="space-y-3">
                {applications.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => handleSelectApp(app.id)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      effectiveSelectedUserId === app.id
                        ? 'border-[#0D1B3E] bg-[#0D1B3E]/[0.03] shadow-sm'
                        : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {app.cbtProfile?.centerName ?? `${app.firstName} ${app.lastName}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {app.email} · {app.cbtProfile?.state ?? '—'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Applied {formatDate(app.cbtProfile?.createdAt ?? app.createdAt)}
                        </p>
                      </div>
                      {app.cbtProfile && (
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            STATUS_STYLES[app.cbtProfile.approvalStatus]
                          }`}
                        >
                          {app.cbtProfile.approvalStatus}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No applications found"
                message={
                  statusFilter === 'ALL'
                    ? 'No CBT centers have registered yet.'
                    : `No centers with status "${statusFilter}" found.`
                }
                icon={ShieldCheck}
              />
            )}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <p className="text-sm text-slate-500">
                Page {meta.page} of {meta.totalPages}
              </p>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </section>

        {/* Detail panel — desktop */}
        {!usesMobileSheet ? (
          <section className="rounded-[1.75rem] border border-slate-300 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] p-5 shadow-sm ring-1 ring-[#0D1B3E]/5 md:p-6 xl:min-h-0 xl:overflow-y-auto">
            {detailContent}
          </section>
        ) : null}
      </div>

      {/* Detail panel — mobile sheet */}
      <MobileSheet
        open={isMobileDetailOpen}
        onClose={() => setIsMobileDetailOpen(false)}
        title={selectedApp?.cbtProfile?.centerName ?? 'CBT center'}
        description={selectedApp ? `${selectedApp.email} · ${selectedApp.cbtProfile?.state ?? '—'}` : ''}
      >
        {detailContent}
      </MobileSheet>
    </div>
  );
}
