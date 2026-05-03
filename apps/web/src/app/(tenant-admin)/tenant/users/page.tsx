'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Users } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useTenantUsers,
  useUpdateTenantUserRole,
} from '@/hooks/use-tenant-admin';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { UserRole } from '@zendocx/types';
import { cn } from '@/lib/utils';

export default function TenantUsersPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ page, limit: 20, search, role: UserRole.INDIVIDUAL }),
    [page, search],
  );

  const { users, pagination, loading, error, reload } = useTenantUsers(filters);
  const updateTenantUserRole = useUpdateTenantUserRole();
  const openUser = users.find((u) => u.id === openUserId) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <AccountPanel
        title="Customers"
        description="Individual accounts registered in this portal. Click any row to view details."
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
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setOpenUserId(user.id)}
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50/60"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                  {user.firstName} {user.lastName}
                </span>
                <span className="hidden max-w-[200px] truncate text-sm text-slate-500 sm:block">
                  {user.email}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                    user.isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700',
                  )}
                >
                  {user.isActive ? 'Active' : 'Paused'}
                </span>
                <span className="hidden shrink-0 text-sm text-slate-400 sm:block">
                  {formatDate(user.createdAt)}
                </span>
              </button>
            ))}

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
                    onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
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

      {openUser ? (
        <DetailModal
          open
          onClose={() => setOpenUserId(null)}
          title={`${openUser.firstName} ${openUser.lastName}`}
          description={openUser.email}
          width="md"
          footer={
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Change role
              </p>
              <select
                defaultValue={openUser.role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  if (nextRole === openUser.role) return;
                  updateTenantUserRole.mutate(
                    { userId: openUser.id, role: nextRole },
                    {
                      onSuccess: () => {
                        toast.success(
                          `${openUser.firstName} ${openUser.lastName} is now a ${
                            nextRole === UserRole.CBT_CENTER ? 'CBT center' : 'customer'
                          }.`,
                        );
                        setOpenUserId(null);
                      },
                    },
                  );
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-button focus:ring-2 focus:ring-brand-button/10"
              >
                <option value={UserRole.INDIVIDUAL}>Customer</option>
                <option value={UserRole.CBT_CENTER}>CBT center operator</option>
              </select>
              <p className="text-xs text-slate-400">
                Promoting to CBT center moves this person to the CBT management list.
              </p>
            </div>
          }
        >
          <dl className="grid gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-8">
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{openUser.phone ?? 'Not provided'}</dd>
            </div>
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Status</dt>
              <dd className={cn('font-medium', openUser.isActive ? 'text-emerald-600' : 'text-rose-600')}>
                {openUser.isActive ? 'Active' : 'Paused'}
              </dd>
            </div>
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Email verified</dt>
              <dd className="font-medium text-slate-900">
                {openUser.isEmailVerified ? 'Yes' : 'Pending'}
              </dd>
            </div>
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Phone verified</dt>
              <dd className="font-medium text-slate-900">
                {openUser.isPhoneVerified ? 'Yes' : 'Pending'}
              </dd>
            </div>
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Joined</dt>
              <dd className="font-medium text-slate-900">{formatDate(openUser.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Last sign-in</dt>
              <dd className="font-medium text-slate-900">
                {openUser.lastLoginAt ? formatDate(openUser.lastLoginAt) : 'Never'}
              </dd>
            </div>
          </dl>
        </DetailModal>
      ) : null}
    </div>
  );
}
