'use client';

import Link from 'next/link';
import {
  ClipboardList,
  FolderSearch,
  MessageSquareWarning,
  ShieldAlert,
} from 'lucide-react';
import { ProtectedShell } from '@/components/layout/protected-shell';
import { EmptyState } from '@/components/shared/empty-state';
import { AccountPanel } from '@/components/shared/account-panel';
import { PageHero } from '@/components/shared/page-hero';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import {
  SkeletonLine,
} from '@/components/shared/skeleton-loader';
import { useMyDisputes } from '@/hooks/use-disputes';
import { formatDate, formatTimeUntil } from '@/lib/format';
import { DisputeStatus } from '@zentry/types';

export default function DisputesPage() {
  const { metrics, disputes, meta, loading, error, reload } = useMyDisputes();

  const metricCards = [
    { label: 'All cases', value: metrics?.all ?? 0 },
    { label: 'Open', value: metrics?.open ?? 0 },
    { label: 'Under review', value: metrics?.underReview ?? 0 },
    {
      label: 'Resolved',
      value:
        (metrics?.resolvedForRequester ?? 0) + (metrics?.resolvedForCbt ?? 0),
    },
  ] as const;

  return (
    <ProtectedShell title="Disputes">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:flex md:h-full md:flex-col md:overflow-hidden md:p-8">
        <PageHero
          eyebrow="Disputes"
          title="Track active dispute cases from your completed orders"
          description="Disputes are now live for CBT-fulfilled orders that already have a result. Open a case from the orders workspace, then follow the review status here. When funds are still on hold, requester-favor resolutions can now return funds directly to the wallet."
          actions={
            <>
              <Link
                href="/orders"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Open orders
              </Link>
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
              >
                Support workspace
              </Link>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        </section>

        <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.08fr_0.92fr] xl:overflow-hidden">
          <AccountPanel
            title="Live dispute cases"
            description="Every case here is attached to a real order that has already reached result delivery."
            contentClassName="xl:min-h-0"
          >
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5 transition hover:border-slate-200 hover:bg-white"
                  >
                    <SkeletonLine className="h-5 w-40" />
                    <SkeletonLine className="mt-3 h-4 w-full" />
                    <SkeletonLine className="mt-2 h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
                <EmptyState
                  title="Disputes unavailable"
                  message={error}
                  icon={MessageSquareWarning}
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
            ) : disputes.length ? (
              <ScrollCardBody bodyClassName="space-y-4" maxHeightClassName="xl:min-h-0 xl:flex-1">
                {disputes.map((dispute) => (
                  <article
                    key={dispute.id}
                    className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-900">
                            {dispute.order.service.name}
                          </h2>
                          <DisputeBadge status={dispute.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {dispute.order.orderNumber} ·{' '}
                          {dispute.order.service.category.name}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {dispute.reason}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricPill
                          label="Opened"
                          value={formatDate(dispute.createdAt)}
                        />
                        <MetricPill
                          label="Window"
                          value={
                            dispute.order.disputeWindowExpiresAt
                              ? formatTimeUntil(
                                  dispute.order.disputeWindowExpiresAt,
                                )
                              : 'Closed'
                          }
                        />
                      </div>
                    </div>

                    {dispute.resolutionNote ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">
                          Resolution note
                        </p>
                        <p className="mt-2 leading-6">{dispute.resolutionNote}</p>
                      </div>
                    ) : null}

                    {dispute.evidenceUrls.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {dispute.evidenceUrls.map((url, index) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Evidence {index + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </ScrollCardBody>
            ) : (
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
                <EmptyState
                  title="No disputes yet"
                  message="When you raise a dispute from a completed CBT order, it will appear here with its review status."
                  icon={FolderSearch}
                  action={
                    <Link
                      href="/orders"
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Review orders
                      <ClipboardList size={16} />
                    </Link>
                  }
                />
              </div>
            )}

            {meta ? (
              <p className="mt-5 text-sm text-slate-500">
                Showing {disputes.length} of {meta.total} dispute cases.
              </p>
            ) : null}
          </AccountPanel>

          <AccountPanel
            title="How review works"
            description="This phase covers live case creation, admin review, redo handling, and held-fund refund execution."
            contentClassName="xl:min-h-0"
          >
            <div className="space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
              {[
                'Raise a dispute from a completed CBT order while the dispute window is still open.',
                'Platform review can move the case into review, request a redo, resolve for the requester, or resolve for the CBT center.',
                'Requester-favor decisions now auto-refund held funds to the wallet, while already released orders move into manual reconciliation follow-up.',
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D1B3E] text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-amber-100 bg-amber-50/70 px-4 py-4 text-sm leading-6 text-amber-900">
              This dispute slice is scoped to CBT-fulfilled manual orders only.
              Automated/API and PIN-stock dispute handling will follow their own
              operational path later.
            </div>
          </AccountPanel>
        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Need help before opening a case?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                If you only need clarification or delivery guidance, support is
                still the best first stop before escalating into a dispute.
              </p>
            </div>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
            >
              Open support
              <ShieldAlert size={16} />
            </Link>
          </div>
        </section>
      </div>
    </ProtectedShell>
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
        : status === DisputeStatus.RESOLVED_FOR_REQUESTER
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
