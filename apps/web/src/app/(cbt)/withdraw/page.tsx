'use client';

import Link from 'next/link';
import { ArrowRight, Banknote, Clock3, ShieldAlert, WalletCards } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import { SkeletonLine } from '@/components/shared/skeleton-loader';
import { WithdrawalRequestForm } from '@/components/wallet/withdrawal-request-form';
import { useCbtEarnings } from '@/hooks/use-cbt-earnings';
import { useMyWithdrawalRequests } from '@/hooks/use-withdrawal-requests';
import { cbtWithdrawSections } from '@/lib/cbt-content';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';

export default function WithdrawPage() {
  const { earnings, loading, error, reload } = useCbtEarnings({
    page: 1,
    limit: 5,
  });
  const {
    requests,
    summary: withdrawalSummary,
    loading: withdrawalsLoading,
    error: withdrawalsError,
    reload: reloadWithdrawals,
  } = useMyWithdrawalRequests({
    page: 1,
    limit: 5,
  });

  const readinessCards = [
    {
      title: 'Withdrawable now',
      value: formatNaira(earnings?.summary.withdrawableBalance ?? '0'),
      icon: WalletCards,
    },
    {
      title: 'Still awaiting release',
      value: formatNaira(earnings?.summary.awaitingReleaseAmount ?? '0'),
      icon: Clock3,
    },
    {
      title: 'Blocked by dispute',
      value: formatNaira(earnings?.summary.blockedReleaseAmount ?? '0'),
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:flex md:h-full md:flex-col xl:overflow-hidden md:p-8">
      <PageHeader
        title="Withdraw"
        description="See what's withdrawable, pending release, and blocked by disputes."
        actions={
          <Link
            href="/earnings"
            className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
          >
            Earnings
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {cbtWithdrawSections.map((item) => (
          <article
            key={item.title}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#0D1B3E]">
              <item.icon size={20} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              {item.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {item.description}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {readinessCards.map((item) => (
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

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AccountPanel
          title="Submit payout request"
          description="Create a payout request once released wallet balance is available. The amount is reserved immediately while admin reviews the request."
        >
          <WithdrawalRequestForm />
        </AccountPanel>

        <AccountPanel
          title="Withdrawal readiness"
          description="Live release posture is shown here so you know when a payout request will be eligible."
        >
          {error ? (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="Withdrawal readiness unavailable"
                message={error}
                icon={Banknote}
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
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <SkeletonLine className="h-4 w-2/3" />
                  <SkeletonLine className="mt-3 h-4 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <ReadinessBlock
                title="Ready now"
                emptyMessage="No completed jobs are currently waiting for payout release."
                items={earnings?.releaseQueue.ready ?? []}
              />
              <ReadinessBlock
                title="Awaiting dispute window"
                emptyMessage="No jobs are currently in the release waiting window."
                items={earnings?.releaseQueue.awaiting ?? []}
              />
              <ReadinessBlock
                title="Blocked by dispute"
                emptyMessage="No disputes are blocking your payout flow right now."
                items={earnings?.releaseQueue.blocked ?? []}
                blocked
              />
            </div>
          )}
        </AccountPanel>
      </div>

      <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_1fr] xl:overflow-hidden">
        <AccountPanel
          title="Payout request history"
          description="Track submitted requests and see how much is waiting on admin review, processing, completion, or reversal."
          contentClassName="xl:min-h-0"
        >
          {withdrawalsError ? (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="Withdrawal requests unavailable"
                message={withdrawalsError}
                icon={Banknote}
                action={
                  <button
                    type="button"
                    onClick={reloadWithdrawals}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            </div>
          ) : withdrawalsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <SkeletonLine className="h-4 w-2/3" />
                  <SkeletonLine className="mt-3 h-4 w-full" />
                </div>
              ))}
            </div>
          ) : requests.length ? (
            <ScrollCardBody bodyClassName="space-y-3">
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {request.bankName} · {request.accountName}
                        </p>
                        <span className={statusBadgeClassName(request.status)}>
                          {request.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {request.accountNumber} · Requested {formatDate(request.createdAt)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {request.processorNote ?? 'No admin note yet'}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-900">
                      {formatNaira(request.amount)}
                    </span>
                  </div>
                </article>
              ))}
            </ScrollCardBody>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
              No payout requests submitted yet.
            </div>
          )}
        </AccountPanel>

        <AccountPanel
          title="What happens next"
          description="This keeps the payout path honest before the real withdrawal request module goes live."
          contentClassName="xl:min-h-0"
        >
          {withdrawalSummary ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <ReadinessMetric
                label="Pending review"
                value={`${formatNaira(withdrawalSummary.pendingAmount)} · ${withdrawalSummary.pendingCount}`}
              />
              <ReadinessMetric
                label="Processing"
                value={`${formatNaira(withdrawalSummary.processingAmount)} · ${withdrawalSummary.processingCount}`}
              />
              <ReadinessMetric
                label="Completed"
                value={`${formatNaira(withdrawalSummary.completedAmount)} · ${withdrawalSummary.completedCount}`}
              />
              <ReadinessMetric
                label="Rejected"
                value={`${formatNaira(withdrawalSummary.rejectedAmount)} · ${withdrawalSummary.rejectedCount}`}
              />
            </div>
          ) : null}

          <div className="space-y-4">
            {[
              'Submitted payout requests reserve the amount from your available balance immediately.',
              'Admin review can approve, move to processing, complete, or reject the request with a visible note.',
              'Rejected payout requests restore the reserved funds back into your wallet balance.',
            ].map((step) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 text-sm leading-6 text-slate-600"
              >
                {step}
              </div>
            ))}
          </div>

          {Number(earnings?.summary.withdrawableBalance ?? '0') > 0 ? (
            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
              Withdrawable funds are already present in your wallet and payout
              requests can now be submitted from this page.
            </div>
          ) : (
            <Link
              href="/earnings"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
            >
              Review earnings workspace
              <ArrowRight size={16} />
            </Link>
          )}
        </AccountPanel>
      </div>
    </div>
  );
}

function ReadinessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
      <p className="text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ReadinessBlock({
  title,
  items,
  emptyMessage,
  blocked = false,
}: {
  title: string;
  items: Array<{
    id: string;
    orderNumber: string;
    amount: string;
    disputeWindowExpiresAt: string | null;
    service: {
      name: string;
      slug: string;
      category: {
        name: string;
        slug: string;
      };
    };
    dispute?: {
      id: string;
      status: string;
      reason: string;
    } | null;
  }>;
  emptyMessage: string;
  blocked?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.service.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.orderNumber} · {item.service.category.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {blocked
                      ? item.dispute?.reason ?? 'Blocked by dispute'
                      : item.disputeWindowExpiresAt
                        ? formatTimeUntil(item.disputeWindowExpiresAt)
                        : 'Ready for payout processing'}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-900">
                  {formatNaira(item.amount)}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function statusBadgeClassName(status: string) {
  switch (status) {
    case 'PENDING':
      return 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700';
    case 'APPROVED':
      return 'rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700';
    case 'PROCESSING':
      return 'rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700';
    case 'COMPLETED':
      return 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700';
    case 'REJECTED':
      return 'rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700';
    default:
      return 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600';
  }
}
