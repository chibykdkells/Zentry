'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  CheckCircle,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  ReceiptText,
  ShieldAlert,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { FilePreviewGallery } from '@/components/shared/file-preview-gallery';
import { FilterChipGroup } from '@/components/shared/filter-chip-group';
import { MobileSheet } from '@/components/shared/mobile-sheet';
import { PageHeader } from '@/components/shared/page-header';
import {
  SkeletonBlock,
  SkeletonLine,
} from '@/components/shared/skeleton-loader';
import { useCreateOrderDispute } from '@/hooks/use-disputes';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useOrderDetail, useOrders } from '@/hooks/use-orders';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';
import {
  cleanupOrderUploads,
  uploadOrderFiles,
  type UploadedOrderFile,
} from '@/lib/order-file-uploads';
import {
  ordersEmptyFilters,
  ordersLifecycle,
} from '@/lib/service-catalog';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@zendocx/types';

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] =
    useState<(typeof ordersEmptyFilters)[number]['id']>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    () => searchParams.get('order'),
  );
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');

  useEffect(() => {
    const id = searchParams.get('order');
    if (id) {
      setSelectedOrderId(id);
      if (usesMobileSheet) setIsMobileDetailOpen(true);
    }
  }, [searchParams, usesMobileSheet]);
  const { metrics, orders, loading, error, reload } = useOrders();
  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'active') {
          return [
            OrderStatus.PENDING,
            OrderStatus.ASSIGNED,
            OrderStatus.IN_PROGRESS,
          ].includes(order.status);
        }
        if (activeFilter === 'completed') {
          return order.status === OrderStatus.COMPLETED;
        }
        if (activeFilter === 'issues') {
          return [OrderStatus.DISPUTED, OrderStatus.RESOLVED, OrderStatus.REFUNDED].includes(
            order.status,
          );
        }

        return true;
      }),
    [activeFilter, orders],
  );
  const effectiveSelectedOrderId = visibleOrders.some(
    (order) => order.id === selectedOrderId,
  )
    ? selectedOrderId
    : (visibleOrders[0]?.id ?? null);
  const selectedOrder =
    visibleOrders.find((order) => order.id === effectiveSelectedOrderId) ?? null;
  const {
    order: detail,
    loading: detailLoading,
    error: detailError,
    reload: reloadDetail,
  } = useOrderDetail(effectiveSelectedOrderId);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (usesMobileSheet) {
      setIsMobileDetailOpen(true);
    }
  };

  const detailContent = (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy/55">
            Review workspace
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Order detail
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the current state of the selected request.
          </p>
        </div>
        {selectedOrder ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {selectedOrder.orderNumber}
          </span>
        ) : null}
      </div>

      {detailLoading ? (
        <div className="mt-6 space-y-4">
          <SkeletonBlock className="h-28 rounded-3xl" />
          <SkeletonBlock className="h-36 rounded-3xl" />
          <SkeletonBlock className="h-24 rounded-3xl" />
        </div>
      ) : detailError ? (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Order detail unavailable"
            message={detailError}
            icon={ReceiptText}
            action={
              <button
                type="button"
                onClick={reloadDetail}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Try again
              </button>
            }
          />
        </div>
      ) : detail ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricPill label="Fulfillment" value={detail.fulfillmentType} />
            <MetricPill
              label={
                detail.fulfillmentType === 'AUTOMATED'
                  ? 'Amount charged'
                  : 'Amount on hold'
              }
              value={formatNaira(detail.totalAmount)}
            />
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Submitted information
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
            files={detail.requesterDocuments}
            emptyMessage="No supporting files were attached to this request."
          />

          {detail.fulfillmentType === 'AUTOMATED' && detail.providerResponse ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5">
              <h3 className="text-sm font-semibold text-emerald-900">
                Your delivery
              </h3>
              <p className="mt-1 text-sm text-emerald-700">
                Your service has been delivered. See the details below.
              </p>

              {/* Prominent token card for electricity */}
              {typeof detail.providerResponse.token === 'string' ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    Electricity token
                  </p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-lg font-bold tracking-widest text-slate-900">
                      {String(detail.providerResponse.token)}
                    </p>
                    <CopyButton value={String(detail.providerResponse.token)} />
                  </div>
                  {typeof detail.providerResponse.units === 'number' ? (
                    <p className="mt-2 text-xs text-emerald-700">
                      {String(detail.providerResponse.units)} units
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Smartcard/IUC number for cable TV — copyable */}
              {typeof detail.providerResponse.smartcardNumber === 'string' &&
              typeof detail.providerResponse.token !== 'string' ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    {typeof detail.providerResponse.bouquetName === 'string'
                      ? 'Cable TV subscription'
                      : 'Smartcard / IUC'}
                  </p>
                  {typeof detail.providerResponse.bouquetName === 'string' ? (
                    <p className="mt-2 text-base font-bold text-slate-900">
                      {String(detail.providerResponse.bouquetName)}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <p className="font-mono text-sm text-slate-700">
                      {String(detail.providerResponse.smartcardNumber)}
                    </p>
                    <CopyButton
                      value={String(detail.providerResponse.smartcardNumber)}
                    />
                  </div>
                </div>
              ) : null}

              {/* Plan confirmation for data */}
              {typeof detail.providerResponse.planName === 'string' &&
              typeof detail.providerResponse.token !== 'string' ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    Data plan activated
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {String(detail.providerResponse.planName)}
                  </p>
                  {typeof detail.providerResponse.phone === 'string' ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Delivered to{' '}
                      <span className="font-medium text-slate-700">
                        {String(detail.providerResponse.phone)}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Secondary details */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {detail.providerReference ? (
                  <MetricPill
                    label="Provider reference"
                    value={detail.providerReference}
                  />
                ) : null}
                {typeof detail.providerResponse.network === 'string' ? (
                  <MetricPill
                    label="Network"
                    value={String(detail.providerResponse.network)}
                  />
                ) : null}
                {typeof detail.providerResponse.disco === 'string' ? (
                  <MetricPill
                    label="Disco"
                    value={String(detail.providerResponse.disco)}
                  />
                ) : null}
                {typeof detail.providerResponse.customerName === 'string' ? (
                  <MetricPill
                    label="Customer name"
                    value={String(detail.providerResponse.customerName)}
                  />
                ) : null}
                {typeof detail.providerResponse.phone === 'string' &&
                typeof detail.providerResponse.planName !== 'string' ? (
                  <MetricPill
                    label="Delivered to"
                    value={String(detail.providerResponse.phone)}
                  />
                ) : null}
                {typeof detail.providerResponse.meterNumber === 'string' ? (
                  <MetricPill
                    label="Meter number"
                    value={String(detail.providerResponse.meterNumber)}
                  />
                ) : null}
                {typeof detail.providerResponse.meterType === 'string' ? (
                  <MetricPill
                    label="Meter type"
                    value={String(detail.providerResponse.meterType)}
                  />
                ) : null}
                {typeof detail.providerResponse.amountKobo === 'string' ? (
                  <MetricPill
                    label="Amount paid to provider"
                    value={formatNaira(
                      String(detail.providerResponse.amountKobo),
                    )}
                  />
                ) : null}
                {typeof detail.providerResponse.providerStatus === 'string' ? (
                  <MetricPill
                    label="Provider status"
                    value={String(detail.providerResponse.providerStatus)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Order timeline
            </h3>
            <div className="mt-4 space-y-3">
              <TimelineRow label="Submitted" value={formatDate(detail.createdAt)} />
              <TimelineRow
                label="Completed"
                value={detail.completedAt ? formatDate(detail.completedAt) : 'Pending'}
              />
              <TimelineRow
                label="Result uploaded"
                value={
                  detail.resultUploadedAt
                    ? formatDate(detail.resultUploadedAt)
                    : 'Not yet'
                }
              />
              <TimelineRow
                label="Dispute window"
                value={
                  detail.disputeWindowExpiresAt
                    ? `Until ${formatDate(detail.disputeWindowExpiresAt)}`
                    : detail.fulfillmentType === 'AUTOMATED'
                      ? 'Not applicable'
                      : 'Starts after completion'
                }
              />
              <TimelineRow
                label="Payment released"
                value={
                  detail.escrowReleasedAt
                    ? formatDate(detail.escrowReleasedAt)
                    : detail.fulfillmentType === 'AUTOMATED'
                      ? 'Processed instantly'
                      : 'Pending'
                }
              />
            </div>
          </div>

          {detail.resultFileUrl ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
              <h3 className="text-sm font-semibold text-emerald-900">
                Result available
              </h3>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Your CBT center has uploaded the result. Open or download it
                below, and raise a dispute if anything is wrong before the
                window closes.
              </p>

              {detail.cbtNotes ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    Note from CBT center
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {detail.cbtNotes}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricPill
                  label="Release state"
                  value={
                    detail.releaseState === 'AWAITING_WINDOW'
                      ? 'In dispute window'
                      : detail.releaseState === 'READY_FOR_RELEASE'
                        ? 'Awaiting release'
                        : detail.releaseState === 'RELEASED'
                          ? 'Released'
                          : 'Not ready'
                  }
                />
                <MetricPill
                  label="Window status"
                  value={
                    detail.disputeWindowExpiresAt
                      ? formatTimeUntil(detail.disputeWindowExpiresAt)
                      : 'Pending'
                  }
                />
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
                <iframe
                  src={detail.resultFileUrl}
                  title="Result file preview"
                  className="h-72 w-full border-0"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`${detail.resultFileUrl}&download=1`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  <Download size={14} />
                  Download result
                </a>
                <a
                  href={detail.resultFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  <ExternalLink size={14} />
                  Open in new tab
                </a>
              </div>
              {detail.disputeWindowExpiresAt ? (
                <div className="mt-4 inline-flex items-center justify-center rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-emerald-800">
                  Review window closes {formatDate(detail.disputeWindowExpiresAt)}
                </div>
              ) : null}
            </div>
          ) : null}

          {detail.dispute ? (
            <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-5">
              <h3 className="text-sm font-semibold text-rose-900">
                Dispute context
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricPill
                  label="Status"
                  value={detail.dispute.status.replaceAll('_', ' ')}
                />
                <MetricPill
                  label="Opened"
                  value={formatDate(detail.dispute.createdAt)}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-rose-800">
                {detail.dispute.reason}
              </p>
              {detail.dispute.resolutionNote ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900">
                  <p className="font-semibold">Resolution note</p>
                  <p className="mt-2 leading-6">
                    {detail.dispute.resolutionNote}
                  </p>
                </div>
              ) : null}
              <div className="mt-4">
                <FilePreviewGallery
                  title="Evidence files"
                  files={detail.dispute.evidenceFiles}
                  emptyMessage="No evidence files were attached to this dispute."
                  className="border-rose-200 bg-white/70"
                />
              </div>
            </div>
          ) : canRaiseDispute(detail) ? (
            <CreateDisputePanel detail={detail} />
          ) : (
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                What happens next
              </h3>
              <div className="mt-4 space-y-3">
                {ordersLifecycle.slice(0, 3).map((step, index) => (
                  <div
                    key={step.title}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title="Select an order"
            message="Choose a request from the list to inspect its current state, uploaded files, and next steps."
            icon={ReceiptText}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:flex md:h-full md:flex-col xl:overflow-hidden md:space-y-6 md:p-8">
      <PageHeader
        title="My Orders"
        description="Track your service requests from submission to completion."
        actions={
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
          >
            Browse services
            <ArrowRight size={16} />
          </Link>
        }
      />

      <div className="grid gap-5 md:gap-6 xl:h-[calc(100vh-12rem)] xl:grid-cols-[1.05fr_0.95fr] xl:overflow-hidden">
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6 xl:flex xl:min-h-0 xl:flex-col">
          <div className="flex items-center justify-between gap-4">
            <FilterChipGroup
              value={activeFilter}
              onChange={(value) =>
                setActiveFilter(value as (typeof ordersEmptyFilters)[number]['id'])
              }
              options={ordersEmptyFilters.map((filter) => ({
                id: filter.id,
                label: filter.label,
              }))}
            />
            {metrics && (
              <p className="shrink-0 text-xs text-slate-400">
                {metrics.all} order{metrics.all !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {loading ? (
            <div className="mt-6 space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
              {Array.from({ length: 3 }).map((_, index) => (
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
                title="Orders unavailable"
                message={error}
                icon={ClipboardList}
                action={
                  <button
                    type="button"
                    onClick={reload}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            </div>
          ) : visibleOrders.length ? (
            <div className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {visibleOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => handleSelectOrder(order.id)}
                  className={cn(
                    'w-full rounded-[1.5rem] border px-4 py-4 text-left transition',
                    selectedOrder?.id === order.id
                      ? 'border-brand-navy bg-brand-navy/[0.03] shadow-sm'
                      : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {order.service.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {order.orderNumber} · {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={order.status} />
                      <span className="text-xs font-medium text-slate-500">
                        {formatNaira(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                  {order.resultFileUrl ? (
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Result ready
                      {order.disputeWindowExpiresAt
                        ? ` · ${formatTimeUntil(order.disputeWindowExpiresAt)}`
                        : ''}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="No orders to display yet"
                message="As soon as service requests start flowing from the catalog, they will appear here under the selected status."
                icon={ClipboardList}
                action={
                  <Link
                    href="/services"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Explore services
                    <ArrowRight size={16} />
                  </Link>
                }
              />
            </div>
          )}
        </section>

        {!usesMobileSheet ? (
          <section className="overflow-y-auto rounded-[1.75rem] border border-slate-300 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] p-6 shadow-sm ring-1 ring-[#0D1B3E]/5 xl:min-h-0">
            {detailContent}
          </section>
        ) : null}
      </div>

      <MobileSheet
        open={isMobileDetailOpen}
        onClose={() => setIsMobileDetailOpen(false)}
        title={selectedOrder?.service.name ?? 'Order detail'}
        description={
          selectedOrder
            ? `${selectedOrder.orderNumber} • ${selectedOrder.service.category.name}`
            : 'Review the current state of this request.'
        }
      >
        {detailContent}
      </MobileSheet>
    </div>
  );
}

function CreateDisputePanel({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useOrderDetail>['order']>;
}) {
  const createDispute = useCreateOrderDispute();
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');
  const [reason, setReason] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const handleSubmit = async () => {
    let uploadedEvidenceFiles: UploadedOrderFile[] = [];

    try {
      setUploadingEvidence(true);
      uploadedEvidenceFiles = await uploadOrderFiles(evidenceFiles);
      const response = await createDispute.mutateAsync({
        orderId: detail.id,
        reason,
        evidenceFiles: uploadedEvidenceFiles,
      });
      toast.success(response.message ?? 'Dispute created successfully.');
      setReason('');
      setEvidenceFiles([]);
    } catch (error) {
      if (uploadedEvidenceFiles.length > 0) {
        await cleanupOrderUploads(uploadedEvidenceFiles).catch(() => undefined);
      }

      toast.error(getApiErrorMessage(error, 'Could not create the dispute right now.'));
    } finally {
      setUploadingEvidence(false);
    }
  };

  return (
    <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-rose-900">
            Raise a dispute
          </h3>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            This completed CBT order is still inside its dispute window. Add a
            clear reason before opening a live review case.
          </p>
        </div>
        <span className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-medium text-rose-800">
          Window closes {formatDate(detail.disputeWindowExpiresAt!)}
        </span>
      </div>

      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={4}
        placeholder="Explain what is wrong with the delivered result and what needs review."
        className="mt-4 w-full rounded-3xl border border-rose-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
      />

      <label className="mt-3 block">
        <span className="mb-2 block text-sm font-medium text-rose-900">
          Optional evidence files
        </span>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(event) =>
            setEvidenceFiles(Array.from(event.target.files ?? []))
          }
          className="block w-full rounded-3xl border border-dashed border-rose-200 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-rose-900 hover:file:bg-rose-200"
        />
        <span className="mt-2 block text-xs text-rose-800/80">
          Attach screenshots, PDFs, or photos up to 5MB each. These files will
          be uploaded with the dispute instead of pasted as links.
        </span>
      </label>

      {evidenceFiles.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {evidenceFiles.map((file) => (
            <span
              key={`${file.name}-${file.lastModified}`}
              className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-900"
            >
              {file.name}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          'mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
          usesMobileSheet
            ? 'sticky bottom-0 -mx-5 mt-5 border-t border-rose-100 bg-rose-50/95 px-5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm'
            : '',
        )}
      >
        <p className="text-sm text-rose-800">
          Once opened, the order is paused from release handling until admin
          review is complete.
        </p>
        <button
          type="button"
          disabled={
            reason.trim().length < 10 ||
            createDispute.isPending ||
            uploadingEvidence
          }
          onClick={() => {
            void handleSubmit();
          }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createDispute.isPending || uploadingEvidence
            ? 'Submitting...'
            : 'Open dispute'}
        </button>
      </div>
    </div>
  );
}

function canRaiseDispute(
  detail: NonNullable<ReturnType<typeof useOrderDetail>['order']>,
) {
  if (detail.fulfillmentType !== 'MANUAL') {
    return false;
  }

  if (detail.status !== OrderStatus.COMPLETED) {
    return false;
  }

  if (!detail.resultFileUrl || !detail.disputeWindowExpiresAt) {
    return false;
  }

  if (detail.escrowReleasedAt || detail.dispute) {
    return false;
  }

  return new Date(detail.disputeWindowExpiresAt).getTime() > Date.now();
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === OrderStatus.PENDING
      ? 'bg-amber-100 text-amber-700'
      : status === OrderStatus.ASSIGNED
        ? 'bg-blue-100 text-blue-700'
        : status === OrderStatus.IN_PROGRESS
          ? 'bg-cyan-100 text-cyan-700'
          : status === OrderStatus.COMPLETED
            ? 'bg-emerald-100 text-emerald-700'
            : status === OrderStatus.DISPUTED
              ? 'bg-rose-100 text-rose-700'
              : 'bg-slate-100 text-slate-500';

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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
    >
      {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
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
