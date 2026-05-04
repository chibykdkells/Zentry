 'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Banknote, Clock3, TrendingUp, WalletCards } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import { SkeletonLine } from '@/components/shared/skeleton-loader';
import { useCbtEarnings } from '@/hooks/use-cbt-earnings';
import { cbtEarningsSections } from '@/lib/cbt-content';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';

export default function EarningsPage() {
  const [page, setPage] = useState(1);
  const { earnings, loading, error, reload } = useCbtEarnings({
    page,
    limit: 8,
  });

  const summaryCards = [
    {
      title: 'Total earned',
      value: formatNaira(earnings?.summary.totalEarned ?? '0'),
      icon: TrendingUp,
    },
    {
      title: 'Awaiting release',
      value: formatNaira(earnings?.summary.awaitingReleaseAmount ?? '0'),
      icon: Clock3,
    },
    {
      title: 'Withdrawable',
      value: formatNaira(earnings?.summary.withdrawableBalance ?? '0'),
      icon: WalletCards,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:flex md:h-full md:flex-col md:overflow-hidden md:p-8">
      <PageHeader
        title="Monitor release timing and payout readiness"
        description="Released commissions, pending release windows, and blocked payouts now all stay visible in one workspace."
        actions={
          <Link
            href="/withdraw"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-3 text-sm font-semibold text-brand-ink transition hover:bg-white"
          >
            Open withdraw
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
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
          title="Earnings model"
          description="A clear explanation of how CBT earnings are expected to move from job completion to payout."
        >
          <div className="space-y-4">
            {cbtEarningsSections.map((item) => (
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

        <AccountPanel
          title="Release queue"
          description="Track what is still waiting, what is already ready, and what is blocked by a dispute."
        >
          {error ? (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="Earnings unavailable"
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
            <div className="space-y-3 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <SkeletonLine className="h-4 w-2/3" />
                  <SkeletonLine className="mt-3 h-4 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <QueueBlock
                title="Awaiting release"
                tone="slate"
                items={earnings?.releaseQueue.awaiting ?? []}
                emptyMessage="No completed jobs are currently waiting on the dispute timer."
              />
              <QueueBlock
                title="Ready now"
                tone="emerald"
                items={earnings?.releaseQueue.ready ?? []}
                emptyMessage="The release worker has already cleared everything that is ready."
              />
              <QueueBlock
                title="Blocked"
                tone="amber"
                items={earnings?.releaseQueue.blocked ?? []}
                emptyMessage="No blocked payouts are holding back your earnings right now."
              />
            </div>
          )}
        </AccountPanel>
      </div>

      <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[0.95fr_1.05fr] xl:overflow-hidden">
        <AccountPanel
          title="Service mix"
          description="See which service lines are currently contributing to released CBT commissions."
          contentClassName="xl:min-h-0"
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <SkeletonLine className="h-4 w-1/2" />
                  <SkeletonLine className="mt-3 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : earnings?.serviceMix.length ? (
            <ScrollCardBody bodyClassName="space-y-3">
              {earnings.serviceMix.map((item) => (
                <div
                  key={`${item.orderId ?? item.service?.slug ?? 'unknown'}-${item.totalAmount}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.service?.name ?? 'Unknown service'}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                        {item.service?.category.name ?? 'Uncategorized'}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900">
                      {formatNaira(item.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </ScrollCardBody>
          ) : (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="No released commissions yet"
                message="Once released funds begin to credit your wallet, this section will show which services are driving earnings."
                icon={TrendingUp}
              />
            </div>
          )}
        </AccountPanel>

        <AccountPanel
          title="Commission history"
          description="Every released CBT commission stays tied to its order, requester, and service."
          contentClassName="xl:min-h-0"
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <SkeletonLine className="h-4 w-2/3" />
                  <SkeletonLine className="mt-3 h-4 w-full" />
                  <SkeletonLine className="mt-3 h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : earnings?.history.items.length ? (
            <ScrollCardBody bodyClassName="space-y-3">
              {earnings.history.items.map((item) => (
                <article
                  key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.order?.service.name ?? item.description}
                        </p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {item.order?.orderNumber ?? item.reference}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {item.order
                          ? `${item.order.requester.firstName} ${item.order.requester.lastName} • ${item.order.service.category.name}`
                          : item.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                        <span>Released {formatDate(item.createdAt)}</span>
                        <span>Balance after {formatNaira(item.balanceAfter)}</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                      {formatNaira(item.amount)}
                    </span>
                  </div>
                </article>
              ))}

              {earnings.history.meta.totalPages > 1 ? (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-slate-500">
                    Page {earnings.history.meta.page} of {earnings.history.meta.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) =>
                          Math.min(earnings.history.meta.totalPages, current + 1),
                        )
                      }
                      disabled={!earnings.history.meta.hasNextPage}
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </ScrollCardBody>
          ) : (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="No released earnings yet"
                message="Your commission history will appear here after completed jobs clear the review window and funds are released."
                icon={Banknote}
              />
            </div>
          )}
        </AccountPanel>
      </div>
    </div>
  );
}

function QueueBlock({
  title,
  tone,
  items,
  emptyMessage,
}: {
  title: string;
  tone: 'slate' | 'emerald' | 'amber';
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
}) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-700';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
          {items.length}
        </span>
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.service.name}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                    {item.orderNumber} • {item.service.category.name}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {item.dispute
                      ? item.dispute.reason
                      : item.disputeWindowExpiresAt
                        ? formatTimeUntil(item.disputeWindowExpiresAt)
                        : 'Waiting for release processing'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.dispute ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <AlertCircle size={12} />
                      Blocked
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-900">
                    {formatNaira(item.amount)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
