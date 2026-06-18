'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { OrderStatus } from '@zendocx/types';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  XCircle,
} from 'lucide-react';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useTenantAdminOrders,
  useTenantAdminOrderDetail,
  useTenantAdminDisputes,
  useUpdateOrderNotes,
  useReviewDispute,
  type TenantAdminOrderSummary,
  type TenantAdminDisputeFilters,
  type TenantAdminOrderFilters,
} from '@/hooks/use-tenant-admin-orders';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Status config ─────────────────────────────────────────────────────────────

const ORDER_STATUS_STYLES: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
  [OrderStatus.ASSIGNED]: 'bg-blue-50 text-blue-700 border-blue-200',
  [OrderStatus.IN_PROGRESS]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [OrderStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [OrderStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200',
  [OrderStatus.DISPUTED]: 'bg-rose-50 text-rose-700 border-rose-200',
  [OrderStatus.REFUNDED]: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_TABS: Array<{ label: string; value: OrderStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: OrderStatus.PENDING },
  { label: 'Assigned', value: OrderStatus.ASSIGNED },
  { label: 'In Progress', value: OrderStatus.IN_PROGRESS },
  { label: 'Completed', value: OrderStatus.COMPLETED },
  { label: 'Disputed', value: OrderStatus.DISPUTED },
];

const DISPUTE_ACTIONS = [
  { value: 'ACCEPT_AND_REFUND', label: 'Refund requester', color: 'emerald' },
  { value: 'REJECT_DISPUTE', label: 'Dismiss dispute (pay CBT)', color: 'blue' },
  { value: 'REQUEST_REDO', label: 'Request redo', color: 'amber' },
];

type ActiveTab = 'orders' | 'disputes';

// ─── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3',
      highlight ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-white',
    )}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', highlight ? 'text-rose-700' : 'text-slate-900')}>
        {value}
      </p>
    </div>
  );
}

// ─── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({ order, onClick }: { order: TenantAdminOrderSummary; onClick: () => void }) {
  const statusStyle = ORDER_STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  const cbtName = order.assignedCbt
    ? (order.assignedCbt.cbtProfile?.centerName
        ?? `${order.assignedCbt.firstName} ${order.assignedCbt.lastName}`)
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50/60"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{order.orderNumber}</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', statusStyle)}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="truncate text-xs text-slate-500">{order.service.name}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <User size={10} />
            {order.requester.firstName} {order.requester.lastName}
          </span>
          {cbtName ? (
            <span className="flex items-center gap-1">
              <ClipboardList size={10} />
              {cbtName}
            </span>
          ) : (
            <span className="text-amber-500">Unclaimed</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-slate-900">{formatNaira(order.totalAmount)}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(order.createdAt)}</p>
      </div>
    </button>
  );
}

// ─── Order detail panel ────────────────────────────────────────────────────────

function OrderDetailPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { order, loading, error } = useTenantAdminOrderDetail(orderId);
  const updateNotes = useUpdateOrderNotes();
  const reviewDispute = useReviewDispute();

  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [disputeAction, setDisputeAction] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const handleSaveNotes = async () => {
    if (!order) return;
    try {
      await updateNotes.mutateAsync({ orderId: order.id, adminNotes: notes });
      toast.success('Notes saved');
      setEditingNotes(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save notes'));
    }
  };

  const handleReviewDispute = async () => {
    if (!order || !disputeAction) return;
    try {
      const res = await reviewDispute.mutateAsync({
        orderId: order.id,
        action: disputeAction,
        resolutionNote: resolutionNote.trim() || undefined,
      });
      toast.success(res.message ?? 'Dispute reviewed');
      setShowDisputeForm(false);
      setDisputeAction('');
      setResolutionNote('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not process dispute'));
    }
  };

  return (
    <DetailModal open onClose={onClose} title="Order detail" width="lg">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : error ? (
        <EmptyState title="Could not load order" message={error} icon={AlertTriangle} />
      ) : !order ? null : (
        <div className="space-y-4">

          {/* Status + order number */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Order</p>
              <p className="mt-0.5 font-mono text-base font-bold text-slate-900">{order.orderNumber}</p>
            </div>
            <span className={cn(
              'rounded-full border px-3 py-1 text-xs font-bold',
              ORDER_STATUS_STYLES[order.status as OrderStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200',
            )}>
              {String(order.status).replace(/_/g, ' ')}
            </span>
          </div>

          {/* Service + amounts */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'Service', value: (order as unknown as { service?: { name?: string } }).service?.name ?? '—' },
              { label: 'Total', value: formatNaira(String((order as unknown as { totalAmount?: string }).totalAmount ?? '0')) },
              { label: 'CBT commission', value: formatNaira(String((order as unknown as { cbtCommission?: string }).cbtCommission ?? '0')) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Requester */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Requester</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {(order as unknown as { requester?: { firstName?: string; lastName?: string } }).requester?.firstName}{' '}
              {(order as unknown as { requester?: { firstName?: string; lastName?: string } }).requester?.lastName}
            </p>
            <p className="text-xs text-slate-500">{(order as unknown as { requester?: { email?: string } }).requester?.email}</p>
          </div>

          {/* Assigned CBT */}
          {(order as unknown as { assignedCbt?: unknown }).assignedCbt ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">Assigned CBT center</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {((order as unknown as { assignedCbt?: { cbtProfile?: { centerName?: string }; firstName?: string; lastName?: string } }).assignedCbt?.cbtProfile?.centerName)
                  ?? `${(order as unknown as { assignedCbt?: { firstName?: string } }).assignedCbt?.firstName ?? ''} ${(order as unknown as { assignedCbt?: { lastName?: string } }).assignedCbt?.lastName ?? ''}`.trim()
                  || '—'}
              </p>
              <p className="text-xs text-slate-500">{(order as unknown as { assignedCbt?: { email?: string } }).assignedCbt?.email}</p>
              {(order as unknown as { assignedAt?: string }).assignedAt ? (
                <p className="mt-1 text-xs text-blue-600">
                  Claimed {formatDate((order as unknown as { assignedAt?: string }).assignedAt!)}
                </p>
              ) : null}
              {(order as unknown as { deliveryDeadline?: string }).deliveryDeadline ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                  <Clock size={11} />
                  Deadline: {formatDate((order as unknown as { deliveryDeadline?: string }).deliveryDeadline!)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-700">No CBT center assigned yet</p>
              <p className="text-xs text-amber-600">This job is still in the pool awaiting a claim.</p>
            </div>
          )}

          {/* Dispute */}
          {(order as unknown as { dispute?: unknown }).dispute ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-rose-600" />
                <p className="text-sm font-bold text-rose-700">
                  Active dispute — {String((order as unknown as { dispute?: { status?: string } }).dispute?.status ?? '').replace(/_/g, ' ')}
                </p>
              </div>
              <p className="text-sm text-rose-700">
                {(order as unknown as { dispute?: { reason?: string } }).dispute?.reason ?? '—'}
              </p>

              {!showDisputeForm ? (
                <button
                  type="button"
                  onClick={() => setShowDisputeForm(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <ShieldAlert size={13} /> Review dispute
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {DISPUTE_ACTIONS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setDisputeAction(a.value)}
                        className={cn(
                          'rounded-2xl border px-3 py-2 text-xs font-semibold transition',
                          disputeAction === a.value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Resolution note (optional)…"
                    rows={2}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!disputeAction || reviewDispute.isPending}
                      onClick={() => { void handleReviewDispute(); }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {reviewDispute.isPending
                        ? <Loader2 size={13} className="animate-spin" />
                        : <CheckCircle2 size={13} />}
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDisputeForm(false); setDisputeAction(''); setResolutionNote(''); }}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Result document */}
          {(order as unknown as { resultFileUrl?: string }).resultFileUrl ? (
            <a
              href={(order as unknown as { resultFileUrl?: string }).resultFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <ClipboardList size={14} />
              View result document
            </a>
          ) : null}

          {/* Admin notes */}
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare size={14} /> Admin notes
              </p>
              {!editingNotes ? (
                <button
                  type="button"
                  onClick={() => {
                    setNotes((order as unknown as { adminNotes?: string }).adminNotes ?? '');
                    setEditingNotes(true);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  {(order as unknown as { adminNotes?: string }).adminNotes ? 'Edit' : 'Add note'}
                </button>
              ) : null}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal note about this order…"
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={updateNotes.isPending}
                    onClick={() => { void handleSaveNotes(); }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132754] disabled:opacity-60"
                  >
                    {updateNotes.isPending
                      ? <Loader2 size={13} className="animate-spin" />
                      : <CheckCircle2 size={13} />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNotes(false)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (order as unknown as { adminNotes?: string }).adminNotes ? (
              <p className="text-sm text-slate-700">{(order as unknown as { adminNotes?: string }).adminNotes}</p>
            ) : (
              <p className="text-sm italic text-slate-400">No notes yet</p>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>
              <span className="font-semibold">Created</span>
              <p>{formatDate((order as unknown as { createdAt?: string }).createdAt ?? '')}</p>
            </div>
            {(order as unknown as { completedAt?: string }).completedAt ? (
              <div>
                <span className="font-semibold">Completed</span>
                <p>{formatDate((order as unknown as { completedAt?: string }).completedAt!)}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </DetailModal>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TenantOrdersPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('orders');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dispute tab state
  const [disputeSearch, setDisputeSearch] = useState('');
  const [debouncedDisputeSearch, setDebouncedDisputeSearch] = useState('');
  const [disputePage, setDisputePage] = useState(1);
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('ALL');
  const disputeSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderFilters: TenantAdminOrderFilters = {
    page,
    limit: 15,
    search: debouncedSearch || undefined,
    status: statusFilter,
  };

  const disputeFilters: TenantAdminDisputeFilters = {
    page: disputePage,
    limit: 15,
    search: debouncedDisputeSearch || undefined,
    status: disputeStatusFilter,
  };

  const { metrics, orders, meta, loading, error, reload } = useTenantAdminOrders(orderFilters);
  const { metrics: dMetrics, disputes, meta: dMeta, loading: dLoading, error: dError, reload: dReload } =
    useTenantAdminDisputes(disputeFilters);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const handleDisputeSearchChange = (val: string) => {
    setDisputeSearch(val);
    if (disputeSearchTimerRef.current) clearTimeout(disputeSearchTimerRef.current);
    disputeSearchTimerRef.current = setTimeout(() => {
      setDebouncedDisputeSearch(val);
      setDisputePage(1);
    }, 400);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Orders"
        description="View all jobs, track CBT assignments, and manage disputes."
      />

      {/* Metrics row */}
      {metrics ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="All" value={metrics.all} />
          <MetricCard label="Active" value={metrics.active} />
          <MetricCard label="Completed" value={metrics.completed} />
          <MetricCard label="Issues" value={metrics.issues} highlight={metrics.issues > 0} />
          <MetricCard label="Awaiting release" value={metrics.awaitingRelease} />
          <MetricCard label="Ready for release" value={metrics.readyForRelease} />
        </div>
      ) : null}

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-semibold transition',
            activeTab === 'orders'
              ? 'border-[#0D1B3E] bg-[#0D1B3E] text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          Orders
          {metrics ? (
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{metrics.all}</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('disputes')}
          className={cn(
            'relative rounded-full border px-4 py-2 text-sm font-semibold transition',
            activeTab === 'disputes'
              ? 'border-rose-600 bg-rose-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          Disputes
          {dMetrics && dMetrics.open > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
              {dMetrics.open}
            </span>
          ) : null}
        </button>
      </div>

      {/* ── Orders tab ── */}
      {activeTab === 'orders' ? (
        <div className="space-y-4">
          {/* Search + status filter */}
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search order number, service, requester…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-300"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XCircle size={14} />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => reload()}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
                  statusFilter === tab.value
                    ? 'border-[#0D1B3E] bg-[#0D1B3E] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-[72px] rounded-2xl" />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                title="Orders unavailable"
                message={error}
                icon={ClipboardList}
                action={
                  <button
                    type="button"
                    onClick={() => reload()}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            ) : orders.length ? (
              <div className="space-y-2">
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onClick={() => setSelectedOrderId(order.id)}
                  />
                ))}

                {meta && meta.totalPages > 1 ? (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                    <p>Page {meta.page} of {meta.totalPages} · {meta.total} orders</p>
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
                title="No orders found"
                message={
                  debouncedSearch
                    ? 'No orders match your search.'
                    : statusFilter !== 'ALL'
                      ? `No ${statusFilter.toLowerCase().replace(/_/g, ' ')} orders in this portal.`
                      : 'Orders placed by your users will appear here.'
                }
                icon={ClipboardList}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* ── Disputes tab ── */}
      {activeTab === 'disputes' ? (
        <div className="space-y-4">
          {/* Dispute metrics */}
          {dMetrics ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <MetricCard label="Total" value={dMetrics.total} />
              <MetricCard label="Open" value={dMetrics.open} highlight={dMetrics.open > 0} />
              <MetricCard label="Under review" value={dMetrics.underReview} />
              <MetricCard label="Redo requested" value={dMetrics.redoRequested} />
              <MetricCard label="Resolved" value={dMetrics.resolved} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search order, service, email…"
                value={disputeSearch}
                onChange={(e) => handleDisputeSearchChange(e.target.value)}
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-300"
              />
            </div>
            <button
              type="button"
              onClick={() => dReload()}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            {dLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : dError ? (
              <EmptyState title="Disputes unavailable" message={dError} icon={AlertTriangle} />
            ) : disputes.length ? (
              <div className="space-y-2">
                {disputes.map((dispute) => {
                  const cbt = dispute.order.assignedCbt;
                  const cbtName = cbt
                    ? (cbt.cbtProfile?.centerName ?? `${cbt.firstName} ${cbt.lastName}`)
                    : 'No CBT';
                  return (
                    <button
                      key={dispute.id}
                      type="button"
                      onClick={() => setSelectedOrderId(dispute.order.id)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-left transition hover:bg-rose-50"
                    >
                      <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-500" />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{dispute.order.orderNumber}</span>
                          <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            {dispute.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{dispute.order.service.name} · {cbtName}</p>
                        <p className="line-clamp-1 text-xs text-rose-700">{dispute.reason}</p>
                      </div>
                      <p className="shrink-0 text-[11px] text-slate-400">{formatDate(dispute.createdAt)}</p>
                    </button>
                  );
                })}

                {dMeta && dMeta.totalPages > 1 ? (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                    <p>Page {dMeta.page} of {dMeta.totalPages}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={dMeta.page <= 1}
                        onClick={() => setDisputePage((p) => Math.max(p - 1, 1))}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={dMeta.page >= dMeta.totalPages}
                        onClick={() => setDisputePage((p) => Math.min(p + 1, dMeta.totalPages))}
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
                title="No disputes"
                message="Disputes raised by requesters will appear here for your review."
                icon={ShieldAlert}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Order detail modal */}
      {selectedOrderId ? (
        <OrderDetailPanel
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      ) : null}
    </div>
  );
}
