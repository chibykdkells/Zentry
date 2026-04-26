'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowUpRight,
  Clock3,
  Filter,
  Landmark,
  LockKeyhole,
  SearchSlash,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';
import { ProtectedShell } from '@/components/layout/protected-shell';
import { EmptyState } from '@/components/shared/empty-state';
import { AccountPanel } from '@/components/shared/account-panel';
import { PageHero } from '@/components/shared/page-hero';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import {
  SkeletonBlock,
  SkeletonLine,
} from '@/components/shared/skeleton-loader';
import { StatCard } from '@/components/shared/stat-card';
import { FundWalletModal } from '@/components/wallet/fund-wallet-modal';
import { WalletCard } from '@/components/wallet/wallet-card';
import {
  useWallet,
  useWalletTransactions,
  type WalletTransactionFilters,
} from '@/hooks/use-wallet';
import apiClient from '@/lib/api-client';
import { formatDate, formatNaira, truncate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { TransactionStatus, TransactionType, UserRole } from '@zentry/types';

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
  const { wallet, loading, error, reload } = useWallet();
  const [fundingOpen, setFundingOpen] = useState(false);
  const [confirmingSandboxFunding, setConfirmingSandboxFunding] =
    useState(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const reference = searchParams.get('reference');
    const checkout = searchParams.get('checkout');

    if (!reference || checkout !== 'sandbox') {
      return;
    }

    let cancelled = false;

    const confirmFunding = async () => {
      setConfirmingSandboxFunding(true);

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
          'We could not confirm that sandbox funding yet. Please try again.',
        );
      } finally {
        if (!cancelled) {
          setConfirmingSandboxFunding(false);
        }
      }
    };

    void confirmFunding();

    return () => {
      cancelled = true;
    };
  }, [reload, reloadTransactions]);

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
  const isPlatformOwner = user?.role === UserRole.SUPER_ADMIN;

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
    ? 'View what is available now, what is on hold for active requests, and recent wallet activity.'
    : isCbt
      ? 'Track released earnings, funds still on hold, and the wallet activity tied to jobs you completed.'
      : isPlatformOwner
        ? 'Track platform-held funds, released balances, and ledger activity tied to platform earnings and withdrawals.'
        : 'View what is available now, what is on hold, and recent wallet activity.';

  const balanceHealthDescription = isRequesterOnly
    ? 'A quick summary of what you can spend now, what is temporarily on hold for active requests, and how active this wallet has been.'
    : isCbt
      ? 'A quick summary of released earnings, funds still on hold, and payout movement in this wallet.'
      : isPlatformOwner
        ? 'A quick summary of what the platform wallet can use now, what is still on hold, and how much has moved through it.'
        : 'A quick summary of what is available now, what is on hold, and how active this wallet has been.';

  return (
    <ProtectedShell title="Wallet">
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:space-y-6 md:p-8">
        <FundWalletModal
          open={fundingOpen}
          onClose={() => setFundingOpen(false)}
          onSuccess={reload}
        />

        <PageHero
          eyebrow="Wallet"
          title="Wallet workspace"
          description={walletHeroDescription}
        />

        {confirmingSandboxFunding ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
            <RefreshCcw size={14} className="animate-spin" />
            Confirming sandbox funding...
          </div>
        ) : null}

        <div className="grid gap-5 md:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <WalletCard
            availableBalance={wallet.availableBalance}
            escrowBalance={wallet.escrowBalance}
            className="min-h-[18rem]"
            onFundClick={() => setFundingOpen(true)}
          />
          <AccountPanel
            title="Balance health"
            description={balanceHealthDescription}
            contentClassName="space-y-4"
          >
            <BalanceRow
              label="Available balance"
              value={formatNaira(wallet.availableBalance)}
              tone="strong"
            />
            <BalanceRow
              label="Funds on hold"
              value={formatNaira(wallet.escrowBalance)}
            />
            {!isRequesterOnly ? (
              <BalanceRow
                label={isCbt ? 'Total earned' : 'Total platform earnings'}
                value={formatNaira(wallet.totalEarned)}
              />
            ) : null}
            {!isRequesterOnly ? (
              <BalanceRow
                label="Total withdrawn"
                value={formatNaira(wallet.totalWithdrawn)}
              />
            ) : null}
            <BalanceRow
              label="Transactions on record"
              value={wallet.transactionCount.toString()}
            />
          </AccountPanel>
        </div>

        <div
          className={cn(
            'grid grid-cols-2 gap-2.5 md:gap-3',
            isRequesterOnly ? 'md:grid-cols-3' : 'md:grid-cols-4',
          )}
        >
          <StatCard
            title="Available"
            value={formatNaira(wallet.availableBalance)}
            icon={WalletIcon}
            variant="navy"
          />
          <StatCard
            title="On hold"
            value={formatNaira(wallet.escrowBalance)}
            icon={Clock3}
            variant="orange"
          />
          {!isRequesterOnly ? (
            <StatCard
              title={isCbt ? 'Earned' : 'Platform earnings'}
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

        <div className="grid gap-5 md:gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <AccountPanel
            title="Transaction history"
            description={
              isRequesterOnly
                ? 'Filter the live wallet ledger by type, status, or date range. This history focuses on funding, request spending, held funds, releases, and refunds.'
                : isCbt
                  ? 'Filter the live wallet ledger by type, status, or date range. This history focuses on released CBT earnings, withdrawals, and related wallet movement.'
                  : 'Filter the live wallet ledger by type, status, or date range. Funding confirmations now appear here as soon as they are credited.'
            }
            contentClassName="space-y-4"
          >
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
          </AccountPanel>

          <AccountPanel
            title="Latest activity snapshot"
            description={
              isRequesterOnly
                ? 'This compact view keeps your latest request-related wallet movement visible without making the full page longer.'
                : isCbt
                  ? 'This compact view keeps the most recent earnings and payout-related wallet movement visible without leaving the page.'
                  : 'This remains the compact five-item overview from the wallet summary API, so you can compare the filtered ledger with the latest balance-impacting activity quickly.'
            }
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
          </AccountPanel>
        </div>

        <AccountPanel
          title="Wallet readiness"
          description="These safeguards help prepare the wallet experience for funding, held funds, and withdrawals."
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <ReadinessRow
              icon={ShieldCheck}
              title="Protected access"
              description="Wallet access is tied to your authenticated session and refresh-token flow."
            />
            <ReadinessRow
              icon={LockKeyhole}
              title="PIN-backed operations"
              description="Wallet PIN APIs are already available on the backend for secure sensitive actions."
            />
            <ReadinessRow
              icon={RefreshCcw}
              title="Phase 2 ready"
              description="Funding, ledger history, and payout flows can plug into this layout without restructuring the page."
            />
          </div>
        </AccountPanel>
      </div>
    </ProtectedShell>
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

function ReadinessRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
        <Icon size={18} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
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
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="space-y-3">
        <SkeletonLine className="h-8 w-52" />
        <SkeletonLine className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
    </div>
  );
}
