'use client';

import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { WithdrawalStatus } from '@zendocx/types';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import {
  useAdminWithdrawalRequests,
  useReviewWithdrawalRequest,
} from '@/hooks/use-withdrawal-requests';
import { formatDate, formatNaira } from '@/lib/format';

const ALL_STATUS = 'ALL';

const statusOptions: Array<{
  label: string;
  value: WithdrawalStatus | typeof ALL_STATUS;
}> = [
  { label: 'All statuses', value: ALL_STATUS },
  { label: 'Pending', value: WithdrawalStatus.PENDING },
  { label: 'Approved', value: WithdrawalStatus.APPROVED },
  { label: 'Processing', value: WithdrawalStatus.PROCESSING },
  { label: 'Completed', value: WithdrawalStatus.COMPLETED },
  { label: 'Rejected', value: WithdrawalStatus.REJECTED },
];

export function AdminWithdrawalReview() {
  const [filters, setFilters] = useState<{
    page: number;
    status: WithdrawalStatus | typeof ALL_STATUS;
    search: string;
  }>({
    page: 1,
    status: ALL_STATUS,
    search: '',
  });

  const {
    requests,
    summary,
    meta,
    loading,
    error,
    reload,
  } = useAdminWithdrawalRequests({
    page: filters.page,
    limit: 6,
    status: filters.status,
    search: filters.search,
  });

  const summaryCards = useMemo(
    () =>
      summary
        ? [
            {
              label: 'Pending review',
              value: `${formatNaira(summary.pendingAmount)} · ${summary.pendingCount}`,
            },
            {
              label: 'Approved',
              value: `${formatNaira(summary.approvedAmount)} · ${summary.approvedCount}`,
            },
            {
              label: 'Processing',
              value: `${formatNaira(summary.processingAmount)} · ${summary.processingCount}`,
            },
            {
              label: 'Completed',
              value: `${formatNaira(summary.completedAmount)} · ${summary.completedCount}`,
            },
          ]
        : [],
    [summary],
  );

  return (
    <AccountPanel
      title="Withdrawal payout review"
      description="Review user withdrawal requests, approve the ones ready for payout, and keep reserved wallet balances in sync with gateway outcomes."
      contentClassName="space-y-4"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <label className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">
            Search
          </span>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={filters.search}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  search: event.target.value,
                }));
              }}
              placeholder="Search by user name or email"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">
            Status
          </span>
          <select
            value={filters.status}
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                page: 1,
                status: event.target.value as WithdrawalStatus | typeof ALL_STATUS,
              }));
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setFilters({
              page: 1,
              status: ALL_STATUS,
              search: '',
            });
          }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:self-end"
        >
          Clear filters
        </button>
      </div>

      {summaryCards.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
            >
              <p className="text-sm font-semibold text-slate-900">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="Withdrawal review unavailable"
          message={error}
          icon={Loader2}
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
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
            >
              <div className="h-5 w-40 rounded-xl bg-slate-100" />
              <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : requests.length ? (
        <div className="space-y-4">
          {requests.map((request) => (
            <WithdrawalReviewCard key={request.id} request={request} />
          ))}

          {meta ? (
            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                Showing page {meta.page} of {Math.max(meta.totalPages, 1)} for{' '}
                {meta.total} withdrawal request{meta.total === 1 ? '' : 's'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFilters((current) => ({
                      ...current,
                      page: Math.max(current.page - 1, 1),
                    }));
                  }}
                  disabled={meta.page <= 1}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters((current) => ({
                      ...current,
                      page: current.page + 1,
                    }));
                  }}
                  disabled={!meta.hasNextPage}
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
          title="No withdrawal requests matched"
          message="Try broadening the filters or wait for new withdrawal requests to come in."
          icon={Loader2}
        />
      )}
    </AccountPanel>
  );
}

function WithdrawalReviewCard({
  request,
}: {
  request: ReturnType<typeof useAdminWithdrawalRequests>['requests'][number];
}) {
  const mutation = useReviewWithdrawalRequest();
  const [note, setNote] = useState(request.processorNote ?? '');
  const [gatewayRef, setGatewayRef] = useState(request.gatewayRef ?? '');

  const canApprove = request.status === WithdrawalStatus.PENDING;
  const canProcess = request.status === WithdrawalStatus.APPROVED;
  const canComplete =
    request.status === WithdrawalStatus.APPROVED ||
    request.status === WithdrawalStatus.PROCESSING;
  const canReject =
    request.status === WithdrawalStatus.PENDING ||
    request.status === WithdrawalStatus.APPROVED ||
    request.status === WithdrawalStatus.PROCESSING;

  const update = (
    status:
      | WithdrawalStatus.APPROVED
      | WithdrawalStatus.PROCESSING
      | WithdrawalStatus.COMPLETED
      | WithdrawalStatus.REJECTED,
  ) => {
    mutation.mutate({
      withdrawalRequestId: request.id,
      status,
      note,
      gatewayRef,
    });
  };

  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {request.user.firstName} {request.user.lastName}
            </p>
            <span className={statusBadgeClassName(request.status)}>
              {request.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-slate-500">{request.user.email}</p>
          <p className="text-sm text-slate-500">
            {request.bankName} · {request.accountName} · {request.accountNumber}
          </p>
          <p className="text-xs text-slate-400">
            Requested {formatDate(request.createdAt)}
            {request.processedAt ? ` · Processed ${formatDate(request.processedAt)}` : ''}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Amount" value={formatNaira(request.amount)} />
          <Metric label="Gateway ref" value={request.gatewayRef ?? 'Pending'} />
          <Metric label="Last note" value={request.processorNote ?? 'No note'} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
        <label className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Admin note
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            placeholder="Add review or payout note"
          />
        </label>

        <label className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Payout reference
          </span>
          <input
            value={gatewayRef}
            onChange={(event) => setGatewayRef(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            placeholder="Optional payout ref"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <ActionButton
          label="Approve"
          onClick={() => update(WithdrawalStatus.APPROVED)}
          disabled={!canApprove || mutation.isPending}
        />
        <ActionButton
          label="Mark processing"
          onClick={() => update(WithdrawalStatus.PROCESSING)}
          disabled={!canProcess || mutation.isPending}
        />
        <ActionButton
          label="Complete payout"
          onClick={() => update(WithdrawalStatus.COMPLETED)}
          disabled={!canComplete || mutation.isPending}
        />
        <ActionButton
          label="Reject"
          onClick={() => update(WithdrawalStatus.REJECTED)}
          disabled={!canReject || mutation.isPending}
          danger
        />
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function statusBadgeClassName(status: WithdrawalStatus) {
  switch (status) {
    case WithdrawalStatus.PENDING:
      return 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700';
    case WithdrawalStatus.APPROVED:
      return 'rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700';
    case WithdrawalStatus.PROCESSING:
      return 'rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700';
    case WithdrawalStatus.COMPLETED:
      return 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700';
    case WithdrawalStatus.REJECTED:
      return 'rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700';
    default:
      return 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600';
  }
}
