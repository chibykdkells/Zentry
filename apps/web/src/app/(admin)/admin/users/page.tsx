'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Ban, Building2, Copy, PlusCircle, RefreshCcw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { UserRole } from '@zendocx/types';
import { AccountPanel } from '@/components/shared/account-panel';
import { Accordion, type AccordionItem } from '@/components/shared/accordion';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useCreateTenantAdmin,
  useCreateTenant,
  useDeleteTenantUser,
  useDismissTenantAdminAccess,
  type PlatformAdminTenantListItem,
  usePlatformAdminTenants,
  usePlatformAdminTenantUsers,
  useResetTenantAdminPassword,
  useToggleTenantUserActive,
} from '@/hooks/use-platform-admin-tenants';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

const roleOptions = [
  { label: 'Everyone in this business', value: 'ALL' as const },
  { label: 'Individuals', value: UserRole.INDIVIDUAL },
  { label: 'CBT centers', value: UserRole.CBT_CENTER },
  { label: 'Tenant admins', value: UserRole.TENANT_ADMIN },
];

function formatRoleLabel(role: UserRole) {
  switch (role) {
    case UserRole.CBT_CENTER:
      return 'CBT center';
    case UserRole.TENANT_ADMIN:
      return 'Business admin';
    case UserRole.SUPER_ADMIN:
      return 'Platform admin';
    case UserRole.INDIVIDUAL:
    default:
      return 'Individual';
  }
}

function buildSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function TenantAccordionBody({
  tenant,
  isOpen,
  origin,
}: {
  tenant: PlatformAdminTenantListItem;
  isOpen: boolean;
  origin: string;
}) {
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const [selectedTenantAdminDraft, setSelectedTenantAdminDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [tenantAdminMessage, setTenantAdminMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const createTenantAdmin = useCreateTenantAdmin();
  const resetTenantAdminPassword = useResetTenantAdminPassword();
  const dismissTenantAdminAccess = useDismissTenantAdminAccess();
  const toggleUserActive = useToggleTenantUserActive();
  const deleteUser = useDeleteTenantUser();

  const userFilters = useMemo(
    () => ({ page: 1, limit: 12, search: userSearch, role }),
    [role, userSearch],
  );

  const {
    users,
    meta: usersMeta,
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = usePlatformAdminTenantUsers(tenant.id, userFilters, { enabled: isOpen });

  const buildTenantLoginLink = (slug: string) => `${origin}/?tenant=${encodeURIComponent(slug)}`;

  return (
    <div className="space-y-4">
      {/* Signup links */}
      <div className="grid gap-3 md:grid-cols-2">
        <TenantDetailCard
          label="User signup link"
          value={`${origin}${tenant.signupLinks.individual}`}
          actionLabel="Copy"
          onAction={() => {
            void navigator.clipboard
              .writeText(`${window.location.origin}${tenant.signupLinks.individual}`)
              .then(() => toast.success('User signup link copied.'));
          }}
        />
        <TenantDetailCard
          label="CBT center signup link"
          value={`${origin}${tenant.signupLinks.cbt}`}
          actionLabel="Copy"
          onAction={() => {
            void navigator.clipboard
              .writeText(`${window.location.origin}${tenant.signupLinks.cbt}`)
              .then(() => toast.success('CBT signup link copied.'));
          }}
        />
        <TenantDetailCard
          label="Admin login link"
          value={buildTenantLoginLink(tenant.slug)}
          actionLabel="Copy"
          onAction={() => {
            void navigator.clipboard
              .writeText(buildTenantLoginLink(tenant.slug))
              .then(() => toast.success('Business admin login link copied.'));
          }}
        />
        <TenantDetailCard
          label="Admin accounts"
          value={
            tenant.metrics.tenantAdmins === 1
              ? '1 business admin account'
              : `${tenant.metrics.tenantAdmins} business admin accounts`
          }
        />
      </div>

      {/* Saved admin sign-in details */}
      <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Saved admin sign-in details</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Keep these details only while support needs them. Remove them after handoff, or reset the password if the admin needs a fresh temporary sign-in.
        </p>

        {tenant.tenantAdminAccesses.length ? (
          <div className="mt-4 space-y-3">
            {tenant.tenantAdminAccesses.map((access) => (
              <div key={access.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {access.user.firstName} {access.user.lastName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{access.email}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                      Created {formatDate(access.createdAt)}
                      {access.lastResetAt ? ` · Reset ${formatDate(access.lastResetAt)}` : ''}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TenantMiniMetric label="Login email" value={access.email} />
                    <TenantMiniMetric label="Portal link" value={buildTenantLoginLink(tenant.slug)} />
                    <TenantMiniMetric label="Temporary password" value={access.tempPassword} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(access.email)
                        .then(() => toast.success('Business admin login email copied.'))
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    <Copy size={14} />
                    Copy login email
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(buildTenantLoginLink(tenant.slug))
                        .then(() => toast.success('Business admin login link copied.'))
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    <Copy size={14} />
                    Copy login link
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(access.tempPassword)
                        .then(() => toast.success('Temporary password copied.'))
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    <Copy size={14} />
                    Copy password
                  </button>
                  <button
                    type="button"
                    disabled={resetTenantAdminPassword.isPending}
                    onClick={() => {
                      setTenantAdminMessage(null);
                      void resetTenantAdminPassword
                        .mutateAsync({ tenantId: tenant.id, userId: access.user.id })
                        .then((updatedAdmin) => {
                          setTenantAdminMessage(
                            `Password reset. Portal: ${buildTenantLoginLink(tenant.slug)} · Email: ${updatedAdmin.email} · Password: ${updatedAdmin.tempPassword}`,
                          );
                        })
                        .catch((error) => {
                          toast.error(getApiErrorMessage(error, 'Could not reset the password right now.'));
                        });
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resetTenantAdminPassword.isPending ? 'Resetting...' : 'Reset password'}
                  </button>
                  <button
                    type="button"
                    disabled={dismissTenantAdminAccess.isPending}
                    onClick={() => {
                      setTenantAdminMessage(null);
                      void dismissTenantAdminAccess
                        .mutateAsync({ tenantId: tenant.id, accessId: access.id })
                        .then(() => toast.success('Saved admin sign-in details removed.'))
                        .catch((error) => {
                          toast.error(getApiErrorMessage(error, 'Could not remove the saved access right now.'));
                        });
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {dismissTenantAdminAccess.isPending ? 'Removing...' : 'Remove saved details'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No saved admin sign-in details for this business.</p>
        )}
      </div>

      {/* Add another admin */}
      <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Add another business admin</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Creates another admin account and returns a temporary password to share securely.
        </p>

        {tenantAdminMessage ? (
          <div className="mt-4">
            <FeedbackBanner tone="success" message={tenantAdminMessage} />
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(['firstName', 'lastName', 'email', 'phone'] as const).map((field) => (
            <input
              key={field}
              value={selectedTenantAdminDraft[field]}
              onChange={(e) =>
                setSelectedTenantAdminDraft((current) => ({ ...current, [field]: e.target.value }))
              }
              placeholder={
                field === 'firstName'
                  ? 'First name'
                  : field === 'lastName'
                    ? 'Last name'
                    : field === 'email'
                      ? 'owner@business.com'
                      : '+2348012345678'
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
            />
          ))}
        </div>

        <button
          type="button"
          disabled={
            createTenantAdmin.isPending ||
            !selectedTenantAdminDraft.firstName.trim() ||
            !selectedTenantAdminDraft.lastName.trim() ||
            !selectedTenantAdminDraft.email.trim() ||
            !selectedTenantAdminDraft.phone.trim()
          }
          onClick={() => {
            setTenantAdminMessage(null);
            void createTenantAdmin
              .mutateAsync({
                tenantId: tenant.id,
                firstName: selectedTenantAdminDraft.firstName.trim(),
                lastName: selectedTenantAdminDraft.lastName.trim(),
                email: selectedTenantAdminDraft.email.trim(),
                phone: selectedTenantAdminDraft.phone.trim(),
              })
              .then((createdAdmin) => {
                setTenantAdminMessage(
                  `Admin created. Portal: ${buildTenantLoginLink(tenant.slug)} · Email: ${createdAdmin.email} · Password: ${createdAdmin.tempPassword}`,
                );
                setSelectedTenantAdminDraft({ firstName: '', lastName: '', email: '', phone: '' });
              })
              .catch((error) => {
                toast.error(getApiErrorMessage(error, 'Could not create the business admin right now.'));
              });
          }}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlusCircle size={16} />
          {createTenantAdmin.isPending ? 'Adding admin...' : 'Add business admin'}
        </button>
      </div>

      {/* People in this business */}
      <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">People in this business</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            value={userSearchInput}
            onChange={(e) => setUserSearchInput(e.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole | 'ALL')}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setUserSearch(userSearchInput.trim())}
            className="rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Apply
          </button>
        </div>

        <div className="mt-4">
          {usersError ? (
            <EmptyState
              title="People list unavailable"
              message={usersError}
              icon={Users}
              action={
                <button
                  type="button"
                  onClick={reloadUsers}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Try again
                </button>
              }
            />
          ) : usersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-28 rounded-[1.5rem]" />
              ))}
            </div>
          ) : users.length ? (
            <div className="space-y-3">
              {users.map((user) => (
                <article
                  key={user.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        user.isActive ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600',
                      )}
                    >
                      {formatRoleLabel(user.role)}
                      {!user.isActive ? ' · Inactive' : ''}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Phone: {user.phone}</p>
                    <p>Account state: {user.isActive ? 'Active' : 'Paused'}</p>
                    <p>Email: {user.isEmailVerified ? 'Verified' : 'Pending'}</p>
                    <p>Last sign-in: {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Not yet'}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={toggleUserActive.isPending}
                      onClick={() => {
                        void toggleUserActive
                          .mutateAsync({ tenantId: tenant.id, userId: user.id })
                          .then((res) =>
                            toast.success(
                              res.isActive ? `${user.firstName} reactivated.` : `${user.firstName} deactivated.`,
                            ),
                          )
                          .catch((err) =>
                            toast.error(getApiErrorMessage(err, 'Could not update account status right now.')),
                          );
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {user.isActive ? (
                        <>
                          <Ban size={14} />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <RefreshCcw size={14} />
                          Reactivate
                        </>
                      )}
                    </button>

                    {deleteConfirmId === user.id ? (
                      <>
                        <button
                          type="button"
                          disabled={deleteUser.isPending}
                          onClick={() => {
                            void deleteUser
                              .mutateAsync({ tenantId: tenant.id, userId: user.id })
                              .then(() => {
                                setDeleteConfirmId(null);
                                toast.success(`${user.firstName} ${user.lastName} removed.`);
                              })
                              .catch((err) => {
                                setDeleteConfirmId(null);
                                toast.error(getApiErrorMessage(err, 'Could not delete this account right now.'));
                              });
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          {deleteUser.isPending ? 'Deleting…' : 'Confirm delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(user.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              ))}

              {usersMeta ? (
                <p className="text-sm text-slate-500">
                  Showing {users.length} of {usersMeta.total} user
                  {usersMeta.total === 1 ? '' : 's'} in this business.
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No people matched"
              message="Adjust the search or role filter to see more people in this business."
              icon={Users}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantDraft, setTenantDraft] = useState({ name: '', slug: '' });
  const [tenantAdminDraft, setTenantAdminDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [tenantMessage, setTenantMessage] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const { summary, tenants, loading, error, reload } = usePlatformAdminTenants({
    page: 1,
    limit: 24,
    search: tenantSearch,
  });
  const createTenant = useCreateTenant();
  const createTenantAdmin = useCreateTenantAdmin();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const statCards = summary
    ? [
        { title: 'Businesses', value: String(summary.totalTenants), icon: Building2 },
        { title: 'All users', value: String(summary.totalUsers), icon: Users },
        { title: 'Individuals', value: String(summary.totalIndividuals), icon: Users },
        { title: 'CBT centers', value: String(summary.totalCbtUsers), icon: ShieldCheck },
        { title: 'Admins', value: String(summary.totalAdmins), icon: ShieldCheck },
      ]
    : [];

  const accordionItems: AccordionItem[] = tenants.map((tenant) => ({
    id: tenant.id,
    header: (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-slate-900">{tenant.name}</p>
            {tenant.isActive ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Active
              </span>
            ) : (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                Paused
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {tenant.slug}
            {tenant.customDomain ? ` · ${tenant.customDomain}` : ''}
          </p>
          <p className="mt-1.5 text-xs uppercase tracking-[0.16em] text-slate-400">
            Created {formatDate(tenant.createdAt)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
          <TenantMiniMetric label="Users" value={String(tenant.metrics.totalUsers)} />
          <TenantMiniMetric label="CBTs" value={String(tenant.metrics.cbtUsers)} />
          <TenantMiniMetric label="Individuals" value={String(tenant.metrics.individualUsers)} />
          <TenantMiniMetric label="Admins" value={String(tenant.metrics.tenantAdmins)} />
          <TenantMiniMetric label="Orders" value={String(tenant.metrics.totalOrders)} />
          <TenantMiniMetric label="Transactions" value={String(tenant.metrics.totalTransactions)} />
          <TenantMiniMetric label="On hold" value={formatNaira(tenant.metrics.heldFunds)} />
          <TenantMiniMetric label="Available" value={formatNaira(tenant.metrics.availableBalance)} />
        </div>
      </div>
    ),
    body: (isOpen: boolean) => (
      <TenantAccordionBody tenant={tenant} isOpen={isOpen} origin={origin} />
    ),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Business Access"
        title="Create businesses, share links, and manage the people inside them"
        description="Use this page to open a new business, give its admin access, and check who belongs to each business without switching between multiple tools."
        actions={
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Return to dashboard
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-32 rounded-[1.5rem]" />
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

      {/* Create business + info panels */}
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AccountPanel
          title="Create a business"
          description="Set up the business and its first admin in one step, then share the right signup links."
          actions={
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <PlusCircle size={14} />
              Platform admin only
            </div>
          }
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setTenantMessage(null);

              void (async () => {
                let createdTenant: { id: string; slug: string } | null = null;
                try {
                  createdTenant = await createTenant.mutateAsync({
                    name: tenantDraft.name.trim(),
                    slug: tenantDraft.slug.trim(),
                  });

                  const createdAdmin = await createTenantAdmin.mutateAsync({
                    tenantId: createdTenant.id,
                    firstName: tenantAdminDraft.firstName.trim(),
                    lastName: tenantAdminDraft.lastName.trim(),
                    email: tenantAdminDraft.email.trim(),
                    phone: tenantAdminDraft.phone.trim(),
                  });

                  const loginLink = `${origin}/?tenant=${encodeURIComponent(createdTenant.slug)}`;
                  setTenantMessage({
                    tone: 'success',
                    message: `Business created. Portal link: ${loginLink}. Login email: ${createdAdmin.email}. Temporary password: ${createdAdmin.tempPassword}`,
                  });
                  setTenantDraft({ name: '', slug: '' });
                  setTenantAdminDraft({ firstName: '', lastName: '', email: '', phone: '' });
                } catch (error) {
                  if (createdTenant) {
                    setTenantMessage({
                      tone: 'info',
                      message: `Business created, but the admin account was not completed. Open the business below and add the admin there. ${getApiErrorMessage(error, 'The admin account could not be created right now.')}`,
                    });
                    return;
                  }
                  setTenantMessage({
                    tone: 'error',
                    message: getApiErrorMessage(error, 'Could not complete business setup right now.'),
                  });
                }
              })();
            }}
          >
            {tenantMessage ? (
              <FeedbackBanner tone={tenantMessage.tone} message={tenantMessage.message} />
            ) : null}

            {createTenant.error ? (
              <FeedbackBanner
                tone="error"
                message={String(
                  createTenant.error instanceof Error
                    ? createTenant.error.message
                    : 'Could not create the business right now.',
                )}
              />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Business name</span>
                <input
                  value={tenantDraft.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setTenantDraft((current) => ({
                      ...current,
                      name,
                      slug: current.slug ? current.slug : buildSlug(name),
                    }));
                  }}
                  placeholder="Summit CBT Services"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Share slug</span>
                <input
                  value={tenantDraft.slug}
                  onChange={(e) =>
                    setTenantDraft((current) => ({ ...current, slug: buildSlug(e.target.value) }))
                  }
                  placeholder="summit-cbt"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
            </div>

            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                First business admin
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  { field: 'firstName', label: 'Admin first name', placeholder: 'Ada' },
                  { field: 'lastName', label: 'Admin last name', placeholder: 'Okafor' },
                  { field: 'email', label: 'Admin email', placeholder: 'owner@business.com' },
                  { field: 'phone', label: 'Admin phone', placeholder: '+2348012345678' },
                ] as const
              ).map(({ field, label, placeholder }) => (
                <label key={field} className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
                  <input
                    value={tenantAdminDraft[field]}
                    onChange={(e) =>
                      setTenantAdminDraft((current) => ({ ...current, [field]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                  />
                </label>
              ))}
            </div>

            <FeedbackBanner
              tone="info"
              title="What this creates"
              message="This creates the business itself and the first business admin, so the business can sign in right away."
            />

            <button
              type="submit"
              disabled={
                createTenant.isPending ||
                createTenantAdmin.isPending ||
                !tenantDraft.name.trim() ||
                !tenantDraft.slug.trim() ||
                !tenantAdminDraft.firstName.trim() ||
                !tenantAdminDraft.lastName.trim() ||
                !tenantAdminDraft.email.trim() ||
                !tenantAdminDraft.phone.trim()
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusCircle size={16} />
              {createTenant.isPending || createTenantAdmin.isPending
                ? 'Creating...'
                : 'Create business'}
            </button>
          </form>
        </AccountPanel>

        <AccountPanel
          title="What you manage here"
          description="These are the three most common jobs on this page."
        >
          <div className="space-y-4">
            {[
              {
                title: 'Businesses',
                description:
                  'Each business has its own users, wallet activity, service setup, and login links.',
              },
              {
                title: 'People and access',
                description:
                  'Expand a business row to copy links, create or reset admin access, and see who belongs to that business.',
              },
              {
                title: 'Balances and support checks',
                description:
                  'Use the business list to spot available balances, money still on hold, and where support may need to step in.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </AccountPanel>
      </div>

      {/* Tenant accordion list */}
      <AccountPanel
        title="Businesses"
        description="Expand a row to see signup links, admin access, and the people inside that business."
        contentClassName="space-y-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Search businesses</span>
          <input
            value={tenantSearch}
            onChange={(e) => setTenantSearch(e.target.value)}
            placeholder="Search by business name or slug"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
          />
        </label>

        {error ? (
          <EmptyState
            title="Business list unavailable"
            message={error}
            icon={Building2}
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
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-40 rounded-[1.5rem]" />
            ))}
          </div>
        ) : tenants.length ? (
          <Accordion items={accordionItems} allowMultiple={false} />
        ) : (
          <EmptyState
            title="No businesses found"
            message="Create a business first, then its people and activity will appear here."
            icon={Building2}
          />
        )}
      </AccountPanel>
    </div>
  );
}

function TenantMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TenantDetailCard({
  label,
  value,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 break-all text-sm text-slate-700">{value}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
        >
          <Copy size={14} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
