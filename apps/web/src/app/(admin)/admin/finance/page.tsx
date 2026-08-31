'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Hourglass,
  Lock,
  Search,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TransactionStatus, TransactionType, UserRole } from '@zendocx/types';
import { AdminWithdrawalReview } from '@/components/admin/admin-withdrawal-review';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import { StatCard } from '@/components/shared/stat-card';
import { useAdminWalletTransactions } from '@/hooks/use-admin-wallet-transactions';
import {
  type AdminFundingReconciliationPreview,
  useAdminFundingReconciliationApply,
  useAdminFundingReconciliationPreview,
  useAdminCbtEarningsOverview,
  useAdminWalletOverview,
  useAdminWallets,
} from '@/hooks/use-admin-wallets';
import { usePlatformAdminTenants } from '@/hooks/use-platform-admin-tenants';
import { WithdrawalRequestForm } from '@/components/wallet/withdrawal-request-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';
import { cn } from '@/lib/utils';

const ALL_ROLE_FILTER = 'ALL';
const ADMIN_WALLET_PAGE_LIMIT = 8;
const ADMIN_TRANSACTION_PAGE_LIMIT = 8;

type FinanceTab = 'overview' | 'payouts' | 'wallets' | 'activity';

const tabLabels: Record<FinanceTab, string> = {
  overview: 'Overview',
  payouts: 'Payouts',
  wallets: 'Wallets',
  activity: 'Activity',
};

const roleOptions: Array<{ label: string; value: UserRole | typeof ALL_ROLE_FILTER }> = [
  { label: 'All roles', value: ALL_ROLE_FILTER },
  { label: 'Individuals', value: UserRole.INDIVIDUAL },
  { label: 'CBT centers', value: UserRole.CBT_CENTER },
  { label: 'Tenant admins', value: UserRole.TENANT_ADMIN },
  { label: 'Super admins', value: UserRole.SUPER_ADMIN },
];
const transactionTypeOptions: Array<{
  label: string;
  value: TransactionType | 'ALL';
}> = [
  { label: 'All types', value: 'ALL' },
  { label: 'Funding', value: TransactionType.WALLET_FUNDING },
  { label: 'Service purchase', value: TransactionType.SERVICE_PURCHASE },
  { label: 'Funds placed on hold', value: TransactionType.ESCROW_LOCK },
  { label: 'Funds released', value: TransactionType.ESCROW_RELEASE },
  { label: 'Platform commission', value: TransactionType.PLATFORM_COMMISSION },
  { label: 'CBT commission', value: TransactionType.CBT_COMMISSION },
  { label: 'Withdrawal', value: TransactionType.WITHDRAWAL },
  { label: 'Refund', value: TransactionType.REFUND },
  { label: 'Penalty', value: TransactionType.PENALTY },
];
const transactionStatusOptions: Array<{
  label: string;
  value: TransactionStatus | 'ALL';
}> = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Pending', value: TransactionStatus.PENDING },
  { label: 'Success', value: TransactionStatus.SUCCESS },
  { label: 'Failed', value: TransactionStatus.FAILED },
  { label: 'Reversed', value: TransactionStatus.REVERSED },
];

