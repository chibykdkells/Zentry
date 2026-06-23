'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  FolderSearch,
  Search,
} from 'lucide-react';
import { AdminDisputeReviewPanel } from '@/components/admin/admin-dispute-review-panel';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import {
  SkeletonBlock,
  SkeletonLine,
} from '@/components/shared/skeleton-loader';
import { MobileSheet } from '@/components/shared/mobile-sheet';
import { useAdminDisputes } from '@/hooks/use-disputes';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAdminOrderDetail } from '@/hooks/use-orders';
import { adminDisputesSections } from '@/lib/admin-content';
import { formatDate, formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DisputeStatus } from '@zendocx/types';

const ALL_FILTER_VALUE = 'ALL';

export default function AdminDisputesPage() {
  const [filters, setFilters] = useState<{
    page: number;
    limit: number;
    search: string;
    status: DisputeStatus | typeof ALL_FILTER_VALUE;
  }>({
    page: 1,
    limit: 8,
    search: '',
    status: ALL_FILTER_VALUE,
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');

  const { metrics, disputes, meta, loading, error, reload } = useAdminDisputes(filters);
  const effectiveSelectedOrderId = disputes.some(
    (item) => item.order.id === selectedOrderId,
  )
    ? selectedOrderId
    : (disputes[0]?.order.id ?? null);
  const {
    order: detail,
    loading: detailLoading,
    error: detailError,
    reload: reloadDetail,
  } = useAdminOrderDetail(effectiveSelectedOrderId);

  const metricCards = [
    { label: 'All cases', value: metrics?.all ?? 0 },
    { label: 'Open', value: metrics?.open ?? 0 },
    { label: 'Under review', value: metrics?.underReview ?? 0 },
    { label: 'Redo requested', value: metrics?.redoRequested ?? 0 },
    { label: 'Resolved', value: metrics?.resolved ?? 0 },
  ] as const;

  const handleSelectDispute = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (usesMobileSheet) {
      setIsMobileDetailOpen(true);
    }
  };

  const selectedCaseContent = detailLoading ? (
    <div className="space-y-4">
      <SkeletonBlock className="h-32 rounded-3xl" />
      <SkeletonBlock className="h-40 rounded-3xl" />
    </div>
  ) : detailError ? (
    <EmptyState
      title="Dispute detail unavailable"
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
  ) : detail?.dispute ? (
    <AdminDisputeReviewPanel detail={detail} />
  ) : (
    <EmptyState
      title="Select a dispute"
      message="Choose a dispute from the queue to inspect its live order context and admin actions."
      icon={ClipboardList}
    />
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Disputes"
        description="Live dispute cases, redo requests, and financial exposure in one place."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((card) => (
          <article
            key={card.label}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-3xl font-bold tracking-tight text-slate-900">
              {card.value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{card.label}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Dispute queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search by order number, requester, service, or dispute reason.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <label className="relative block">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      page: 1,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Search disputes"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    status: event.target.value as DisputeStatus | typeof ALL_FILTER_VALUE,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
              >
                <option value={ALL_FILTER_VALUE}>All statuses</option>
                {Object.values(DisputeStatus).map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5"
                >
                  <SkeletonLine className="h-5 w-36" />
                  <SkeletonLine className="mt-3 h-4 w-full" />
                  <SkeletonLine className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="Admin disputes unavailable"
                message={error}
                icon={AlertTriangle}
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
          ) : disputes.length ? (
            <>
              <ScrollCardBody className="mt-6" bodyClassName="space-y-4" maxHeightClassName="">
                {disputes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectDispute(item.order.id)}
                    className={cn(
                      'w-full rounded-[1.5rem] border p-5 text-left transition',
                      effectiveSelectedOrderId === item.order.id
                        ? 'border-[#0D1B3E] bg-[#0D1B3E]/[0.03] shadow-sm'
                        : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white',
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {item.order.service.name}
                          </h3>
                          <DisputeBadge status={item.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {item.order.orderNumber} • {item.order.requester.email}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {item.reason}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricPill
                          label="Refund exposure"
                          value={formatNaira(item.disputeGroundwork.refundAmount)}
                        />
                        <MetricPill
                          label="Status"
                          value={item.status.replaceAll('_', ' ')}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                      <span>Opened {formatDate(item.createdAt)}</span>
                      {item.redoDeadline ? (
                        <span>Redo deadline {formatDate(item.redoDeadline)}</span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </ScrollCardBody>

              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={!meta || filters.page <= 1}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: Math.max(1, current.page - 1),
                    }))
                  }
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
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: current.page + 1,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="No disputes in this view"
                message="Broaden the filters to see more dispute cases across the platform."
                icon={FolderSearch}
              />
            </div>
          )}
        </section>

        <div className="space-y-6">
          <AccountPanel
            title="Admin dispute guidance"
            description="These highlights keep the dispute workflow aligned with the current release engine and later financial resolution work."
          >
            <div className="space-y-4">
              {adminDisputesSections.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0D1B3E] shadow-sm">
                    <item.icon size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AccountPanel>

          {!usesMobileSheet ? (
            <AccountPanel
              title="Selected case"
              description="The order detail stays live here so admin review and financial groundwork remain tied to the actual order state."
              className="border-slate-300 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] ring-1 ring-[#0D1B3E]/5"
            >
              {selectedCaseContent}
            </AccountPanel>
          ) : null}
        </div>
      </div>

      <MobileSheet
        open={isMobileDetailOpen}
        onClose={() => setIsMobileDetailOpen(false)}
        title={detail?.service.name ?? 'Selected case'}
        description={
          detail
            ? `${detail.orderNumber} • ${detail.dispute?.status.replaceAll('_', ' ') ?? 'Dispute'}`
            : 'Inspect the selected dispute case.'
        }
      >
        {selectedCaseContent}
      </MobileSheet>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DisputeBadge({ status }: { status: DisputeStatus }) {
  const tone =
    status === DisputeStatus.OPEN
      ? 'bg-rose-50 text-rose-700'
      : status === DisputeStatus.UNDER_REVIEW
        ? 'bg-amber-50 text-amber-700'
        : status === DisputeStatus.REDO_REQUESTED
          ? 'bg-sky-50 text-sky-700'
          : 'bg-emerald-50 text-emerald-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
