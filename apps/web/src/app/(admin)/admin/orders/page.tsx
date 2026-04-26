'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  FolderClock,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminDisputeReviewPanel } from '@/components/admin/admin-dispute-review-panel';
import { MobileSheet } from '@/components/shared/mobile-sheet';
import { EmptyState } from '@/components/shared/empty-state';
import { FilePreviewGallery } from '@/components/shared/file-preview-gallery';
import { PageHero } from '@/components/shared/page-hero';
import {
  SkeletonBlock,
  SkeletonLine,
} from '@/components/shared/skeleton-loader';
import {
  useAdminOrderDetail,
  useAdminOrderReleasePreview,
  useAdminOrders,
  useUpdateAdminOrderNotes,
} from '@/hooks/use-orders';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePlatformAdminTenants } from '@/hooks/use-platform-admin-tenants';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FulfillmentType, OrderStatus, UserRole } from '@zentry/types';

const ALL_FILTER_VALUE = 'ALL';

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState<{
    page: number;
    limit: number;
    search: string;
    tenantId: string | typeof ALL_FILTER_VALUE;
    status: OrderStatus | typeof ALL_FILTER_VALUE;
    fulfillmentType: FulfillmentType | typeof ALL_FILTER_VALUE;
    requesterRole: UserRole | typeof ALL_FILTER_VALUE;
    releaseState:
      | 'AWAITING_WINDOW'
      | 'READY_FOR_RELEASE'
      | 'RELEASED'
      | typeof ALL_FILTER_VALUE;
  }>({
    page: 1,
    limit: 8,
    search: '',
    tenantId: ALL_FILTER_VALUE,
    status: ALL_FILTER_VALUE,
    fulfillmentType: ALL_FILTER_VALUE,
    requesterRole: ALL_FILTER_VALUE,
    releaseState: ALL_FILTER_VALUE,
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');
  const { tenants } = usePlatformAdminTenants({ page: 1, limit: 100 });
  const { metrics, orders, meta, loading, error, reload } = useAdminOrders(filters);
  const effectiveSelectedOrderId = orders.some(
    (order) => order.id === selectedOrderId,
  )
    ? selectedOrderId
    : (orders[0]?.id ?? null);
  const {
    order: detail,
    loading: detailLoading,
    error: detailError,
    reload: reloadDetail,
  } = useAdminOrderDetail(effectiveSelectedOrderId);
  const {
    preview,
    loading: previewLoading,
    error: previewError,
    reload: reloadPreview,
  } = useAdminOrderReleasePreview(effectiveSelectedOrderId);

  const metricCards = useMemo(
    () => [
      { title: 'All orders', value: metrics?.all ?? 0, icon: ClipboardList },
      { title: 'Needs attention', value: metrics?.issues ?? 0, icon: ShieldAlert },
      { title: 'In progress', value: metrics?.active ?? 0, icon: FolderClock },
      { title: 'Completed', value: metrics?.completed ?? 0, icon: PackageCheck },
      { title: 'Awaiting release', value: metrics?.readyForRelease ?? 0, icon: PackageCheck },
    ],
    [metrics],
  );

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (usesMobileSheet) {
      setIsMobileDetailOpen(true);
    }
  };

  const inspectionContent = (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D1B3E]/55">
            Inspection workspace
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Order inspection
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Full request context for the selected queue item.
          </p>
        </div>
        {detail ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {detail.orderNumber}
          </span>
        ) : null}
      </div>

      {detailLoading ? (
        <div className="mt-6 space-y-4">
          <SkeletonBlock className="h-28 rounded-3xl" />
          <SkeletonBlock className="h-40 rounded-3xl" />
        </div>
      ) : detailError ? (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Admin order detail unavailable"
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
            <MetricPill
              label="Requester role"
              value={formatRole(detail.requester.role)}
            />
            <MetricPill
              label="Business"
              value={detail.tenant?.name ?? 'Platform'}
            />
            <MetricPill label="Fulfillment" value={detail.fulfillmentType} />
            <MetricPill label="Total" value={formatNaira(detail.totalAmount)} />
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Submitted request
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(detail.submittedData).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          </div>

          <FilePreviewGallery
            title="Supporting files"
            files={detail.requesterDocUrls}
            emptyMessage="No supporting files were attached."
          />

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Operations context
            </h3>
            <div className="mt-4 space-y-3">
              <TimelineRow label="Created" value={formatDate(detail.createdAt)} />
              <TimelineRow label="Updated" value={formatDate(detail.updatedAt)} />
              <TimelineRow
                label="Assigned CBT"
                value={
                  detail.assignedCbt
                    ? `${detail.assignedCbt.firstName} ${detail.assignedCbt.lastName}`
                    : 'Not assigned'
                }
              />
              <TimelineRow
                label="Release state"
                value={formatReleaseState(detail.releaseState)}
              />
              <TimelineRow
                label="Dispute window"
                value={
                  detail.disputeWindowExpiresAt
                    ? detail.releaseState === 'AWAITING_WINDOW'
                      ? `${formatDate(detail.disputeWindowExpiresAt)} (${formatTimeUntil(detail.disputeWindowExpiresAt)})`
                      : formatDate(detail.disputeWindowExpiresAt)
                    : 'Not started'
                }
              />
              <TimelineRow
                label="Funds released"
                value={
                  detail.escrowReleasedAt
                    ? formatDate(detail.escrowReleasedAt)
                    : 'Still locked'
                }
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <AdminNotesEditor key={detail.id} detail={detail} />
          </div>

          {detail.resultFileUrl ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
              <h3 className="text-sm font-semibold text-emerald-900">
                Result and release readiness
              </h3>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                This order has a submitted result. Use the release state to
                track whether it is still inside the dispute window or ready
                for the future release engine.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href={detail.resultFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Open result file
                </a>
                <span className="inline-flex items-center justify-center rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-emerald-800">
                  {formatReleaseState(detail.releaseState)}
                </span>
              </div>
            </div>
          ) : null}

          {detail.dispute ? (
            <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-5">
              <AdminDisputeReviewPanel detail={detail} />
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Release preparation
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This is a dry-run preview only. It explains what the future
                  release worker will do once the release engine is added.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                <Sparkles size={14} />
                Preview only
              </span>
            </div>

            {previewLoading ? (
              <div className="mt-4 space-y-3">
                <SkeletonLine className="h-4 w-48" />
                <SkeletonBlock className="h-28 rounded-3xl" />
              </div>
            ) : previewError ? (
              <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <EmptyState
                  title="Release preview unavailable"
                  message={previewError}
                  icon={PackageCheck}
                  action={
                    <button
                      type="button"
                      onClick={reloadPreview}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Try again
                    </button>
                  }
                />
              </div>
            ) : preview ? (
              <div className="mt-4 space-y-4">
                <div
                  className={cn(
                    'rounded-3xl border px-4 py-4',
                    preview.canPrepareRelease
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-amber-200 bg-amber-50/70',
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {preview.canPrepareRelease
                      ? 'This order is ready for the future release engine.'
                      : 'This order still has release blockers.'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Release state:{' '}
                    <span className="font-semibold">
                      {formatReleaseState(preview.releaseState)}
                    </span>
                  </p>
                  {preview.blockedReasons.length ? (
                    <div className="mt-3 space-y-2">
                      {preview.blockedReasons.map((reason) => (
                        <div
                          key={reason}
                          className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700"
                        >
                          {reason}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-emerald-800">
                      The future scheduler can prepare this order for atomic
                      release once execution is added in the next phase.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricPill
                    label="Funds on hold"
                    value={formatNaira(preview.amounts.escrowLocked)}
                  />
                  <MetricPill
                    label="CBT payout"
                    value={formatNaira(preview.amounts.cbtCommission)}
                  />
                  <MetricPill
                    label="Platform retention"
                    value={formatNaira(preview.amounts.platformNet)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Financial activity
            </h3>
            <div className="mt-4 space-y-2 md:max-h-[18rem] md:overflow-y-auto md:pr-1">
              {detail.transactions.length ? (
                detail.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {transaction.description}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                          {transaction.type} • {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatNaira(transaction.amount)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No financial activity recorded for this order yet.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Select an order"
            message="Choose a queue item to inspect the full order context."
            icon={ClipboardList}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:flex md:h-full md:flex-col md:overflow-hidden md:p-8">
      <PageHero
        eyebrow="Admin Orders"
        title="Review order flow across the whole platform"
        description="See the full order picture first, then narrow it by business, requester type, fulfillment mode, or release state."
        actions={
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Open admin users
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((item) => (
          <article
            key={item.title}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-[#0D1B3E]">
              <item.icon size={18} />
            </div>
            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              {item.value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{item.title}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:h-[calc(100vh-15rem)] xl:grid-cols-[1.08fr_0.92fr] xl:overflow-hidden">
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm xl:flex xl:min-h-0 xl:flex-col">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Platform queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Use filters to narrow the queue before opening a detail view.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="relative block lg:col-span-2">
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
                  placeholder="Search order number, service, or requester"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>

              <FilterSelect
                label="Business"
                value={filters.tenantId}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    tenantId: value,
                  }))
                }
                options={[
                  { label: 'All businesses', value: ALL_FILTER_VALUE },
                  ...tenants.map((tenant) => ({
                    label: tenant.name,
                    value: tenant.id,
                  })),
                ]}
              />

              <FilterSelect
                label="Status"
                value={filters.status}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    status: value as OrderStatus | typeof ALL_FILTER_VALUE,
                  }))
                }
                options={[
                  { label: 'All statuses', value: ALL_FILTER_VALUE },
                  ...Object.values(OrderStatus).map((status) => ({
                    label: status,
                    value: status,
                  })),
                ]}
              />
              <FilterSelect
                label="Fulfillment"
                value={filters.fulfillmentType}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    fulfillmentType:
                      value as FulfillmentType | typeof ALL_FILTER_VALUE,
                  }))
                }
                options={[
                  { label: 'All modes', value: ALL_FILTER_VALUE },
                  ...Object.values(FulfillmentType).map((value) => ({
                    label: value,
                    value,
                  })),
                ]}
              />
              <FilterSelect
                label="Requester role"
                value={filters.requesterRole}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    requesterRole: value as UserRole | typeof ALL_FILTER_VALUE,
                  }))
                }
                options={[
                  { label: 'All requesters', value: ALL_FILTER_VALUE },
                  { label: 'Individual', value: UserRole.INDIVIDUAL },
                  { label: 'CBT Center', value: UserRole.CBT_CENTER },
                ]}
              />
              <FilterSelect
                label="Release state"
                value={filters.releaseState}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    page: 1,
                    releaseState:
                      value as
                        | 'AWAITING_WINDOW'
                        | 'READY_FOR_RELEASE'
                        | 'RELEASED'
                        | typeof ALL_FILTER_VALUE,
                  }))
                }
                options={[
                  { label: 'All release states', value: ALL_FILTER_VALUE },
                  { label: 'In dispute window', value: 'AWAITING_WINDOW' },
                  { label: 'Ready for release', value: 'READY_FOR_RELEASE' },
                  { label: 'Released', value: 'RELEASED' },
                ]}
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Queue size
                </p>
                <p className="mt-2 font-semibold text-slate-900">
                  {meta?.total ?? 0} orders
                </p>
              </div>
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
                title="Admin orders unavailable"
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
          ) : orders.length ? (
            <>
              <div className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => handleSelectOrder(order.id)}
                    className={cn(
                      'w-full rounded-[1.5rem] border p-5 text-left transition',
                      selectedOrderId === order.id
                        ? 'border-[#0D1B3E] bg-[#0D1B3E]/[0.03] shadow-sm'
                        : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white',
                    )}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {order.service.name}
                          </h3>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {order.orderNumber} • {order.requester.firstName}{' '}
                          {order.requester.lastName} • {formatRole(order.requester.role)}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          Business: {order.tenant?.name ?? 'Platform'}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {order.requester.email}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <MetricPill
                          label="Amount"
                          value={formatNaira(order.totalAmount)}
                        />
                        <MetricPill
                          label="Category"
                          value={order.service.category.name}
                        />
                        <MetricPill
                          label="Assigned CBT"
                          value={
                            order.assignedCbt
                              ? `${order.assignedCbt.firstName} ${order.assignedCbt.lastName}`
                              : 'Unassigned'
                          }
                        />
                      </div>
                    </div>
                    {order.releaseState !== 'NOT_READY' ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        Release state:{' '}
                        <span className="font-semibold">
                          {formatReleaseState(order.releaseState)}
                        </span>
                        {order.disputeWindowExpiresAt &&
                        order.releaseState === 'AWAITING_WINDOW'
                          ? ` • ${formatTimeUntil(order.disputeWindowExpiresAt)}`
                          : ''}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
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
                title="No orders match this view"
                message="Try widening the filters to bring more of the platform queue back into view."
                icon={Users}
              />
            </div>
          )}
        </section>

        {!usesMobileSheet ? (
          <section className="overflow-y-auto rounded-[1.75rem] border border-slate-300 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] p-6 shadow-sm ring-1 ring-[#0D1B3E]/5 xl:min-h-0">
            {inspectionContent}
          </section>
        ) : null}
      </div>

      <MobileSheet
        open={isMobileDetailOpen}
        onClose={() => setIsMobileDetailOpen(false)}
        title={detail?.service.name ?? 'Order inspection'}
        description={
          detail
            ? `${detail.orderNumber} • ${formatRole(detail.requester.role)}`
            : 'Inspect the selected queue item.'
        }
      >
        {inspectionContent}
      </MobileSheet>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === OrderStatus.COMPLETED
      ? 'bg-emerald-50 text-emerald-700'
      : status === OrderStatus.PENDING
        ? 'bg-amber-50 text-amber-700'
        : status === OrderStatus.DISPUTED || status === OrderStatus.REFUNDED
          ? 'bg-rose-50 text-rose-700'
          : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function AdminNotesEditor({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useAdminOrderDetail>['order']>;
}) {
  const updateAdminNotes = useUpdateAdminOrderNotes();
  const [adminNotesDraft, setAdminNotesDraft] = useState(detail.adminNotes ?? '');

  const adminNotesChanged = adminNotesDraft !== (detail.adminNotes ?? '');

  const handleSaveAdminNotes = async () => {
    if (!adminNotesChanged) {
      return;
    }

    try {
      const response = await updateAdminNotes.mutateAsync({
        orderId: detail.id,
        adminNotes: adminNotesDraft,
      });
      toast.success(response.message ?? 'Admin notes updated.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save admin notes right now.',
      );
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Admin intervention notes
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Capture manual review notes, escalation context, or release
            preparation guidance for operations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdminNotesDraft(detail.adminNotes ?? '');
          }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <textarea
        value={adminNotesDraft}
        onChange={(event) => setAdminNotesDraft(event.target.value)}
        rows={5}
        placeholder="Add admin notes for support, compliance, or future release handling."
        className="mt-4 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Current note:{' '}
          <span className="font-medium text-slate-700">
            {detail.adminNotes?.trim()
              ? 'Saved on this order'
              : 'No saved admin note yet'}
          </span>
        </p>
        <button
          type="button"
          disabled={!adminNotesChanged || updateAdminNotes.isPending}
          onClick={() => {
            void handleSaveAdminNotes();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateAdminNotes.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ShieldCheck size={16} />
          )}
          {updateAdminNotes.isPending ? 'Saving...' : 'Save admin note'}
        </button>
      </div>
    </>
  );
}

function formatRole(role: UserRole) {
  switch (role) {
    case UserRole.CBT_CENTER:
      return 'CBT Center';
    case UserRole.SUPER_ADMIN:
      return 'Super Admin';
    case UserRole.INDIVIDUAL:
    default:
      return 'Individual';
  }
}

function formatReleaseState(
  releaseState: 'NOT_READY' | 'AWAITING_WINDOW' | 'READY_FOR_RELEASE' | 'RELEASED',
) {
  switch (releaseState) {
    case 'AWAITING_WINDOW':
      return 'In dispute window';
    case 'READY_FOR_RELEASE':
      return 'Ready for release';
    case 'RELEASED':
      return 'Released';
    case 'NOT_READY':
    default:
      return 'Not ready';
  }
}
