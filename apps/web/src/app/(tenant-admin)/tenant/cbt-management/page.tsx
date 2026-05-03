'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { UserRole } from '@zendocx/types';
import { ShieldCheck } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { DetailModal } from '@/components/shared/detail-modal';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useDeleteTenantUser,
  useTenantUsers,
  useUpdateTenantUserRole,
} from '@/hooks/use-tenant-admin';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function TenantCbtManagementPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ page, limit: 12, search, role: UserRole.CBT_CENTER }),
    [page, search],
  );

  const { users, pagination, loading, error, reload } = useTenantUsers(filters);
  const updateTenantUserRole = useUpdateTenantUserRole();
  const deleteTenantUser = useDeleteTenantUser();
  const openUser = users.find((u) => u.id === openUserId) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <AccountPanel
        title="CBT centers"
        description="Licensed fulfillers registered in this business portal. Click any row to view details."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSearch(searchInput.trim());
                  setPage(1);
                }
              }}
              placeholder="Search name or email"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10 sm:w-56"
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
              'Could not update this CBT role right now.',
            )}
          />
        ) : null}

        {deleteTenantUser.error ? (
          <FeedbackBanner
            tone="error"
            message={getApiErrorMessage(
              deleteTenantUser.error,
              'Could not remove this CBT user right now.',
            )}
          />
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title="CBT center list unavailable"
            message={error}
            icon={ShieldCheck}
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
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} CBT centers
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(current + 1, pagination.totalPages))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No CBT centers found"
            message={
              search
                ? 'No CBT centers matched your search. Try a different name or email.'
                : 'CBT centers that register under this tenant portal will appear here.'
            }
            icon={ShieldCheck}
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
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  defaultValue={openUser.role}
                  onChange={(event) => {
                    const nextRole = event.target.value as UserRole;
                    if (nextRole === openUser.role) return;
                    updateTenantUserRole.mutate(
                      { userId: openUser.id, role: nextRole },
                      {
                        onSuccess: () => {
                          toast.success(
                            `${openUser.firstName} ${openUser.lastName} is now ${
                              nextRole === UserRole.CBT_CENTER ? 'a CBT center' : 'an individual user'
                            }.`,
                          );
                          setOpenUserId(null);
                        },
                      },
                    );
                  }}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-button focus:ring-2 focus:ring-brand-button/10"
                >
                  <option value={UserRole.CBT_CENTER}>CBT center</option>
                  <option value={UserRole.INDIVIDUAL}>Individual user</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Remove ${openUser.firstName} ${openUser.lastName} from this business?`,
                      )
                    )
                      return;
                    deleteTenantUser.mutate(openUser.id, {
                      onSuccess: () => {
                        toast.success(
                          `${openUser.firstName} ${openUser.lastName} was removed.`,
                        );
                        setOpenUserId(null);
                      },
                    });
                  }}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Remove
                </button>
              </div>
            </div>
          }
        >
          <dl className="grid gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-8">
            <div className="flex items-center justify-between sm:contents">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{openUser.phone}</dd>
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