export default function AdminFinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [filters, setFilters] = useState<{
    page: number;
    role: UserRole | typeof ALL_ROLE_FILTER;
    tenantId: string | typeof ALL_ROLE_FILTER;
    search: string;
  }>({
    page: 1,
    role: ALL_ROLE_FILTER,
    tenantId: ALL_ROLE_FILTER,
    search: '',
  });
  const [transactionFilters, setTransactionFilters] = useState<{
    page: number;
    role: UserRole | 'ALL';
    tenantId: string | 'ALL';
    type: TransactionType | 'ALL';
    status: TransactionStatus | 'ALL';
    search: string;
    startDate: string;
    endDate: string;
  }>({
    page: 1,
    role: 'ALL',
    tenantId: 'ALL',
    type: 'ALL',
    status: 'ALL',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [reconciliationReference, setReconciliationReference] = useState('');
  const [previewResult, setPreviewResult] =
    useState<AdminFundingReconciliationPreview | null>(null);
  const { overview, loading, error, reload } = useAdminWalletOverview();
  const { tenants } = usePlatformAdminTenants({ page: 1, limit: 100 });
  const {
    overview: cbtEarningsOverview,
    loading: cbtEarningsLoading,
    error: cbtEarningsError,
    reload: reloadCbtEarnings,
  } = useAdminCbtEarningsOverview();
  const {
    wallets,
    meta,
    loading: walletsLoading,
    error: walletsError,
    reload: reloadWallets,
  } = useAdminWallets({
    page: filters.page,
    limit: ADMIN_WALLET_PAGE_LIMIT,
    role: filters.role,
    tenantId: filters.tenantId,
    search: filters.search,
  });
  const {
    transactions,
    meta: transactionMeta,
    loading: transactionsLoading,
    error: transactionsError,
    reload: reloadTransactions,
  } = useAdminWalletTransactions({
    page: transactionFilters.page,
    limit: ADMIN_TRANSACTION_PAGE_LIMIT,
    role: transactionFilters.role,
    tenantId: transactionFilters.tenantId,
    type: transactionFilters.type,
    status: transactionFilters.status,
    search: transactionFilters.search,
    startDate: transactionFilters.startDate,
    endDate: transactionFilters.endDate,
  });
  const previewFunding = useAdminFundingReconciliationPreview();
  const applyFunding = useAdminFundingReconciliationApply();

  // The four headline numbers answer "how much can move, how much is stuck,
  // what have we earned, what is queued". Everything else lives inside a tab.
  const statCards = overview
    ? ([
        {
          title: 'Money ready now',
          value: formatNaira(overview.totalAvailableBalance),
          icon: Wallet,
          variant: 'navy',
        },
        {
          title: 'Money on hold',
          value: formatNaira(overview.totalEscrowBalance),
          icon: Lock,
          variant: 'teal',
        },
        {
          title: 'Zendocx earnings',
          value: formatNaira(overview.platformCommissionVolume),
          icon: TrendingUp,
          variant: 'amber',
        },
        {
          title: 'Payouts to review',
          value: `${formatNaira(overview.payoutReviewAmount)} · ${overview.payoutReviewCount}`,
          icon: ArrowUpRight,
          variant: overview.payoutReviewCount > 0 ? 'orange' : 'green',
        },
      ] as const)
    : [];

  // Anything with a non-zero count is work somebody has to do today. The old
  // page explained these in prose; showing the counts says the same thing.
  const attentionItems = useMemo(() => {
    if (!overview) return [];

    const items: Array<{
      label: string;
      detail: string;
      count: number;
      tab: FinanceTab;
      tone: 'warn' | 'info';
    }> = [
      {
        label: 'Funding attempts still pending',
        detail: 'Started in the last 48 hours and not confirmed by the gateway.',
        count: overview.pendingFundingCount,
        tab: 'activity',
        tone: 'warn',
      },
      {
        label: 'Orders holding money undelivered',
        detail: `${formatNaira(overview.openEscrowAmount)} locked on orders that have not been completed.`,
        count: overview.openEscrowCount,
        tab: 'overview',
        tone: 'warn',
      },
      {
        label: 'Withdrawals awaiting review or payout',
        detail: `${formatNaira(overview.payoutReviewAmount)} waiting on a decision.`,
        count: overview.payoutReviewCount,
        tab: 'payouts',
        tone: 'warn',
      },
    ];

    if (cbtEarningsOverview) {
      items.push(
        {
          label: 'CBT jobs ready to release',
          detail: `${formatNaira(cbtEarningsOverview.summary.readyReleaseAmount)} cleared the dispute window.`,
          count: cbtEarningsOverview.summary.readyReleaseCount,
          tab: 'payouts',
          tone: 'info',
        },
        {
          label: 'CBT payouts blocked by dispute',
          detail: `${formatNaira(cbtEarningsOverview.summary.blockedReleaseAmount)} held until the dispute closes.`,
          count: cbtEarningsOverview.summary.blockedReleaseCount,
          tab: 'payouts',
          tone: 'warn',
        },
      );
    }

    return items;
  }, [overview, cbtEarningsOverview]);

  const openItems = attentionItems.filter((item) => item.count > 0);

  const reloadAll = () => {
    reload();
    reloadWallets();
    reloadCbtEarnings();
    reloadTransactions();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Finance"
        description="Where platform money is sitting, and what needs a decision."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reloadAll}
              className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
            >
              Refresh
            </button>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
            >
              Dashboard
            </Link>
          </div>
        }
      />

      {/* ── Headline numbers ───────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[104px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
              />
            ))
          : statCards.map((item) => (
              <StatCard
                key={item.title}
                title={item.title}
                value={item.value}
                icon={item.icon}
                variant={item.variant}
              />
            ))}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {(Object.keys(tabLabels) as FinanceTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition',
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {tabLabels[tab]}
            {tab === 'payouts' && openItems.length ? (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-700">
                {openItems.reduce((sum, item) => sum + item.count, 0)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                            */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {error || !overview ? (
            <AccountPanel>
              <EmptyState
                title="Finance data unavailable"
                message={
                  error ?? 'We could not load platform finance visibility right now.'
                }
                icon={Wallet}
                action={
                  <button
                    type="button"
                    onClick={reloadAll}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            </AccountPanel>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <AccountPanel
                  title="Where money sits"
                  description="Every naira on the platform, split by whether it can move today."
                >
                  <MoneySplit
                    available={overview.totalAvailableBalance}
                    onHold={overview.totalEscrowBalance}
                    paidOut={overview.totalWithdrawn}
                  />
                </AccountPanel>

                <AccountPanel
                  title="Needs attention"
                  description="Open items, largest queue first."
                >
                  {openItems.length ? (
                    <div className="space-y-2">
                      {openItems
                        .slice()
                        .sort((a, b) => b.count - a.count)
                        .map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setActiveTab(item.tab)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:shadow-sm"
                          >
                            <span
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                                item.tone === 'warn'
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-cyan-50 text-cyan-700',
                              )}
                            >
                              {item.tone === 'warn' ? (
                                <AlertTriangle size={16} />
                              ) : (
                                <Clock size={16} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-900">
                                {item.label}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {item.detail}
                              </span>
                            </span>
                            <span className="shrink-0 text-lg font-bold tabular-nums text-slate-900">
                              {item.count}
                            </span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                      <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-800">
                        Nothing is waiting on you. No pending funding, no payout queue,
                        no blocked releases.
                      </p>
                    </div>
                  )}
                </AccountPanel>
              </div>

              <AccountPanel
                title="Orders holding money undelivered"
                description="Escrow is locked when an order is created and released when it completes. These orders have done neither, so no CBT payout bucket accounts for them."
                actions={
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatNaira(overview.openEscrowAmount)}
                  </span>
                }
              >
                {overview.openEscrowOrders.length ? (
                  <div className="space-y-2">
                    {overview.openEscrowOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <Hourglass size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {order.serviceName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {`${order.orderNumber} · ${order.cbtName ?? 'Unclaimed'}`}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {`Placed ${formatDate(order.createdAt)}`}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {order.status.replace(/_/g, ' ').toLowerCase()}
                        </span>
                        <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatNaira(order.amount)}
                        </span>
                      </div>
                    ))}
                    {overview.openEscrowCount > overview.openEscrowOrders.length ? (
                      <p className="px-1 pt-1 text-xs text-slate-400">
                        {`Showing the ${overview.openEscrowOrders.length} oldest of ${overview.openEscrowCount}.`}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title="No order is holding money undelivered"
                    message="Every order with escrow locked against it has been completed or released."
                    icon={CheckCircle2}
                  />
                )}
              </AccountPanel>

              <AccountPanel
                title="Money summary"
                description="The full ledger position, grouped by who the money belongs to."
              >
                <div className="grid gap-6 md:grid-cols-3">
                  <SummaryGroup
                    title="Customer money"
                    icon={Users}
                    rows={[
                      {
                        label: 'Funding inflow',
                        value: formatNaira(overview.successfulFundingVolume),
                      },
                      {
                        label: 'Ready now',
                        value: formatNaira(overview.totalAvailableBalance),
                      },
                      {
                        label: 'On hold',
                        value: formatNaira(overview.totalEscrowBalance),
                      },
                      {
                        label: 'Refunds returned',
                        value: formatNaira(overview.refundVolume),
                      },
                      {
                        label: 'Wallets funded',
                        value: `${overview.fundedWallets} of ${overview.totalWallets}`,
                      },
                    ]}
                  />
                  <SummaryGroup
                    title="Zendocx earnings"
                    icon={TrendingUp}
                    rows={[
                      {
                        label: 'Platform commission',
                        value: formatNaira(overview.platformCommissionVolume),
                      },
                      {
                        label: 'Gateway fees captured',
                        value: formatNaira(overview.capturedFundingFeeVolume),
                      },
                      {
                        label: 'CBT earnings released',
                        value: formatNaira(overview.cbtCommissionVolume),
                      },
                    ]}
                  />
                  <SummaryGroup
                    title="Payouts"
                    icon={Banknote}
                    rows={[
                      {
                        label: 'Already paid out',
                        value: formatNaira(overview.totalWithdrawn),
                      },
                      {
                        label: 'Requested in total',
                        value: formatNaira(overview.withdrawalVolume),
                      },
                      {
                        label: 'Pending review',
                        value: `${formatNaira(overview.pendingWithdrawalAmount)} · ${overview.pendingWithdrawalCount}`,
                      },
                      {
                        label: 'Approved / processing',
                        value: `${formatNaira(
                          (
                            BigInt(overview.approvedWithdrawalAmount) +
                            BigInt(overview.processingWithdrawalAmount)
                          ).toString(),
                        )} · ${overview.approvedWithdrawalCount + overview.processingWithdrawalCount}`,
                      },
                    ]}
                  />
                </div>
              </AccountPanel>

              <AccountPanel
                title="Businesses holding customer money"
                description="Customer funds a business has not cleared yet, because a service or dispute is still open."
              >
                {overview.heldFundsByTenant.length ? (
                  <div className="space-y-2">
                    {overview.heldFundsByTenant.slice(0, 8).map((tenant) => (
                      <div
                        key={tenant.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          <Building2 size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {tenant.name}
                          </p>
                          <p className="truncate text-xs text-slate-400">{tenant.slug}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                          {formatNaira(tenant.heldFunds)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No business is holding customer funds"
                    message="Payments still waiting on completion or release will appear here."
                    icon={Building2}
                  />
                )}
              </AccountPanel>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* PAYOUTS TAB                                             */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          <AdminWithdrawalReview />

          <AccountPanel
            title="CBT payout readiness"
            description="What has cleared, what is almost ready, and what a dispute is holding back."
          >
            {cbtEarningsError ? (
              <EmptyState
                title="CBT earnings visibility unavailable"
                message={cbtEarningsError}
                icon={TrendingUp}
                action={
                  <button
                    type="button"
                    onClick={reloadCbtEarnings}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            ) : cbtEarningsLoading || !cbtEarningsOverview ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[76px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <QueueMetric
                    label="Ready to release"
                    amount={formatNaira(cbtEarningsOverview.summary.readyReleaseAmount)}
                    count={cbtEarningsOverview.summary.readyReleaseCount}
                    tone="ready"
                  />
                  <QueueMetric
                    label="Still waiting"
                    amount={formatNaira(
                      cbtEarningsOverview.summary.awaitingReleaseAmount,
                    )}
                    count={cbtEarningsOverview.summary.awaitingReleaseCount}
                    tone="waiting"
                  />
                  <QueueMetric
                    label="Blocked by dispute"
                    amount={formatNaira(
                      cbtEarningsOverview.summary.blockedReleaseAmount,
                    )}
                    count={cbtEarningsOverview.summary.blockedReleaseCount}
                    tone="blocked"
                  />
                  <QueueMetric
                    label="CBT ready to withdraw"
                    amount={formatNaira(
                      cbtEarningsOverview.summary.totalCbtWithdrawableBalance,
                    )}
                    count={cbtEarningsOverview.summary.releasedCommissionCount}
                    countLabel="releases"
                    tone="paid"
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <FinanceQueueBlock
                    title="Ready to release"
                    items={cbtEarningsOverview.queue.ready}
                    emptyMessage="No completed CBT work is waiting to be released."
                  />
                  <FinanceQueueBlock
                    title="Blocked by dispute"
                    items={cbtEarningsOverview.queue.blocked}
                    emptyMessage="No disputed CBT payouts are blocking release."
                  />
                </div>
              </div>
            )}
          </AccountPanel>

          <div className="grid gap-6 xl:grid-cols-2">
            <AccountPanel
              title="CBT balances"
              description="Operators holding the largest ready balance."
            >
              {cbtEarningsLoading || !cbtEarningsOverview ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
                    />
                  ))}
                </div>
              ) : cbtEarningsOverview.topCbtWallets.length ? (
                <ScrollCardBody bodyClassName="space-y-2">
                  {cbtEarningsOverview.topCbtWallets.map((wallet) => (
                    <article
                      key={wallet.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {`${wallet.user.firstName} ${wallet.user.lastName}`}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {wallet.user.email}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                          {formatNaira(wallet.availableBalance)}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <span>
                          Earned
                          <span className="ml-1 font-semibold tabular-nums text-slate-700">
                            {formatNaira(wallet.totalEarned)}
                          </span>
                        </span>
                        <span>
                          Withdrawn
                          <span className="ml-1 font-semibold tabular-nums text-slate-700">
                            {formatNaira(wallet.totalWithdrawn)}
                          </span>
                        </span>
                      </div>
                    </article>
                  ))}
                </ScrollCardBody>
              ) : (
                <EmptyState
                  title="No CBT wallet visibility yet"
                  message="Balances appear once released earnings accumulate."
                  icon={Wallet}
                />
              )}
            </AccountPanel>

            <AccountPanel
              title="Latest CBT payouts released"
              description="The most recent releases, newest first."
            >
              {cbtEarningsLoading || !cbtEarningsOverview ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
                    />
                  ))}
                </div>
              ) : cbtEarningsOverview.recentReleased.length ? (
                <ScrollCardBody bodyClassName="space-y-2">
                  {cbtEarningsOverview.recentReleased.map((item) => (
                    <article
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {`${item.cbt.firstName} ${item.cbt.lastName}`}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {`${item.order?.service.name ?? 'Unknown service'} · ${item.order?.orderNumber ?? item.reference}`}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold tabular-nums text-emerald-700">
                        {formatNaira(item.amount)}
                      </span>
                    </article>
                  ))}
                </ScrollCardBody>
              ) : (
                <EmptyState
                  title="No released CBT commissions yet"
                  message="Releases appear once jobs clear the dispute window."
                  icon={Banknote}
                />
              )}
            </AccountPanel>
          </div>

          <AccountPanel
            title="Move Zendocx earnings out"
            description="Withdraw money that already belongs to the platform."
          >
            <WithdrawalRequestForm />
          </AccountPanel>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* WALLETS TAB                                             */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'wallets' && (
        <AccountPanel
          title="Wallets by person"
          description="Search wallet records to see where money is sitting and who holds it."
          contentClassName="space-y-4"
          actions={
            meta ? (
              <span className="text-sm text-slate-500">
                {`${meta.total} wallet${meta.total === 1 ? '' : 's'}`}
              </span>
            ) : null
          }
        >
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.7fr_0.7fr_auto]">
            <SearchInput
              label="Search"
              value={filters.search}
              placeholder="Search by name or email"
              onChange={(value) => {
                setFilters((current) => ({ ...current, page: 1, search: value }));
              }}
            />
            <FilterSelect
              label="Role"
              value={filters.role}
              options={roleOptions}
              onChange={(value) => {
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  role: value as UserRole | typeof ALL_ROLE_FILTER,
                }));
              }}
            />
            <FilterSelect
              label="Business"
              value={filters.tenantId}
              options={[
                { label: 'All businesses', value: ALL_ROLE_FILTER },
                ...tenants.map((tenant) => ({
                  label: tenant.name,
                  value: tenant.id,
                })),
              ]}
              onChange={(value) => {
                setFilters((current) => ({ ...current, page: 1, tenantId: value }));
              }}
            />
            <button
              type="button"
              onClick={() => {
                setFilters({
                  page: 1,
                  role: ALL_ROLE_FILTER,
                  tenantId: ALL_ROLE_FILTER,
                  search: '',
                });
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:self-end"
            >
              Clear
            </button>
          </div>

          {walletsError ? (
            <EmptyState
              title="Wallet records unavailable"
              message={walletsError}
              icon={Wallet}
              action={
                <button
                  type="button"
                  onClick={reloadWallets}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Try again
                </button>
              }
            />
          ) : walletsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
                />
              ))}
            </div>
          ) : wallets.length === 0 ? (
            <EmptyState
              title="No wallets matched these filters"
              message="Try broadening the search or resetting the role filter."
              icon={Search}
            />
          ) : (
            <>
              <ScrollCardBody bodyClassName="space-y-2">
                {wallets.map((wallet) => (
                  <article
                    key={wallet.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {`${wallet.user.firstName} ${wallet.user.lastName}`}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {wallet.user.role.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      {!wallet.user.isActive ? (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                          Inactive
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-slate-400">
                        {`${wallet.transactionCount} txn${wallet.transactionCount === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {wallet.user.email}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                      <WalletMetric
                        label="Available"
                        value={formatNaira(wallet.availableBalance)}
                      />
                      <WalletMetric
                        label="On hold"
                        value={formatNaira(wallet.escrowBalance)}
                      />
                      <WalletMetric
                        label="Earned"
                        value={formatNaira(wallet.totalEarned)}
                      />
                    </div>
                  </article>
                ))}
              </ScrollCardBody>

              {meta ? (
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  hasNextPage={meta.hasNextPage}
                  onPrevious={() => {
                    setFilters((current) => ({
                      ...current,
                      page: Math.max(current.page - 1, 1),
                    }));
                  }}
                  onNext={() => {
                    setFilters((current) => ({ ...current, page: current.page + 1 }));
                  }}
                />
              ) : null}
            </>
          )}
        </AccountPanel>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* ACTIVITY TAB                                             */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <AccountPanel
            title="All wallet movement"
            description="Funding, held money, commissions, refunds and withdrawals in one feed."
            contentClassName="space-y-4"
            actions={
              transactionMeta ? (
                <span className="text-sm text-slate-500">
                  {`${transactionMeta.total} record${transactionMeta.total === 1 ? '' : 's'}`}
                </span>
              ) : null
            }
          >
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <SearchInput
                label="Search"
                value={transactionFilters.search}
                placeholder="Reference, user, email"
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    search: value,
                  }));
                }}
              />
              <FilterSelect
                label="Type"
                value={transactionFilters.type}
                options={transactionTypeOptions}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    type: value as TransactionType | 'ALL',
                  }));
                }}
              />
              <FilterSelect
                label="Status"
                value={transactionFilters.status}
                options={transactionStatusOptions}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    status: value as TransactionStatus | 'ALL',
                  }));
                }}
              />
              <FilterSelect
                label="Role"
                value={transactionFilters.role}
                options={roleOptions}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    role: value as UserRole | 'ALL',
                  }));
                }}
              />
              <FilterSelect
                label="Business"
                value={transactionFilters.tenantId}
                options={[
                  { label: 'All businesses', value: 'ALL' },
                  ...tenants.map((tenant) => ({
                    label: tenant.name,
                    value: tenant.id,
                  })),
                ]}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    tenantId: value,
                  }));
                }}
              />
              <DateInput
                label="From"
                value={transactionFilters.startDate}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    startDate: value,
                  }));
                }}
              />
              <DateInput
                label="To"
                value={transactionFilters.endDate}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    endDate: value,
                  }));
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setTransactionFilters({
                    page: 1,
                    role: 'ALL',
                    tenantId: 'ALL',
                    type: 'ALL',
                    status: 'ALL',
                    search: '',
                    startDate: '',
                    endDate: '',
                  });
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:self-end"
              >
                Clear filters
              </button>
            </div>

            {transactionsError ? (
              <EmptyState
                title="Finance activity unavailable"
                message={transactionsError}
                icon={Wallet}
                action={
                  <button
                    type="button"
                    onClick={reloadTransactions}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            ) : transactionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
                  />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                title="No wallet movement matched"
                message="Try broadening the filters to see more activity."
                icon={Search}
              />
            ) : (
              <>
                <ScrollCardBody bodyClassName="space-y-2">
                  {transactions.map((transaction) => (
                    <article
                      key={transaction.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {getTransactionLabel(transaction.type)}
                        </span>
                        <StatusBadge status={transaction.status} />
                        <span className="ml-auto text-sm font-bold tabular-nums text-slate-900">
                          {formatNaira(transaction.amount)}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-sm text-slate-600">
                        {`${transaction.user.firstName} ${transaction.user.lastName} · ${transaction.user.email}`}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {transaction.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-400">
                        <span>{transaction.reference}</span>
                        <span>{formatDate(transaction.createdAt)}</span>
                        <span className="tabular-nums">
                          {`${formatNaira(transaction.balanceBefore)} → ${formatNaira(transaction.balanceAfter)}`}
                        </span>
                      </div>
                    </article>
                  ))}
                </ScrollCardBody>

                {transactionMeta ? (
                  <Pagination
                    page={transactionMeta.page}
                    totalPages={transactionMeta.totalPages}
                    hasNextPage={transactionMeta.hasNextPage}
                    onPrevious={() => {
                      setTransactionFilters((current) => ({
                        ...current,
                        page: Math.max(current.page - 1, 1),
                      }));
                    }}
                    onNext={() => {
                      setTransactionFilters((current) => ({
                        ...current,
                        page: current.page + 1,
                      }));
                    }}
                  />
                ) : null}
              </>
            )}
          </AccountPanel>

          <AccountPanel
            title="Funding reconciliation"
            description="For when the gateway confirms a payment but the wallet still shows it pending. The reference is verified with the gateway before anything is credited."
            contentClassName="space-y-4"
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">
                  Transaction reference
                </span>
                <input
                  value={reconciliationReference}
                  onChange={(event) => setReconciliationReference(event.target.value)}
                  placeholder="ZDX-TXN-..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  const normalized = reconciliationReference.trim();
                  if (!normalized) {
                    toast.error('Enter a funding reference first.');
                    return;
                  }

                  previewFunding.mutate(normalized, {
                    onSuccess: (data) => {
                      setPreviewResult(data);
                    },
                    onError: (mutationError: unknown) => {
                      setPreviewResult(null);
                      toast.error(
                        getApiErrorMessage(
                          mutationError,
                          'Could not preview that funding reference right now.',
                        ),
                      );
                    },
                  });
                }}
                disabled={previewFunding.isPending}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"
              >
                {previewFunding.isPending ? 'Checking…' : 'Preview'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const normalized = reconciliationReference.trim();
                  if (!normalized) {
                    toast.error('Enter a funding reference first.');
                    return;
                  }

                  applyFunding.mutate(normalized, {
                    onSuccess: (response) => {
                      toast.success(response.message);
                      void Promise.all([
                        reload(),
                        reloadWallets(),
                        reloadTransactions(),
                      ]);
                      previewFunding.mutate(normalized, {
                        onSuccess: (data) => {
                          setPreviewResult(data);
                        },
                      });
                    },
                    onError: (mutationError: unknown) => {
                      toast.error(
                        getApiErrorMessage(
                          mutationError,
                          'Could not reconcile that funding reference right now.',
                        ),
                      );
                    },
                  });
                }}
                disabled={
                  applyFunding.isPending ||
                  previewFunding.isPending ||
                  !previewResult?.canApply ||
                  previewResult.reference !== reconciliationReference.trim()
                }
                className="rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"
              >
                {applyFunding.isPending ? 'Reconciling…' : 'Credit wallet'}
              </button>
            </div>

            {previewResult ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {`${previewResult.user.firstName} ${previewResult.user.lastName}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {`${previewResult.user.email} · ${previewResult.reference}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {`Initiated ${formatDate(previewResult.transaction.createdAt)}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold',
                      previewResult.canApply
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {previewResult.canApply ? 'Safe to reconcile' : 'Needs review'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 lg:grid-cols-4">
                  <WalletMetric
                    label="Current status"
                    value={previewResult.transaction.status}
                  />
                  <WalletMetric
                    label="Pending amount"
                    value={formatNaira(previewResult.transaction.amountKobo)}
                  />
                  <WalletMetric
                    label="Gateway"
                    value={previewResult.transaction.gateway ?? 'Not set'}
                  />
                  <WalletMetric
                    label="Verified amount"
                    value={
                      previewResult.verification.amountKobo
                        ? formatNaira(previewResult.verification.amountKobo)
                        : 'Not verified'
                    }
                  />
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Callback URL
                    </p>
                    <p className="mt-1.5 break-all text-sm text-slate-700">
                      {previewResult.transaction.callbackUrl ?? 'Not recorded'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Gateway verification
                    </p>
                    <p className="mt-1.5 text-sm text-slate-700">
                      {previewResult.verification.error
                        ? previewResult.verification.error
                        : previewResult.verification.success
                          ? `Confirmed${previewResult.verification.paidAt ? ` · ${formatDate(previewResult.verification.paidAt)}` : ''}`
                          : 'Not confirmed yet'}
                    </p>
                  </div>
                </div>

                {previewResult.reasons.length ? (
                  <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <Wrench size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        Why this cannot be auto-credited yet
                      </p>
                      <div className="mt-1 space-y-1 text-sm text-amber-700">
                        {previewResult.reasons.map((reason) => (
                          <p key={reason}>{reason}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </AccountPanel>
        </div>
      )}
    </div>
  );
}

/**
 * One bar showing the platform's money split three ways. Proportion is the
 * point — exact figures sit in the legend beneath it.
 */
function MoneySplit({
  available,
  onHold,
  paidOut,
}: {
  available: string;
  onHold: string;
  paidOut: string;
}) {
  const segments = [
    { label: 'Ready now', value: Number(available), className: 'bg-[#0D1B3E]' },
    { label: 'On hold', value: Number(onHold), className: 'bg-cyan-600' },
    { label: 'Paid out', value: Number(paidOut), className: 'bg-[#F5A623]' },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="space-y-4">
      {total > 0 ? (
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {segments.map((segment) =>
            segment.value > 0 ? (
              <div
                key={segment.label}
                className={segment.className}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
      ) : (
        <div className="h-3 rounded-full bg-slate-100" />
      )}

      <div className="space-y-2">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <span
              className={cn('h-2.5 w-2.5 shrink-0 rounded-full', segment.className)}
            />
            <span className="flex-1 text-sm text-slate-600">{segment.label}</span>
            <span className="text-xs tabular-nums text-slate-400">
              {total > 0 ? `${Math.round((segment.value / total) * 100)}%` : '—'}
            </span>
            <span className="w-32 text-right text-sm font-semibold tabular-nums text-slate-900">
              {formatNaira(segment.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryGroup({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Wallet;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
        <Icon size={14} className="text-slate-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>
      <dl className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-slate-500">{row.label}</dt>
            <dd className="text-right text-sm font-semibold tabular-nums text-slate-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type QueueTone = 'ready' | 'waiting' | 'blocked' | 'paid';

const queueTones: Record<QueueTone, string> = {
  ready: 'border-emerald-200 bg-emerald-50',
  waiting: 'border-slate-200 bg-slate-50',
  blocked: 'border-amber-200 bg-amber-50',
  paid: 'border-cyan-200 bg-cyan-50',
};

function QueueMetric({
  label,
  amount,
  count,
  countLabel = 'jobs',
  tone,
}: {
  label: string;
  amount: string;
  count: number;
  countLabel?: string;
  tone: QueueTone;
}) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3', queueTones[tone])}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">{amount}</p>
      <p className="text-xs text-slate-500">{`${count} ${countLabel}`}</p>
    </div>
  );
}

function FinanceQueueBlock({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: Array<{
    id: string;
    orderNumber: string;
    amount: string;
    disputeWindowExpiresAt: string | null;
    cbt?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    service: {
      id: string;
      name: string;
      slug: string;
      category: {
        id: string;
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
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <ScrollCardBody bodyClassName="space-y-2" maxHeightClassName="max-h-[18rem]">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {item.service.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {`${
                    item.cbt
                      ? `${item.cbt.firstName} ${item.cbt.lastName}`
                      : 'No CBT assigned'
                  } · ${item.orderNumber}`}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {item.dispute
                    ? item.dispute.reason
                    : item.disputeWindowExpiresAt
                      ? formatTimeUntil(item.disputeWindowExpiresAt)
                      : 'Ready for processing'}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                {formatNaira(item.amount)}
              </span>
            </article>
          ))}
        </ScrollCardBody>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  hasNextPage,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="text-xs text-slate-400">
        {`Page ${page} of ${Math.max(totalPages, 1)}`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNextPage}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SearchInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
        />
      </div>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
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

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
      />
    </label>
  );
}

function WalletMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const tone =
    status === TransactionStatus.SUCCESS
      ? 'bg-emerald-50 text-emerald-700'
      : status === TransactionStatus.PENDING
        ? 'bg-amber-50 text-amber-700'
        : status === TransactionStatus.REVERSED
          ? 'bg-slate-100 text-slate-600'
          : 'bg-rose-50 text-rose-700';

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', tone)}>
      {status.toLowerCase()}
    </span>
  );
}

function getTransactionLabel(type: TransactionType) {
  switch (type) {
    case TransactionType.WALLET_FUNDING:
      return 'Wallet funding';
    case TransactionType.SERVICE_PURCHASE:
      return 'Service purchase';
    case TransactionType.ESCROW_LOCK:
      return 'Funds placed on hold';
    case TransactionType.ESCROW_RELEASE:
      return 'Funds released';
    case TransactionType.PLATFORM_COMMISSION:
      return 'Platform commission';
    case TransactionType.CBT_COMMISSION:
      return 'CBT commission';
    case TransactionType.WITHDRAWAL:
      return 'Withdrawal';
    case TransactionType.REFUND:
      return 'Refund';
    case TransactionType.PENALTY:
      return 'Penalty';
    default:
      return type;
  }
}
