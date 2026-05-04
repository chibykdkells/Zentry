'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LineChart, Search, ShieldCheck, Wallet } from 'lucide-react';
import { TransactionStatus, TransactionType, UserRole } from '@zendocx/types';
import { AdminWithdrawalReview } from '@/components/admin/admin-withdrawal-review';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import { useAdminWalletTransactions } from '@/hooks/use-admin-wallet-transactions';
import {
  useAdminCbtEarningsOverview,
  useAdminWalletOverview,
  useAdminWallets,
} from '@/hooks/use-admin-wallets';
import { usePlatformAdminTenants } from '@/hooks/use-platform-admin-tenants';
import { WithdrawalRequestForm } from '@/components/wallet/withdrawal-request-form';
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:flex md:h-full md:flex-col xl:overflow-hidden md:p-8">
      <PageHeader
        title="Finance"
        description="Platform earnings, customer funds, business balances, and payout activity."
        actions={
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
          >
            Dashboard
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
          title="What to watch first"
          description="These three checks answer most support and payout questions quickly."
        >
          <div className="space-y-4">
            {[
              {
                title: 'Money ready now',
                description:
                  'This is money that can be used or moved right away. It excludes funds that are still locked or under review.',
                icon: Wallet,
              },
              {
                title: 'Money still on hold',
                description:
                  'This is customer money waiting on service completion, dispute clearance, or release. It is not lost, but it is not free to use yet.',
                icon: ShieldCheck,
              },
              {
                title: 'Payouts to review',
                description:
                  'Use the withdrawal and CBT payout sections below to see what can leave the platform now and what is still blocked.',
                icon: LineChart,
              },
            ].map((item) => (
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
          title="Money summary"
          description="This separates customer balances, held money, Zendocx earnings, and payout history in one view."
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
                label="Wallets on platform"
                value={overview.totalWallets.toString()}
              />
              <FinanceRow
                label="Wallets holding money"
                value={overview.fundedWallets.toString()}
              />
              <FinanceRow
                label="Funding attempts still pending"
                value={overview.pendingFundingCount.toString()}
              />
              <FinanceRow
                label="Money ready now"
                value={formatNaira(overview.totalAvailableBalance)}
              />
              <FinanceRow
                label="Money still on hold"
                value={formatNaira(overview.totalEscrowBalance)}
              />
              <FinanceRow
                label="Money already paid out"
                value={formatNaira(overview.totalWithdrawn)}
              />
              <FinanceRow
                label="Zendocx earnings"
                value={formatNaira(overview.platformCommissionVolume)}
              />
              <FinanceRow
                label="CBT earnings released"
                value={formatNaira(overview.cbtCommissionVolume)}
              />
              <FinanceRow
                label="Withdrawal requests total"
                value={formatNaira(overview.withdrawalVolume)}
              />
              <FinanceRow
                label="Refunds returned"
                value={formatNaira(overview.refundVolume)}
              />
            </div>
          )}
        </AccountPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AccountPanel
          title="Businesses with money on hold"
          description="Use this when support needs to confirm where customer money is still waiting to clear."
        >
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
            Each amount here belongs to a business that is still holding customer money because a service or dispute flow is not finished yet.
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
          title="Move Zendocx earnings out"
          description="Use this when the platform owner needs to withdraw money that already belongs to Zendocx."
        >
          <WithdrawalRequestForm />
        </AccountPanel>
      </div>

      <AccountPanel
        title="CBT payout readiness"
        description="See what has already cleared, what is almost ready, and what is still blocked."
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
                label="CBT earnings already released"
                value={formatNaira(
                  cbtEarningsOverview.summary.releasedCommissionVolume,
                )}
              />
              <FinanceRow
                label="CBT money ready to withdraw"
                value={formatNaira(
                  cbtEarningsOverview.summary.totalCbtWithdrawableBalance,
                )}
              />
              <FinanceRow
                label="Still waiting"
                value={`${formatNaira(
                  cbtEarningsOverview.summary.awaitingReleaseAmount,
                )} · ${cbtEarningsOverview.summary.awaitingReleaseCount} job(s)`}
              />
              <FinanceRow
                label="Ready to release"
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
                label="Release entries"
                value={cbtEarningsOverview.summary.releasedCommissionCount.toString()}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <FinanceQueueBlock
                title="Ready to release"
                items={cbtEarningsOverview.queue.ready}
                emptyMessage="No completed CBT work is waiting to be released right now."
              />
              <FinanceQueueBlock
                title="Blocked by dispute"
                items={cbtEarningsOverview.queue.blocked}
                emptyMessage="No disputed CBT payouts are blocking release right now."
              />
            </div>
          </div>
        )}
      </AccountPanel>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AccountPanel
          title="CBT balances"
          description="See which CBT operators currently hold the largest ready balance and lifetime earnings."
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
          title="Latest CBT payouts released"
          description="Track the most recent CBT release entries together with the operator and service involved."
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
        title="Wallets by person"
        description="Search and filter wallet records across the platform to see where money is sitting and who is using it."
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
        title="All wallet movement"
        description="This feed brings funding, held money, commissions, refunds, and withdrawals into one review list."
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
              ? `${transactionMeta.total} wallet record${transactionMeta.total === 1 ? '' : 's'} matched`
              : 'Loading wallet activity...'}
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
            title="No wallet movement matched"
            message="Try broadening the filters to see more activity."
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
