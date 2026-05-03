'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CbtApprovalStatus } from '@zendocx/types';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useAdminCbtApplications,
  useApproveCbtCenter,
  useAssignableCbtServiceCategories,
  useRejectCbtCenter,
  useUpdateCbtServiceCategories,
  type AdminCbtApplication,
} from '@/hooks/use-admin-cbt';
import {
  usePendingExtensionRequests,
  useReviewExtension,
  type ExtensionRequest,
} from '@/hooks/use-cbt-orders';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: Array<{ label: string; value: CbtApprovalStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: CbtApprovalStatus.PENDING },
  { label: 'Approved', value: CbtApprovalStatus.APPROVED },
  { label: 'Rejected', value: CbtApprovalStatus.REJECTED },
];

const STATUS_STYLES: Record<CbtApprovalStatus, string> = {
  [CbtApprovalStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
  [CbtApprovalStatus.APPROVED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [CbtApprovalStatus.REJECTED]: 'bg-rose-50 text-rose-700 border-rose-200',
  [CbtApprovalStatus.SUSPENDED]: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function TenantCbtManagementPage() {
  const [activeTab, setActiveTab] = useState<'centers' | 'extensions'>('centers');
  const [statusFilter, setStatusFilter] = useState<CbtApprovalStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [categorySelection, setCategorySelection] = useState<{ userId: string | null; ids: string[] }>({
    userId: null,
    ids: [],
  });
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [additionalMinutes, setAdditionalMinutes] = useState('5');

  const { applications, meta, loading, error, reload } = useAdminCbtApplications({
    status: statusFilter,
    page,
    limit: 12,
  });

  const approve = useApproveCbtCenter();
  const reject = useRejectCbtCenter();
  const updateCategories = useUpdateCbtServiceCategories();
  const { requests: extensionRequests, loading: extensionsLoading, error: extensionsError, reload: reloadExtensions } = usePendingExtensionRequests();
  const reviewExtension = useReviewExtension();

  const openApp = applications.find((a) => a.id === openUserId) ?? null;

  const { categories, loading: categoriesLoading, error: categoriesError } =
    useAssignableCbtServiceCategories(openUserId);

  const selectedCategoryIds =
    categorySelection.userId === openUserId
      ? categorySelection.ids
      : (openApp?.cbtProfile?.serviceCategories.map((c) => c.id) ?? []);

  const handleOpen = (app: AdminCbtApplication) => {
    setOpenUserId(app.id);
    setCategorySelection({
      userId: app.id,
      ids: app.cbtProfile?.serviceCategories.map((c) => c.id) ?? [],
    });
    setShowRejectInput(false);
    setRejectReason('');
  };

  const handleClose = () => {
    setOpenUserId(null);
    setShowRejectInput(false);
    setRejectReason('');
  };

  const handleApprove = async () => {
    if (!openApp) return;
    try {
      await approve.mutateAsync(openApp.id);
      toast.success(`${openApp.cbtProfile?.centerName ?? 'CBT center'} approved`);
      handleClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve this center right now'));
    }
  };

  const handleReject = async () => {
    if (!openApp) return;
    if (!showRejectInput) { setShowRejectInput(true); return; }
    if (rejectReason.trim().length < 5) {
      toast.error('Please provide a rejection reason (at least 5 characters)');
      return;
    }
    try {
      await reject.mutateAsync({ userId: openApp.id, reason: rejectReason.trim() });
      toast.success(`${openApp.cbtProfile?.centerName ?? 'CBT center'} rejected`);
      handleClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not reject this center right now'));
    }
  };

  const handleSaveCategories = async () => {
    if (!openApp) return;
    if (!selectedCategoryIds.length) {
      toast.error('Select at least one supported category before saving.');
      return;
    }
    try {
      await updateCategories.mutateAsync({ userId: openApp.id, serviceCategoryIds: selectedCategoryIds });
      toast.success('Supported categories updated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update categories right now'));
    }
  };

  const handleReviewExtension = async (req: ExtensionRequest, action: 'APPROVE' | 'REJECT') => {
    const mins = parseInt(additionalMinutes, 10);
    try {
      const res = await reviewExtension.mutateAsync({
        extensionId: req.id,
        action,
        additionalMinutes: action === 'APPROVE' ? (Number.isFinite(mins) && mins > 0 ? mins : 5) : undefined,
      });
      toast.success(res.message ?? (action === 'APPROVE' ? 'Extension approved.' : 'Extension rejected.'));
      setReviewingId(null);
      setAdditionalMinutes('5');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not process this request.'));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="CBT operator management"
        title="Registered CBT centers"
        description="Review applications, assign supported service categories, and approve or reject licensed fulfillers registered in this business portal."
      />

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('centers')}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-semibold transition',
            activeTab === 'centers'
              ? 'border-[#0D1B3E] bg-[#0D1B3E] text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          CBT Centers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('extensions')}
          className={cn(
            'relative rounded-full border px-4 py-2 text-sm font-semibold transition',
            activeTab === 'extensions'
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          Extension Requests
          {extensionRequests.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white ring-2 ring-white">
              {extensionRequests.length}
            </span>
          ) : null}
        </button>
      </div>

      {activeTab === 'extensions' ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          {extensionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : extensionsError ? (
            <EmptyState
              title="Extension requests unavailable"
              message={extensionsError}
              icon={ShieldCheck}
              action={
                <button
                  type="button"
                  onClick={() => { void reloadExtensions(); }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Try again
                </button>
              }
            />
          ) : extensionRequests.length ? (
            <div className="space-y-3">
              {extensionRequests.map((req) => (
                <div key={req.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {req.order.assignedCbt?.cbtProfile?.centerName
                          ?? (`${req.order.assignedCbt?.firstName ?? ''} ${req.order.assignedCbt?.lastName ?? ''}`.trim() || 'Unknown CBT')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {req.order.orderNumber} · {req.order.service.name}
                      </p>
                      {req.order.deliveryDeadline ? (
                        <p className="mt-1 text-xs text-amber-700 font-medium">
                          Deadline: {formatDate(req.order.deliveryDeadline)}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Pending review
                    </span>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Reason</p>
                    <p className="mt-1 text-sm text-slate-700">{req.reason}</p>
                  </div>

                  {reviewingId === req.id ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="font-medium">Extra minutes:</span>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={additionalMinutes}
                          onChange={(e) => setAdditionalMinutes(e.target.value)}
                          className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={reviewExtension.isPending}
                        onClick={() => { void handleReviewExtension(req, 'APPROVE'); }}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {reviewExtension.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Confirm approve
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReviewingId(null); setAdditionalMinutes('5'); }}
                        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reviewExtension.isPending}
                        onClick={() => { setReviewingId(req.id); setAdditionalMinutes('5'); }}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle2 size={13} />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={reviewExtension.isPending}
                        onClick={() => { void handleReviewExtension(req, 'REJECT'); }}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {reviewExtension.isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pending extension requests"
              message="CBT centers with active jobs can request extra delivery time. Requests will appear here."
              icon={AlertTriangle}
            />
          )}
        </div>
      ) : null}

      {activeTab === 'centers' ? (
        <>
      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              statusFilter === opt.value
                ? 'border-[#0D1B3E] bg-[#0D1B3E] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title="CBT centers unavailable"
            message={error}
            icon={ShieldCheck}
            action={
              <button
                type="button"
                onClick={() => { void reload(); }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Try again
              </button>
            }
          />
        ) : applications.length ? (
          <div className="space-y-1">
            {applications.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => handleOpen(app)}
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 text-left transition hover:border-slate-200 hover:bg-slate-50/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {app.cbtProfile?.centerName ?? `${app.firstName} ${app.lastName}`}
                  </p>
                  <p className="truncate text-xs text-slate-500">{app.email}</p>
                </div>
                {app.cbtProfile ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
                      STATUS_STYLES[app.cbtProfile.approvalStatus],
                    )}
                  >
                    {app.cbtProfile.approvalStatus}
                  </span>
                ) : null}
                <span className="hidden shrink-0 text-xs text-slate-400 sm:block">
                  {formatDate(app.createdAt)}
                </span>
              </button>
            ))}

            {meta && meta.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                <p>Page {meta.page} of {meta.totalPages} · {meta.total} centers</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No CBT centers found"
            message={
              statusFilter !== 'ALL'
                ? `No ${statusFilter.toLowerCase()} applications in this portal.`
                : 'CBT centers that register under this portal will appear here.'
            }
            icon={ShieldCheck}
          />
        )}
      </div>

      {/* Detail modal */}
      {openApp ? (
        <DetailModal
          open
          onClose={handleClose}
          title={openApp.cbtProfile?.centerName ?? `${openApp.firstName} ${openApp.lastName}`}
          description={openApp.email}
          width="lg"
          footer={
            <div className="space-y-3">
              {showRejectInput ? (
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason for rejection (required)..."
                  rows={3}
                  className="w-full rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              ) : null}
              <div className="flex flex-wrap gap-3">
                {openApp.cbtProfile?.approvalStatus !== CbtApprovalStatus.APPROVED ? (
                  <button
                    type="button"
                    disabled={
                      approve.isPending || reject.isPending || updateCategories.isPending ||
                      selectedCategoryIds.length === 0
                    }
                    onClick={() => { void handleApprove(); }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approve.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {approve.isPending ? 'Approving…' : 'Approve'}
                  </button>
                ) : null}
                {openApp.cbtProfile?.approvalStatus !== CbtApprovalStatus.REJECTED ? (
                  <button
                    type="button"
                    disabled={approve.isPending || reject.isPending || updateCategories.isPending}
                    onClick={() => { void handleReject(); }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reject.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    {reject.isPending ? 'Rejecting…' : showRejectInput ? 'Confirm reject' : 'Reject'}
                  </button>
                ) : null}
                {showRejectInput ? (
                  <button
                    type="button"
                    onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Profile header */}
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {openApp.firstName} {openApp.lastName}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">{openApp.phone}</p>
              </div>
              {openApp.cbtProfile ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
                    STATUS_STYLES[openApp.cbtProfile.approvalStatus],
                  )}
                >
                  {openApp.cbtProfile.approvalStatus}
                </span>
              ) : null}
            </div>

            {/* CBT profile fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'License number', value: openApp.cbtProfile?.licenseNumber },
                { label: 'State', value: openApp.cbtProfile?.state },
                { label: 'LGA', value: openApp.cbtProfile?.lga },
                { label: 'Applied', value: formatDate(openApp.cbtProfile?.createdAt ?? openApp.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{value ?? '—'}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Address</p>
              <p className="mt-1 text-sm text-slate-700">{openApp.cbtProfile?.address ?? '—'}</p>
            </div>

            {/* Supporting doc */}
            {openApp.cbtProfile?.supportingDocUrl ? (
              <a
                href={openApp.cbtProfile.supportingDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#0D1B3E] transition hover:bg-slate-50"
              >
                <ExternalLink size={14} />
                View supporting document
              </a>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <p className="text-sm italic text-slate-400">No supporting document uploaded</p>
              </div>
            )}

            {/* Rejection reason (if any) */}
            {openApp.cbtProfile?.rejectionReason ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Rejection reason</p>
                <p className="mt-1 text-sm text-rose-700">{openApp.cbtProfile.rejectionReason}</p>
              </div>
            ) : null}

            {/* Category assignment */}
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Supported categories</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Controls which manual jobs this center can see and claim.
                    At least one is required before approving.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={updateCategories.isPending || !selectedCategoryIds.length}
                  onClick={() => { void handleSaveCategories(); }}
                  className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateCategories.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>

              {categoriesError ? (
                <p className="mt-3 text-sm text-rose-600">{categoriesError}</p>
              ) : categoriesLoading ? (
                <p className="mt-3 text-sm text-slate-500">Loading categories…</p>
              ) : categories.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {categories.map((cat) => {
                    const checked = selectedCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? Array.from(new Set([...selectedCategoryIds, cat.id]))
                              : selectedCategoryIds.filter((id) => id !== cat.id);
                            setCategorySelection({ userId: openUserId, ids: next });
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D1B3E] focus:ring-[#0D1B3E]/20"
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">{cat.name}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{cat.slug}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No assignable categories available.</p>
              )}
            </div>
          </div>
        </DetailModal>
      ) : null}
        </>
      ) : null}
    </div>
  );
}
