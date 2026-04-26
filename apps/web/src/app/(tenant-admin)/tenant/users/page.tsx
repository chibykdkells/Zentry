'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useTenantUsers,
  useUpdateTenantUserRole,
} from '@/hooks/use-tenant-admin';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { UserRole } from '@zentry/types';
import { cn } from '@/lib/utils';

export default function TenantUsersPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      role: UserRole.INDIVIDUAL,
    }),
    [page, search],
  );

  const { users, pagination, loading, error, reload } = useTenantUsers(filters);
  const updateTenantUserRole = useUpdateTenantUserRole();
  const total = pagination?.total ?? users.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Customers"
        title="Customer directory"
        description="All individual customer accounts registered in this business portal. CBT centers are managed separately."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Total customers
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? '…' : total}
          </p>
          <p className="mt-1 text-sm text-slate-500">in this business portal</p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-amber-50/70 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Active filter
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {search ? `"${search}"` : 'All customers'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            CBT centers and admins are excluded from this view.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-emerald-50/70 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Role switching
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You can promote a customer to a CBT center operator directly from the record below.
          </p>
        </article>
      </div>

      <AccountPanel
        title="Customer list"
        description="Click any row to expand and manage that customer's account."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(searchInput.trim());
                  setPage(1);
                }
              }}
              placeholder="Search by name or email"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10 sm:w-60"
            />
            <button
              type="button"
              onClick={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
              className="rounded-2xl bg-brand-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
            >
              Search
            </button>
          </div>
        }
      >
        {updateTenantUserRole.error ? (
          <FeedbackBanner
            tone="error"
            message={getApiErrorMessage(
              updateTenantUserRole.error,
              "Could not update this customer's role right now.",
            )}
          />
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title="Customer list unavailable"
            message={error}
            icon={Users}
            action={
              <button
                type="button"
                onClick={reload}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Try again
              </button>
            }
          />
        ) : users.length ? (
          <div className="space-y-1">
            {/* Header row */}
            <div className="hidden grid-cols-[2fr_2fr_1fr_1fr] gap-4 rounded-2xl px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:grid">
              <span>Customer</span>
              <span>Email</span>
              <span>Status</span>
              <span>Joined</span>
            </div>

            {users.map((user) => {
              const isOpen = expandedId === user.id;
              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300"
                >
                  {/* Collapsed row — always visible */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : user.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-2xl px-4 py-3.5 text-left sm:grid-cols-[2fr_2fr_1fr_1fr_auto]"
                  >
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="hidden truncate text-sm text-slate-500 sm:block">
                      {user.email}
                    </span>
                    <span
                      className={cn(
                        'hidden text-sm font-medium sm:block',
                        user.isActive ? 'text-emerald-600' : 'text-rose-600',
                      )}
                    >
                      {user.isActive ? 'Active' : 'Paused'}
                    </span>
                    <span className="hidden text-sm text-slate-500 sm:block">
                      {formatDate(user.createdAt)}
                    </span>
                    <span className="text-slate-400">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {/* Expanded details */}
                  {isOpen ? (
                    <div className="border-t border-slate-100 px-4 pb-5 pt-4">
                      <dl className="grid gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-8">
                        <div className="flex items-center justify-between sm:contents">
                          <dt className="text-slate-500">Email</dt>
                          <dd className="font-medium text-slate-900">{user.email}</dd>
                        </div>
                        <div className="flex items-center justify-between sm:contents">
                          <dt className="text-slate-500">Phone</dt>
                          <dd className="font-medium text-slate-900">
                            {user.phone ?? 'Not provided'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between sm:contents">
                          <dt className="text-slate-500">Account status</dt>
                          <dd
                            className={cn(
                              'font-medium',
                              user.isActive ? 'text-emerald-600' : 'text-rose-600',
                            )}
                          >
                            {user.isActive ? 'Active' : 'Paused'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between sm:contents">
                          <dt className="text-slate-500">Email verified</dt>
                          <dd className="font-medium text-slate-900">
                            {user.isEmailVerified ? 'Yes' : 'Pending'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between sm:contents">
                          <dt className="text-slate-500">Phone verified</dt>
                          <dd className="font-medium text-slate-900">
                            {user.isPhoneVerified ? 'Yes' : 'Pending'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between sm:contents">
                          <dt className="text-slate-500">Last sign-in</dt>
                          <dd className="font-medium text-slate-900">
                            {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Role
                        </p>
                        <select
                          defaultValue={user.role}
                          onChange={(e) => {
                            const nextRole = e.target.value as UserRole;
                            if (nextRole === user.role) return;
                            updateTenantUserRole.mutate(
                              { userId: user.id, role: nextRole },
                              {
                                onSuccess: () => {
                                  toast.success(
                                    `${user.firstName} ${user.lastName} is now a ${
                                      nextRole === UserRole.CBT_CENTER
                                        ? 'CBT center'
                                        : 'customer'
                                    }.`,
                                  );
                                  setExpandedId(null);
                                },
                              },
                            );
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-button focus:ring-2 focus:ring-brand-button/10 sm:w-64"
                        >
                          <option value={UserRole.INDIVIDUAL}>Customer</option>
                          <option value={UserRole.CBT_CENTER}>CBT center operator</option>
                        </select>
                        <p className="mt-2 text-xs text-slate-400">
                          Promoting to CBT center moves this person out of the customer list into CBT management.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {pagination && pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                <p>
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} customers
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(p + 1, pagination.totalPages))
                    }
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
            title="No customers found"
            message={
              search
                ? `No customers match "${search}". Try a different name or email.`
                : 'Customers who register on this business portal will appear here.'
            }
            icon={Users}
          />
        )}
      </AccountPanel>
    </div>
  );
}
