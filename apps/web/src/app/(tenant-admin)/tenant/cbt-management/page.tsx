'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { UserRole } from '@zentry/types';
import { ShieldCheck } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useDeleteTenantUser,
  useTenantUsers,
  useUpdateTenantUserRole,
} from '@/hooks/use-tenant-admin';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';

export default function TenantCbtManagementPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({ page, limit: 12, search, role: UserRole.CBT_CENTER }),
    [page, search],
  );

  const { users, pagination, loading, error, reload } = useTenantUsers(filters);
  const updateTenantUserRole = useUpdateTenantUserRole();
  const deleteTenantUser = useDeleteTenantUser();
  const visibleCbtCenters = pagination?.total ?? users.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="CBT centers"
        title="Licensed fulfillers operating in this portal"
        description="See every CBT center registered under this tenant. Use the search to quickly locate a specific center by name or email."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-amber-50/70 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Visible now
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? '...' : visibleCbtCenters}
          </p>
          <p className="mt-1 text-sm text-slate-500">CBT centers in this business</p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Search state
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {search ? `Filtered by "${search}"` : 'Showing the full CBT center directory'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Individual users stay on their own customer page so the fulfilment network stays easier to read.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-emerald-50/70 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Operations view
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Use this workspace when you want to review fulfilment partners only, without customer-account noise.
          </p>
        </article>
      </section>

      <AccountPanel
        title="CBT center directory"
        description="CBT centers registered within this business portal."
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
              Search directory
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
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-28 rounded-[1.5rem]" />
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
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {users.map((user) => (
                <article
                  key={user.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                    </div>
                    <span
                      className={[
                        'rounded-full px-3 py-1 text-xs font-semibold shadow-sm',
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700',
                      ].join(' ')}
                    >
                      {user.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-4">
                      <dt>Phone</dt>
                      <dd>{user.phone}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>Email verified</dt>
                      <dd>{user.isEmailVerified ? 'Yes' : 'Pending'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>Joined</dt>
                      <dd>{formatDate(user.createdAt)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>Last sign-in</dt>
                      <dd>{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Not yet'}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Business admin controls
                    </p>
                    <div className="mt-3 flex flex-col gap-3">
                      <select
                        defaultValue={user.role}
                        onChange={(event) => {
                          const nextRole = event.target.value as UserRole;
                          if (nextRole === user.role) {
                            return;
                          }

                          updateTenantUserRole.mutate(
                            {
                              userId: user.id,
                              role: nextRole,
                            },
                            {
                              onSuccess: () => {
                                toast.success(
                                  `${user.firstName} ${user.lastName} is now ${
                                    nextRole === UserRole.CBT_CENTER ? 'a CBT center' : 'an individual user'
                                  }.`,
                                );
                              },
                            },
                          );
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-button focus:ring-2 focus:ring-brand-button/10"
                      >
                        <option value={UserRole.CBT_CENTER}>CBT center</option>
                        <option value={UserRole.INDIVIDUAL}>Individual user</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove ${user.firstName} ${user.lastName} from this business?`,
                            )
                          ) {
                            return;
                          }

                          deleteTenantUser.mutate(user.id, {
                            onSuccess: () => {
                              toast.success(
                                `${user.firstName} ${user.lastName} was removed from this business.`,
                              );
                            },
                          });
                        }}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Delete user
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                <p>
                  Page {pagination.page} of {pagination.totalPages} &bull;{' '}
                  {pagination.total} CBT centers
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
    </div>
  );
}
