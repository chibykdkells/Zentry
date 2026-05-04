'use client';

import { type ElementType, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowUpRight,
  Clock3,
  Filter,
  History,
  Landmark,
  ReceiptText,
  RefreshCcw,
  SearchSlash,
  Wallet as WalletIcon,
} from 'lucide-react';
import { ProtectedShell } from '@/components/layout/protected-shell';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import {
  SkeletonBlock,
  SkeletonLine,
} from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { FundWalletModal } from '@/components/wallet/fund-wallet-modal';
import { WalletCard } from '@/components/wallet/wallet-card';
import { WithdrawalRequestForm } from '@/components/wallet/withdrawal-request-form';
import {
  useWallet,
  useWalletTransactions,
  type WalletTransactionFilters,
} from '@/hooks/use-wallet';
import { useMyWithdrawalRequests } from '@/hooks/use-withdrawal-requests';
import apiClient from '@/lib/api-client';
import { formatDate, formatNaira, truncate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import {
  TransactionStatus,
  TransactionType,
  UserRole,
  WithdrawalStatus,
} from '@zendocx/types';

const ALL_FILTER_VALUE = 'ALL';
const TRANSACTION_PAGE_LIMIT = 8;
const transactionStatusOptions: Array<{
  label: string;
  value: TransactionStatus | typeof ALL_FILTER_VALUE;
}> = [
  { label: 'All statuses', value: ALL_FILTER_VALUE },
  { label: 'Pending', value: TransactionStatus.PENDING },
  { label: 'Success', value: TransactionStatus.SUCCESS },
  { label: 'Failed', value: TransactionStatus.FAILED },
];

export default function WalletPage() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { wallet, loading, error, reload } = useWallet();
  const [fundingOpen, setFundingOpen] = useState(false);
  const [openTile, setOpenTile] = useState<string | null>(null);
  const [confirmingFunding, setConfirmingFunding] = useState(false);
  const [transactionFilters, setTransactionFilters] =
    useState<WalletTransactionFilters>({
      page: 1,
      limit: TRANSACTION_PAGE_LIMIT,
      type: ALL_FILTER_VALUE,
      status: ALL_FILTER_VALUE,
      startDate: '',
      endDate: '',
    });
  const {
    transactions,
    meta: transactionMeta,
    loading: transactionsLoading,
    error: transactionsError,
    reload: reloadTransactions,
  } = useWalletTransactions(transactionFilters);
  const {
    requests,
    summary,
    loading: withdrawalLoading,
    error: withdrawalError,
    reload: reloadWithdrawals,
  } = useMyWithdrawalRequests({ page: 1, limit: 6, status: 'ALL' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const panel = new URLSearchParams(window.location.search).get('panel');
    if (panel === 'report' || panel === 'history') {
      setOpenTile(panel);
      window.history.replaceState({}, '', '/wallet');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const reference = searchParams.get('reference');

    if (!reference || !hasHydrated || !user || !accessToken) {
      return;
    }

    let cancelled = false;

    const confirmFunding = async () => {
      setConfirmingFunding(true);

      try {
        const response = await apiClient.post<{
          message: string;
        }>('/wallet/fund/confirm', { reference });

        if (cancelled) {
          return;
        }

        toast.success(response.data.message);
        reload();
        reloadTransactions();
        window.history.replaceState({}, '', '/wallet');
      } catch {
        if (cancelled) {
          return;
        }

        toast.error(
          'We could not confirm your payment yet. Please try again or contact support.',
        );
      } finally {
        if (!cancelled) {
          setConfirmingFunding(false);
        }
      }
    };

    void confirmFunding();

    return () => {
      cancelled = true;
    };
  }, [accessToken, hasHydrated, reload, reloadTransactions, user]);

  if (loading) {
    return (
      <ProtectedShell title="Wallet">
        <WalletSkeleton />
      </ProtectedShell>
    );
  }

  if (!wallet || error) {
    return (
      <ProtectedShell title="Wallet">
        <EmptyState
          title="Wallet unavailable"
          message={error ?? 'We could not load wallet details right now.'}
          icon={WalletIcon}
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
      </ProtectedShell>
    );
  }

  const hasTransactionFilters =
    (transactionFilters.type && transactionFilters.type !== ALL_FILTER_VALUE) ||
    (transactionFilters.status &&
      transactionFilters.status !== ALL_FILTER_VALUE) ||
    Boolean(transactionFilters.startDate) ||
    Boolean(transactionFilters.endDate);

  const isRequesterOnly = user?.role === UserRole.INDIVIDUAL;
  const isCbt = user?.role === UserRole.CBT_CENTER;
  const isTenantAdmin = user?.role === UserRole.TENANT_ADMIN;
  const isPlatformOwner = user?.role === UserRole.SUPER_ADMIN;
  const canRequestWithdrawal = isCbt || isTenantAdmin || isPlatformOwner;
  const canTryOnlineFunding =
    user?.role === UserRole.INDIVIDUAL ||
    user?.role === UserRole.CBT_CENTER ||
    user?.role === UserRole.SUPER_ADMIN;

  const transactionTypeOptions: Array<{
    label: string;
    value: TransactionType | typeof ALL_FILTER_VALUE;
  }> = isRequesterOnly
    ? [
        { label: 'All types', value: ALL_FILTER_VALUE },
        { label: 'Funding', value: TransactionType.WALLET_FUNDING },
        { label: 'Service purchase', value: TransactionType.SERVICE_PURCHASE },
        { label: 'Funds placed on hold', value: TransactionType.ESCROW_LOCK },
        { label: 'Funds released', value: TransactionType.ESCROW_RELEASE },
        { label: 'Refund', value: TransactionType.REFUND },
      ]
    : isCbt
      ? [
          { label: 'All types', value: ALL_FILTER_VALUE },
          { label: 'Funding', value: TransactionType.WALLET_FUNDING },
          { label: 'Funds released', value: TransactionType.ESCROW_RELEASE },
          { label: 'CBT earnings', value: TransactionType.CBT_COMMISSION },
          { label: 'Withdrawal', value: TransactionType.WITHDRAWAL },
          { label: 'Refund', value: TransactionType.REFUND },
          { label: 'Penalty', value: TransactionType.PENALTY },
        ]
      : isTenantAdmin
        ? [
            { label: 'All types', value: ALL_FILTER_VALUE },
            { label: 'Funding', value: TransactionType.WALLET_FUNDING },
            { label: 'Business spending', value: TransactionType.SERVICE_PURCHASE },
            { label: 'Held funds', value: TransactionType.ESCROW_LOCK },
            { label: 'Released funds', value: TransactionType.ESCROW_RELEASE },
            { label: 'Withdrawal', value: TransactionType.WITHDRAWAL },
            { label: 'Refund', value: TransactionType.REFUND },
          ]
        : [
          { label: 'All types', value: ALL_FILTER_VALUE },
          { label: 'Funding', value: TransactionType.WALLET_FUNDING },
          { label: 'Service purchase', value: TransactionType.SERVICE_PURCHASE },
          { label: 'Funds placed on hold', value: TransactionType.ESCROW_LOCK },
          { label: 'Funds released', value: TransactionType.ESCROW_RELEASE },
          { label: 'Platform commission', value: TransactionType.PLATFORM_COMMISSION },
          { label: 'Withdrawal', value: TransactionType.WITHDRAWAL },
          { label: 'Refund', value: TransactionType.REFUND },
          { label: 'Penalty', value: TransactionType.PENALTY },
        ];

  const walletHeroDescription = isRequesterOnly
    ? 'See what you can spend now, what is still reserved for open requests, and the latest wallet movement.'
    : isCbt
      ? 'Track released earnings, funds still on hold, and recent payout-related movement.'
      : isTenantAdmin
        ? 'Run the business wallet from one place: see cleared money, held funds, and when the business is ready for payout.'
      : isPlatformOwner
        ? 'Track platform-held money, released balances, and withdrawal activity without jumping between screens.'
        : 'See what is available now, what is on hold, and the latest wallet movement.';

  const payoutsHeading =
    isTenantAdmin
      ? 'Business payouts'
      : isPlatformOwner
        ? 'Wallet withdrawals'
        : 'Withdrawal requests';

  const payoutsDescription =
    isTenantAdmin
      ? 'Move cleared business funds out of the wallet, track payout requests, and keep the finance trail easy to follow.'
      : 'Submit a withdrawal request when funds are ready, then track review and payout progress from one place.';

  return (
    <ProtectedShell title="Wallet">
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:space-y-6 md:p-8">
        <FundWalletModal
          open={fundingOpen}
          onClose={() => setFundingOpen(false)}
          onSuccess={reload}
        />

        <PageHeader
          title={
            isTenantAdmin
              ? 'Business Wallet'
              : isPlatformOwner
                ? 'Platform Wallet'
              : 'Wallet'
          }
          description={walletHeroDescription}
        />

        {confirmingFunding ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
            <RefreshCcw size={14} className="animate-spin" />
            Confirming payment...
          </div>
        ) : null}

        <WalletCard
          availableBalance={wallet.availableBalance}
          escrowBalance={wallet.escrowBalance}
          className="min-h-[18rem]"
          onFundClick={canTryOnlineFunding ? () => setFundingOpen(true) : undefined}
          actionLabel="Fund wallet"
          secondaryAction={
            canRequestWithdrawal
              ? {
                  label: 'Payouts',
                  icon: 'withdraw',
                  onClick: () => setOpenTile('payouts'),
                }
              : undefined
          }
        />

        <div
          className={cn(
            'grid grid-cols-2 gap-2.5 md:gap-3',
            isRequesterOnly ? 'md:grid-cols-3' : 'md:grid-cols-4',
          )}
        >
          <StatCard
            title="Ready now"
            value={formatNaira(wallet.availableBalance)}
            icon={WalletIcon}
            variant="navy"
          />
          <StatCard
            title="Reserved"
            value={formatNaira(wallet.escrowBalance)}
            icon={Clock3}
            variant="orange"
          />
          {!isRequesterOnly ? (
            <StatCard
              title={
                isCbt
                  ? 'Earned'
                  : isTenantAdmin
                    ? 'Business earnings'
                    : 'Platform earnings'
              }
              value={formatNaira(wallet.totalEarned)}
              icon={ArrowUpRight}
              variant="green"
            />
          ) : null}
          {!isRequesterOnly ? (
            <StatCard
              title="Withdrawn"
              value={formatNaira(wallet.totalWithdrawn)}
              icon={Landmark}
              variant="teal"
            />
          ) : (
            <StatCard
              title="Transactions"
              value={wallet.transactionCount.toString()}
              icon={ReceiptText}
              variant="teal"
            />
          )}
        </div>

        {/* Tile grid */}
        <div
          className={cn(
            'grid grid-cols-2 gap-3',
            canRequestWithdrawal ? 'sm:grid-cols-4' : 'sm:grid-cols-2',
          )}
        >
          {canRequestWithdrawal ? (
            <DashTile
              icon={Landmark}
              label="Payouts"
              value={formatNaira(summary?.pendingAmount ?? '0') + ' pending'}
              color="bg-amber-500 text-white"
              onClick={() => setOpenTile('payouts')}
            />
          ) : null}
          {canRequestWithdrawal ? (
            <DashTile
              icon={ArrowUpRight}
              label="Withdrawal"
              value={`${summary?.completedCount ?? 0} completed`}
              color="bg-emerald-600 text-white"
              onClick={() => setOpenTile('withdrawals')}
            />
          ) : null}
          <DashTile
            icon={ReceiptText}
            label="Wallet Report"
            value={`${wallet.transactionCount} records`}
            color="bg-[#0D1B3E] text-white"
            onClick={() => setOpenTile('report')}
          />
          <DashTile
            icon={History}
            label="Transaction History"
            value={`${wallet.recentTransactions.length} recent`}
            color="bg-cyan-600 text-white"
            onClick={() => setOpenTile('history')}
          />
        </div>

        {/* Payouts modal */}
        <DetailModal
          open={openTile === 'payouts'}
          onClose={() => setOpenTile(null)}
          title={payoutsHeading}
          description={payoutsDescription}
          width="lg"
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <BalanceRow
                label="Available now"
                value={formatNaira(wallet.availableBalance)}
                tone="strong"
              />
              <BalanceRow
                label="Waiting review"
                value={formatNaira(summary?.pendingAmount ?? '0')}
              />
              <BalanceRow
                label="Processing"
                value={formatNaira(summary?.processingAmount ?? '0')}
              />
              <BalanceRow
                label="Completed"
                value={formatNaira(summary?.completedAmount ?? '0')}
              />
            </div>
            <FeedbackBanner
              tone="info"
              title="What this action does"
              message={
                isTenantAdmin
                  ? 'Submit a payout request when the business has cleared funds. The amount is reserved immediately so finance review stays consistent.'
                  : 'Submit a withdrawal request once funds are available. The amount is reserved immediately while it moves through review and payout processing.'
              }
            />
            <WithdrawalRequestForm />
          </div>
        </DetailModal>

        {/* Withdrawal history modal */}
        <DetailModal
          open={openTile === 'withdrawals'}
          onClose={() => setOpenTile(null)}
          title="Withdrawal history"
          description="Recent payout requests and their review status."
          width="lg"
        >
          {withdrawalError ? (
            <EmptyState
              title="Withdrawal history unavailable"
              message={withdrawalError}
              icon={Landmark}
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
          ) : withdrawalLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <TransactionSkeleton key={index} />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              title="No withdrawal requests yet"
              message="As soon as a payout request is submitted, it will appear here with its review status and destination account."
              icon={Landmark}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <BalanceRow
                  label="Pending count"
                  value={String(summary?.pendingCount ?? 0)}
                />
                <BalanceRow
                  label="Completed count"
                  value={String(summary?.completedCount ?? 0)}
                />
              </div>
              <ScrollCardBody bodyClassName="space-y-3">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {request.bankName} · {request.accountName}
                          </p>
                          <WithdrawalStatusBadge status={request.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {request.accountNumber} · Requested {formatDate(request.createdAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {request.processorNote ?? 'No finance note yet.'}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-900">
                        {formatNaira(request.amount)}
                      </span>
                    </div>
                  </article>
                ))}
              </ScrollCardBody>
            </div>
          )}
        </DetailModal>

        {/* Wallet Report modal */}
        <DetailModal
          open={openTile === 'report'}
          onClose={() => setOpenTile(null)}
          title="Wallet Report"
          description={
            isRequesterOnly
              ? 'Filter by type, status, or date range to review funding, spending, held funds, releases, and refunds.'
              : isCbt
                ? 'Filter by type, status, or date range to track earnings, withdrawals, and payout-related movement.'
                : 'Filter by type, status, or date range to review balance movement without leaving this workspace.'
          }
          width="xl"
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FilterSelect
                label="Transaction type"
                value={transactionFilters.type ?? ALL_FILTER_VALUE}
                options={transactionTypeOptions}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    type: value as WalletTransactionFilters['type'],
                  }));
                }}
              />
              <FilterSelect
                label="Status"
                value={transactionFilters.status ?? ALL_FILTER_VALUE}
                options={transactionStatusOptions}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    status: value as WalletTransactionFilters['status'],
                  }));
                }}
              />
              <DateField
                label="From"
                value={transactionFilters.startDate ?? ''}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    startDate: value,
                  }));
                }}
              />
              <DateField
                label="To"
                value={transactionFilters.endDate ?? ''}
                onChange={(value) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    endDate: value,
                  }));
                }}
              />
            </div>

            <div className="flex flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Filter size={16} className="text-slate-400" />
                <span>
                  {transactionMeta
                    ? `${transactionMeta.total} transaction${transactionMeta.total === 1 ? '' : 's'} matched`
                    : 'Loading transactions...'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTransactionFilters({
                    page: 1,
                    limit: TRANSACTION_PAGE_LIMIT,
                    type: ALL_FILTER_VALUE,
                    status: ALL_FILTER_VALUE,
                    startDate: '',
                    endDate: '',
                  });
                }}
                disabled={!hasTransactionFilters}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear filters
              </button>
            </div>

            {transactionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <TransactionSkeleton key={index} />
                ))}
              </div>
            ) : transactionsError ? (
              <EmptyState
                title="Transactions unavailable"
                message={transactionsError}
                icon={ReceiptText}
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
            ) : transactions.length === 0 ? (
              <EmptyState
                title={
                  hasTransactionFilters
                    ? 'No transactions match these filters'
                    : 'No transactions to show yet'
                }
                message={
                  hasTransactionFilters
                    ? 'Try broadening the filters to see more wallet activity.'
                    : 'As soon as this wallet records funding, held funds, releases, or withdrawals, they will appear here.'
                }
                icon={hasTransactionFilters ? SearchSlash : ReceiptText}
              />
            ) : (
              <div className="space-y-4">
                <ScrollCardBody bodyClassName="space-y-3">
                  {transactions.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} />
                  ))}
                </ScrollCardBody>
                {transactionMeta ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setTransactionFilters((current) => ({
                          ...current,
                          page: Math.max((current.page ?? 1) - 1, 1),
                        }));
                      }}
                      disabled={transactionMeta.page <= 1}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous page
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTransactionFilters((current) => ({
                          ...current,
                          page: (current.page ?? 1) + 1,
                        }));
                      }}
                      disabled={!transactionMeta.hasNextPage}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next page
                    </button>
                  </div>
                ) : null}
                {transactionMeta ? (
                  <p className="text-xs text-slate-400">
                    Showing page {transactionMeta.page} of{' '}
                    {Math.max(transactionMeta.totalPages, 1)}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </DetailModal>

        {/* Transaction History modal */}
        <DetailModal
          open={openTile === 'history'}
          onClose={() => setOpenTile(null)}
          title="Transaction History"
          description="The most recent balance-moving events on this wallet."
          width="lg"
        >
          {wallet.recentTransactions.length === 0 ? (
            <EmptyState
              title="No recent activity yet"
              message="Recent wallet activity will appear here once the ledger starts moving."
              icon={ReceiptText}
            />
          ) : (
            <ScrollCardBody bodyClassName="space-y-3">
              {wallet.recentTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </ScrollCardBody>
          )}
        </DetailModal>
      </div>
    </ProtectedShell>
  );
}

function DashTile({ icon: Icon, label, value, color, onClick }: {
  icon: ElementType; label: string; value: string; color: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-sm active:scale-[0.98]"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </button>
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

function DateField({
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

function BalanceRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'strong';
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-2xl border px-4 py-3',
        tone === 'strong'
          ? 'border-[#0D1B3E]/10 bg-[#0D1B3E]/[0.03]'
          : 'border-slate-100 bg-slate-50/70',
      )}
    >
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="space-y-3">
        <SkeletonLine className="h-4 w-32" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-3 w-40" />
      </div>
    </div>
  );
}

function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  const tone =
    status === WithdrawalStatus.COMPLETED
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === WithdrawalStatus.REJECTED
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : status === WithdrawalStatus.PROCESSING ||
            status === WithdrawalStatus.APPROVED
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', tone)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: {
    type: TransactionType;
    status: TransactionStatus;
    amount: string;
    balanceAfter: string;
    reference: string;
    description: string;
    createdAt: string;
  };
}) {
  const amountTone =
    transaction.type === TransactionType.WITHDRAWAL ||
    transaction.type === TransactionType.SERVICE_PURCHASE ||
    transaction.type === TransactionType.ESCROW_LOCK ||
    transaction.type === TransactionType.PLATFORM_COMMISSION ||
    transaction.type === TransactionType.PENALTY
      ? 'negative'
      : 'positive';

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {getTransactionLabel(transaction.type)}
            </span>
            <StatusBadge status={transaction.status} />
          </div>
          <p className="text-sm leading-6 text-slate-500">
            {transaction.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>{formatDate(transaction.createdAt)}</span>
            <span>{truncate(transaction.reference, 24)}</span>
          </div>
        </div>
        <div className="text-left md:text-right">
          <p
            className={cn(
              'text-sm font-semibold',
              amountTone === 'positive' ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {amountTone === 'positive' ? '+' : '-'}
            {formatNaira(transaction.amount)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Balance: {formatNaira(transaction.balanceAfter)}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const tone =
    status === TransactionStatus.SUCCESS
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === TransactionStatus.PENDING
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-100 text-slate-600';

  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', tone)}>
      {status.replace('_', ' ')}
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
      return 'Wallet transaction';
  }
}

function WalletSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="space-y-3">
        <SkeletonLine className="h-8 w-52" />
        <SkeletonLine className="h-4 w-full max-w-2xl" />
      </div>
      <SkeletonBlock className="h-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-28" />
        ))}
      </div>
    </div>
  );
}
