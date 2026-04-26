'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LineChart, Search, ShieldCheck, Wallet } from 'lucide-react';
import { TransactionStatus, TransactionType, UserRole } from '@zentry/types';
import { AdminWithdrawalReview } from '@/components/admin/admin-withdrawal-review';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { InfoHint } from '@/components/shared/info-hint';
import { PageHero } from '@/components/shared/page-hero';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import { useAdminWalletTransactions } from '@/hooks/use-admin-wallet-transactions';
import {
  useAdminCbtEarningsOverview,
  useAdminWalletOverview,
  useAdminWallets,
} from '@/hooks/use-admin-wallets';
import { usePlatformAdminTenants } from '@/hooks/use-platform-admin-tenants';
import { WithdrawalRequestForm } from '@/components/wallet/withdrawal-request-form';
import { adminFinanceSections } from '@/lib/admin-content';
import { formatDate, formatNaira, formatTimeUntil } from '@/lib/format';

const ALL_ROLE_FILTER = 'ALL';
const ADMIN_WALLET_PAGE_LIMIT = 8;
const ADMIN_TRANSACTION_PAGE_LIMIT = 8;
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

  const statCards = overview
    ? [
        {
          title: 'Available across wallets',
          value: formatNaira(overview.totalAvailableBalance),
          icon: Wallet,
        },
        {
          title: 'Funds on hold',
          value: formatNaira(overview.totalEscrowBalance),
          icon: ShieldCheck,
        },
        {
          title: 'Platform earnings',
          value: formatNaira(overview.platformCommissionVolume),
          icon: LineChart,
        },
        {
          title: 'CBT payouts',
          value: formatNaira(overview.cbtCommissionVolume),
          icon: LineChart,
        },
        {
          title: 'Withdrawal volume',
          value: formatNaira(overview.withdrawalVolume),
          icon: LineChart,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:flex md:h-full md:flex-col md:overflow-hidden md:p-8">
      <PageHero
        eyebrow="Admin Finance"
        title="Track platform money, tenant exposure, and withdrawal activity"
        description="See platform earnings alongside customer balances, held funds, and withdrawal requests that still need review."
        actions={
          <Link
            href="/admin/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Return to dashboard
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <article
                key={index}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="h-11 w-11 rounded-2xl bg-slate-100" />
                <div className="mt-5 h-8 w-24 rounded-xl bg-slate-100" />
                <div className="mt-2 h-4 w-28 rounded-xl bg-slate-100" />
              </article>
            ))
          : statCards.map((item) => (
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
          title="Finance guide"
          description="Keep the money language simple so support review and payout decisions are easier to understand."
        >
          <div className="space-y-4">
            {adminFinanceSections.map((item) => (
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
          title="Platform wallet totals"
          description="These totals separate true platform earnings from the wider wallet balances and held customer funds moving across the platform."
        >
          {error || !overview ? (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <EmptyState
                title="Finance data unavailable"
                message={
                  error ??
                  'We could not load platform finance visibility right now.'
                }
                icon={Wallet}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      reload();
                      reloadWallets();
                      reloadCbtEarnings();
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Try again
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              <FinanceRow
                label="Total wallets"
                value={overview.totalWallets.toString()}
              />
              <FinanceRow
                label="Wallets with balances or earnings"
                value={overview.fundedWallets.toString()}
              />
              <FinanceRow
                label="Pending funding references"
                value={overview.pendingFundingCount.toString()}
              />
              <FinanceRow
                label="Available across all wallets"
                value={formatNaira(overview.totalAvailableBalance)}
              />
              <FinanceRow
                label="Total held funds"
                value={formatNaira(overview.totalEscrowBalance)}
              />
              <FinanceRow
                label="Total withdrawn"
                value={formatNaira(overview.totalWithdrawn)}
              />
              <FinanceRow
                label="Platform earnings"
                value={formatNaira(overview.platformCommissionVolume)}
              />
              <FinanceRow
                label="CBT payout volume"
                value={formatNaira(overview.cbtCommissionVolume)}
              />
              <FinanceRow
                label="Withdrawal volume"
                value={formatNaira(overview.withdrawalVolume)}
              />
              <FinanceRow
                label="Refund volume"
                value={formatNaira(overview.refundVolume)}
              />
            </div>
          )}
        </AccountPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AccountPanel
          title="Held funds by business"
          description="Use this support view when you need to confirm which business portals currently have customer money still on hold."
        >
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
            <InfoHint text="Held funds are payments that are still waiting for service completion, dispute clearance, or release." />
            This is the business-by-business support view of funds still on hold.
          </div>
          {(overview?.heldFundsByTenant?.length ?? 0) ? (
            <div className="mt-4 space-y-3">
              {(overview?.heldFundsByTenant ?? []).slice(0, 8).map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                      {tenant.slug}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatNaira(tenant.heldFunds)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No business is holding customer funds right now"
              message="When customer payments are still waiting for completion or release, they will appear here."
              icon={Wallet}
            />
          )}
        </AccountPanel>

        <AccountPanel
          title="Platform owner withdrawal request"
          description="If the platform owner needs to move platform earnings out, this request will reserve the amount and add it to the ledger for review."
        >
          <WithdrawalRequestForm />
        </AccountPanel>
      </div>

      <AccountPanel
        title="CBT earnings visibility"
        description="Separate what has already been released from what is still waiting on the dispute window or blocked by disputes."
      >
        {cbtEarningsError ? (
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50">
            <EmptyState
              title="CBT earnings visibility unavailable"
              message={cbtEarningsError}
              icon={LineChart}
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
          </div>
        ) : cbtEarningsLoading || !cbtEarningsOverview ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
              >
                <div className="h-5 w-32 rounded-xl bg-slate-100" />
                <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FinanceRow
                label="Released CBT commission volume"
                value={formatNaira(
                  cbtEarningsOverview.summary.releasedCommissionVolume,
                )}
              />
              <FinanceRow
                label="Total CBT withdrawable balance"
                value={formatNaira(
                  cbtEarningsOverview.summary.totalCbtWithdrawableBalance,
                )}
              />
              <FinanceRow
                label="Awaiting release"
                value={`${formatNaira(
                  cbtEarningsOverview.summary.awaitingReleaseAmount,
                )} · ${cbtEarningsOverview.summary.awaitingReleaseCount} job(s)`}
              />
              <FinanceRow
                label="Ready for release"
                value={`${formatNaira(
                  cbtEarningsOverview.summary.readyReleaseAmount,
                )} · ${cbtEarningsOverview.summary.readyReleaseCount} job(s)`}
              />
              <FinanceRow
                label="Blocked by dispute"
                value={`${formatNaira(
                  cbtEarningsOverview.summary.blockedReleaseAmount,
                )} · ${cbtEarningsOverview.summary.blockedReleaseCount} job(s)`}
              />
              <FinanceRow
                label="Released commission entries"
                value={cbtEarningsOverview.summary.releasedCommissionCount.toString()}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <FinanceQueueBlock
                title="Ready release queue"
                items={cbtEarningsOverview.queue.ready}
                emptyMessage="No completed CBT work is waiting to be released right now."
              />
              <FinanceQueueBlock
                title="Blocked release queue"
                items={cbtEarningsOverview.queue.blocked}
                emptyMessage="No disputed CBT payouts are blocking release right now."
              />
            </div>
          </div>
        )}
      </AccountPanel>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AccountPanel
          title="Top CBT balances"
          description="See which operators currently hold the largest released balances and lifetime earnings."
        >
          {cbtEarningsLoading || !cbtEarningsOverview ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="h-5 w-40 rounded-xl bg-slate-100" />
                  <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : cbtEarningsOverview.topCbtWallets.length ? (
            <ScrollCardBody bodyClassName="space-y-3">
              {cbtEarningsOverview.topCbtWallets.map((wallet) => (
                <article
                  key={wallet.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {wallet.user.firstName} {wallet.user.lastName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{wallet.user.email}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <WalletMetric
                        label="Withdrawable"
                        value={formatNaira(wallet.availableBalance)}
                      />
                      <WalletMetric
                        label="Earned"
                        value={formatNaira(wallet.totalEarned)}
                      />
                      <WalletMetric
                        label="Withdrawn"
                        value={formatNaira(wallet.totalWithdrawn)}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </ScrollCardBody>
          ) : (
            <EmptyState
              title="No CBT wallet visibility yet"
              message="Once released earnings accumulate across CBT centers, the top balance view will appear here."
              icon={Wallet}
            />
          )}
        </AccountPanel>

        <AccountPanel
          title="Recent released CBT commissions"
          description="Track the latest released commission entries together with the operator and service involved."
        >
          {cbtEarningsLoading || !cbtEarningsOverview ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="h-5 w-48 rounded-xl bg-slate-100" />
                  <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : cbtEarningsOverview.recentReleased.length ? (
            <ScrollCardBody bodyClassName="space-y-3">
              {cbtEarningsOverview.recentReleased.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.cbt.firstName} {item.cbt.lastName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.order?.service.name ?? 'Unknown service'} ·{' '}
                        {item.order?.orderNumber ?? item.reference}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Released {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                      {formatNaira(item.amount)}
                    </span>
                  </div>
                </article>
              ))}
            </ScrollCardBody>
          ) : (
            <EmptyState
              title="No released CBT commissions yet"
              message="Released payout entries will appear here once more jobs clear the dispute window."
              icon={LineChart}
            />
          )}
        </AccountPanel>
      </div>

      <AccountPanel
        title="User wallets"
        description="Search and filter wallet records across the platform so finance review can quickly spot where balance is sitting and which roles are generating activity."
        contentClassName="space-y-4"
      >
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.7fr_0.7fr_auto]">
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
                placeholder="Search by name or email"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              Role
            </span>
            <select
              value={filters.role}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  role: event.target.value as UserRole | typeof ALL_ROLE_FILTER,
                }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              Business
            </span>
            <select
              value={filters.tenantId}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  tenantId: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            >
              <option value={ALL_ROLE_FILTER}>All businesses</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>

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
            Clear filters
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
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="h-5 w-40 rounded-xl bg-slate-100" />
                <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
                <div className="mt-2 h-4 w-3/4 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : wallets.length === 0 ? (
          <EmptyState
            title="No wallets matched these filters"
            message="Try broadening the search or resetting the role filter."
            icon={Wallet}
          />
        ) : (
          <ScrollCardBody bodyClassName="space-y-3">
            {wallets.map((wallet) => (
              <article
                key={wallet.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {wallet.user.firstName} {wallet.user.lastName}
                      </h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {wallet.user.role.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          wallet.user.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {wallet.user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{wallet.user.email}</p>
                    <p className="text-xs text-slate-400">
                      Updated {formatDate(wallet.updatedAt)}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                    <WalletMetric
                      label="Transactions"
                      value={wallet.transactionCount.toString()}
                    />
                  </div>
                </div>
              </article>
            ))}

            {meta ? (
              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">
                  Showing page {meta.page} of {Math.max(meta.totalPages, 1)} for{' '}
                  {meta.total} wallet{meta.total === 1 ? '' : 's'}
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
          </ScrollCardBody>
        )}
      </AccountPanel>

      <AccountPanel
        title="Platform wallet activity"
        description="This transaction feed brings funding, held-fund movement, commissions, refunds, and withdrawals into one admin review surface."
        contentClassName="space-y-4"
      >
        <div className="grid gap-3 lg:grid-cols-3">
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
                value={transactionFilters.search}
                onChange={(event) => {
                  setTransactionFilters((current) => ({
                    ...current,
                    page: 1,
                    search: event.target.value,
                  }));
                }}
                placeholder="Search by reference, user, email"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
            </div>
          </label>
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
          <p className="text-sm text-slate-500">
            {transactionMeta
              ? `${transactionMeta.total} finance transaction${transactionMeta.total === 1 ? '' : 's'} matched`
              : 'Loading finance activity...'}
          </p>
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
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="h-5 w-48 rounded-xl bg-slate-100" />
                <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
                <div className="mt-2 h-4 w-2/3 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No platform transactions matched"
            message="Try broadening the filters to see more wallet movement."
            icon={Wallet}
          />
        ) : (
          <ScrollCardBody bodyClassName="space-y-3">
            {transactions.map((transaction) => (
              <article
                key={transaction.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {getTransactionLabel(transaction.type)}
                      </span>
                      <StatusBadge status={transaction.status} />
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {transaction.user.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {transaction.user.firstName} {transaction.user.lastName} ·{' '}
                      {transaction.user.email}
                    </p>
                    <p className="text-sm leading-6 text-slate-500">
                      {transaction.description}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>{transaction.reference}</span>
                      <span>{formatDate(transaction.createdAt)}</span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <WalletMetric
                      label="Amount"
                      value={formatNaira(transaction.amount)}
                    />
                    <WalletMetric
                      label="Before"
                      value={formatNaira(transaction.balanceBefore)}
                    />
                    <WalletMetric
                      label="After"
                      value={formatNaira(transaction.balanceAfter)}
                    />
                  </div>
                </div>
              </article>
            ))}

            {transactionMeta ? (
              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">
                  Showing page {transactionMeta.page} of{' '}
                  {Math.max(transactionMeta.totalPages, 1)} for{' '}
                  {transactionMeta.total} transaction
                  {transactionMeta.total === 1 ? '' : 's'}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionFilters((current) => ({
                        ...current,
                        page: Math.max(current.page - 1, 1),
                      }));
                    }}
                    disabled={transactionMeta.page <= 1}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionFilters((current) => ({
                        ...current,
                        page: current.page + 1,
                      }));
                    }}
                    disabled={!transactionMeta.hasNextPage}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </ScrollCardBody>
        )}
      </AccountPanel>

      <AdminWithdrawalReview />
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
    cbt: {
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
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <ScrollCardBody bodyClassName="space-y-3" maxHeightClassName="max-h-[18rem]">
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
                    {item.cbt
                      ? `${item.cbt.firstName} ${item.cbt.lastName}`
                      : 'No CBT assigned'}{' '}
                    · {item.orderNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.dispute
                      ? item.dispute.reason
                      : item.disputeWindowExpiresAt
                        ? formatTimeUntil(item.disputeWindowExpiresAt)
                        : 'Ready for processing'}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-900">
                  {formatNaira(item.amount)}
                </span>
              </div>
            </article>
          ))}
        </ScrollCardBody>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </div>
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

function FinanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function WalletMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
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
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status}
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
