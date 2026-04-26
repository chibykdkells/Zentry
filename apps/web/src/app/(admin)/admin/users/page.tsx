'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Ban, Building2, Copy, PlusCircle, RefreshCcw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { UserRole } from '@zentry/types';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { InfoHint } from '@/components/shared/info-hint';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useCreateTenantAdmin,
  useCreateTenant,
  useDeleteTenantUser,
  useDismissTenantAdminAccess,
  usePlatformAdminTenants,
  usePlatformAdminTenantUsers,
  useResetTenantAdminPassword,
  useToggleTenantUserActive,
} from '@/hooks/use-platform-admin-tenants';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';

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

export default function AdminUsersPage() {
  const [tenantSearch, setTenantSearch] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const [tenantDraft, setTenantDraft] = useState({
    name: '',
    slug: '',
  });
  const [tenantAdminDraft, setTenantAdminDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [selectedTenantAdminDraft, setSelectedTenantAdminDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [tenantMessage, setTenantMessage] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [tenantAdminMessage, setTenantAdminMessage] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { summary, tenants, loading, error, reload } = usePlatformAdminTenants({
    page: 1,
    limit: 24,
    search: tenantSearch,
  });
  const createTenant = useCreateTenant();
  const createTenantAdmin = useCreateTenantAdmin();
  const resetTenantAdminPassword = useResetTenantAdminPassword();
  const dismissTenantAdminAccess = useDismissTenantAdminAccess();
  const toggleUserActive = useToggleTenantUserActive();
  const deleteUser = useDeleteTenantUser();

  const effectiveSelectedTenantId = tenants.some(
    (tenant) => tenant.id === selectedTenantId,
  )
    ? selectedTenantId
    : (tenants[0]?.id ?? null);

  const selectedTenant =
    tenants.find((tenant) => tenant.id === effectiveSelectedTenantId) ?? null;

  const tenantUserFilters = useMemo(
    () => ({
      page: 1,
      limit: 12,
      search: userSearch,
      role,
    }),
    [role, userSearch],
  );

  const {
    users,
    meta,
    loading: tenantUsersLoading,
    error: tenantUsersError,
    reload: reloadTenantUsers,
  } = usePlatformAdminTenantUsers(effectiveSelectedTenantId, tenantUserFilters);

  const statCards = summary
    ? [
        { title: 'Businesses', value: String(summary.totalTenants), icon: Building2 },
        { title: 'All users', value: String(summary.totalUsers), icon: Users },
        { title: 'Individuals', value: String(summary.totalIndividuals), icon: Users },
        { title: 'CBT centers', value: String(summary.totalCbtUsers), icon: ShieldCheck },
      ]
    : [];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const buildTenantLoginLink = (slug: string) =>
    `${origin}/login?tenant=${encodeURIComponent(slug)}`;

  const copyLink = async (path: string) => {
    const value = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(value);
    toast.success('Share link copied.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Business and user control"
        title="See every business on the platform and the people inside each one"
        description="This workspace gives the platform admin a live view of businesses, tenant users, and signup routes instead of a generic placeholder."
        actions={
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Return to dashboard
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
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

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AccountPanel
          title="Create a business portal"
          description="Create a tenant, then copy a ready-made signup link for individuals or CBT centers."
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
              setTenantAdminMessage(null);

              void (async () => {
                let createdTenant:
                  | {
                      id: string;
                      slug: string;
                    }
                  | null = null;

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

                  setSelectedTenantId(createdTenant.id);
                  setTenantMessage(
                    {
                      tone: 'success',
                      message: `Business portal created. Login link: ${buildTenantLoginLink(createdTenant.slug)}. Login email: ${createdAdmin.email}. Temporary password: ${createdAdmin.tempPassword}`,
                    },
                  );
                  setTenantDraft({ name: '', slug: '' });
                  setTenantAdminDraft({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                  });
                } catch (error) {
                  if (createdTenant) {
                    setSelectedTenantId(createdTenant.id);
                    setTenantMessage({
                      tone: 'info',
                      message: `Business portal created, but the business admin account was not completed. Open the business detail below and provision the business admin there. ${getApiErrorMessage(error, 'The admin account could not be created right now.')}`,
                    });
                    return;
                  }

                  setTenantMessage({
                    tone: 'error',
                    message: getApiErrorMessage(
                      error,
                      'Could not complete business setup right now.',
                    ),
                  });
                }
              })();
            }}
          >
            {tenantMessage ? (
              <FeedbackBanner
                tone={tenantMessage.tone}
                message={tenantMessage.message}
              />
            ) : null}

            {createTenant.error ? (
              <FeedbackBanner
                tone="error"
                message={String(createTenant.error instanceof Error ? createTenant.error.message : 'Could not create the business portal right now.')}
              />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Business name
                </span>
                <input
                  value={tenantDraft.name}
                  onChange={(event) => {
                    const name = event.target.value;
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
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Share slug
                </span>
                <input
                  value={tenantDraft.slug}
                  onChange={(event) =>
                    setTenantDraft((current) => ({
                      ...current,
                      slug: buildSlug(event.target.value),
                    }))
                  }
                  placeholder="summit-cbt"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
            </div>

            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Business admin access
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Admin first name
                </span>
                <input
                  value={tenantAdminDraft.firstName}
                  onChange={(event) =>
                    setTenantAdminDraft((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  placeholder="Ada"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Admin last name
                </span>
                <input
                  value={tenantAdminDraft.lastName}
                  onChange={(event) =>
                    setTenantAdminDraft((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  placeholder="Okafor"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Admin email
                </span>
                <input
                  value={tenantAdminDraft.email}
                  onChange={(event) =>
                    setTenantAdminDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="owner@business.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Admin phone
                </span>
                <input
                  value={tenantAdminDraft.phone}
                  onChange={(event) =>
                    setTenantAdminDraft((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="+2348012345678"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
            </div>

            <FeedbackBanner
              tone="info"
              title="What this creates"
              message="A business portal needs a business admin account. This flow now creates both the tenant shell and the first tenant admin so the business can sign in immediately."
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
                : 'Create business portal'}
            </button>
          </form>
        </AccountPanel>

        <AccountPanel
          title="Platform admin guide"
          description="Use human language so support and rollout decisions are easier to make quickly."
        >
          <div className="space-y-4">
            {[
              {
                title: 'Businesses',
                description:
                  'A business is a tenant portal. It contains its own users, jobs, wallet activity, and provider settings.',
              },
              {
                title: 'Live users',
                description:
                  'This means people who currently have an open active session connected through the live socket layer, not just people who have signed in before.',
              },
              {
                title: 'Held funds',
                description:
                  'Held funds are customer payments still waiting for completion, dispute clearance, or release. They are useful during support review.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </h2>
                  <InfoHint text={item.description} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </AccountPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AccountPanel
          title="Businesses on the platform"
          description="Click a business to see its user mix, wallet exposure, and ready-to-share signup links."
          contentClassName="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Search businesses
            </span>
            <input
              value={tenantSearch}
              onChange={(event) => setTenantSearch(event.target.value)}
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
            <div className="space-y-3">
              {tenants.map((tenant) => {
                const isSelected = tenant.id === effectiveSelectedTenantId;

                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => {
                      setSelectedTenantId(tenant.id);
                      setUserSearchInput('');
                      setUserSearch('');
                      setRole('ALL');
                      setTenantAdminMessage(null);
                      setSelectedTenantAdminDraft({
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                      });
                    }}
                    className={`w-full rounded-[1.5rem] border p-5 text-left transition ${
                      isSelected
                        ? 'border-[#0D1B3E]/20 bg-[#0D1B3E]/5'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-slate-900">
                            {tenant.name}
                          </p>
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
                          {tenant.slug} {tenant.customDomain ? `• ${tenant.customDomain}` : ''}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                          Created {formatDate(tenant.createdAt)}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <TenantMiniMetric label="Users" value={String(tenant.metrics.totalUsers)} />
                        <TenantMiniMetric
                          label="CBTs"
                          value={String(tenant.metrics.cbtUsers)}
                        />
                        <TenantMiniMetric
                          label="Individuals"
                          value={String(tenant.metrics.individualUsers)}
                        />
                        <TenantMiniMetric
                          label="Transactions"
                          value={String(tenant.metrics.totalTransactions)}
                        />
                        <TenantMiniMetric
                          label="Held funds"
                          value={formatNaira(tenant.metrics.heldFunds)}
                        />
                        <TenantMiniMetric
                          label="Available"
                          value={formatNaira(tenant.metrics.availableBalance)}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No businesses found"
              message="Create a business portal first, then the people and activity inside it will become visible here."
              icon={Building2}
            />
          )}
        </AccountPanel>

        <AccountPanel
          title={
            selectedTenant ? `${selectedTenant.name} at a glance` : 'Business detail'
          }
          description={
            selectedTenant
              ? 'See the business breakdown and the people inside this tenant.'
              : 'Choose a business from the list to inspect its users and signup routes.'
          }
          contentClassName="space-y-4"
        >
          {selectedTenant ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <TenantDetailCard
                  label="Individual signup link"
                  value={`${origin}${selectedTenant.signupLinks.individual}`}
                  actionLabel="Copy"
                  onAction={() => void copyLink(selectedTenant.signupLinks.individual)}
                />
                <TenantDetailCard
                  label="CBT signup link"
                  value={`${origin}${selectedTenant.signupLinks.cbt}`}
                  actionLabel="Copy"
                  onAction={() => void copyLink(selectedTenant.signupLinks.cbt)}
                />
                <TenantDetailCard
                  label="Business admin login"
                  value={buildTenantLoginLink(selectedTenant.slug)}
                  actionLabel="Copy"
                  onAction={() =>
                    navigator.clipboard
                      .writeText(buildTenantLoginLink(selectedTenant.slug))
                      .then(() => toast.success('Business admin login link copied.'))
                  }
                />
                <TenantDetailCard
                  label="Business admins"
                  value={
                    selectedTenant.metrics.tenantAdmins === 1
                      ? '1 business admin account'
                      : `${selectedTenant.metrics.tenantAdmins} business admin accounts`
                  }
                />
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Saved business admin access
                  </h2>
                  <InfoHint text="These access cards stay visible for platform admin until you remove them. You can also reset the password to generate a fresh temporary password for the same business admin." />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Keep these details only as long as support needs them. Remove them after handoff, or reset the password if the business admin needs a fresh temporary access.
                </p>

                {selectedTenant.tenantAdminAccesses.length ? (
                  <div className="mt-4 space-y-3">
                    {selectedTenant.tenantAdminAccesses.map((access) => (
                      <div
                        key={access.id}
                        className="rounded-[1.5rem] border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {access.user.firstName} {access.user.lastName}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">{access.email}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                              Created {formatDate(access.createdAt)}
                              {access.lastResetAt
                                ? ` • Reset ${formatDate(access.lastResetAt)}`
                                : ''}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <TenantMiniMetric
                              label="Login email"
                              value={access.email}
                            />
                            <TenantMiniMetric
                              label="Login link"
                              value={buildTenantLoginLink(selectedTenant.slug)}
                            />
                            <TenantMiniMetric
                              label="Temporary password"
                              value={access.tempPassword}
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(access.email)
                                .then(() =>
                                  toast.success('Business admin login email copied.'),
                                )
                            }
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                          >
                            <Copy size={14} />
                            Copy login email
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(buildTenantLoginLink(selectedTenant.slug))
                                .then(() =>
                                  toast.success('Business admin login link copied.'),
                                )
                            }
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                          >
                            <Copy size={14} />
                            Copy login link
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(access.tempPassword)
                                .then(() =>
                                  toast.success('Temporary password copied.'),
                                )
                            }
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                          >
                            <Copy size={14} />
                            Copy password
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTenantAdminMessage(null);
                              void resetTenantAdminPassword
                                .mutateAsync({
                                  tenantId: selectedTenant.id,
                                  userId: access.user.id,
                                })
                                .then((updatedAdmin) => {
                                  setTenantAdminMessage(
                                    `Business admin password reset. Login link: ${buildTenantLoginLink(selectedTenant.slug)}. Login email: ${updatedAdmin.email}. Temporary password: ${updatedAdmin.tempPassword}`,
                                  );
                                })
                                .catch((error) => {
                                  toast.error(
                                    getApiErrorMessage(
                                      error,
                                      'Could not reset the business admin password right now.',
                                    ),
                                  );
                                });
                            }}
                            disabled={resetTenantAdminPassword.isPending}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {resetTenantAdminPassword.isPending
                              ? 'Resetting...'
                              : 'Reset password'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTenantAdminMessage(null);
                              void dismissTenantAdminAccess
                                .mutateAsync({
                                  tenantId: selectedTenant.id,
                                  accessId: access.id,
                                })
                                .then(() => {
                                  toast.success('Saved business admin access removed.');
                                })
                                .catch((error) => {
                                  toast.error(
                                    getApiErrorMessage(
                                      error,
                                      'Could not remove the saved access right now.',
                                    ),
                                  );
                                });
                            }}
                            disabled={dismissTenantAdminAccess.isPending}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {dismissTenantAdminAccess.isPending
                              ? 'Removing...'
                              : 'Remove saved access'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No saved business admin access is visible for this business right now.
                  </p>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Provision business admin
                  </h2>
                  <InfoHint text="Use this when a business portal already exists but still needs a business admin login, or when you want to add another business admin account." />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This creates a tenant-admin account and returns a temporary password that should be shared securely.
                </p>

                {tenantAdminMessage ? (
                  <div className="mt-4">
                    <FeedbackBanner tone="success" message={tenantAdminMessage} />
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={selectedTenantAdminDraft.firstName}
                    onChange={(event) =>
                      setSelectedTenantAdminDraft((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    placeholder="First name"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                  />
                  <input
                    value={selectedTenantAdminDraft.lastName}
                    onChange={(event) =>
                      setSelectedTenantAdminDraft((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    placeholder="Last name"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                  />
                  <input
                    value={selectedTenantAdminDraft.email}
                    onChange={(event) =>
                      setSelectedTenantAdminDraft((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="owner@business.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                  />
                  <input
                    value={selectedTenantAdminDraft.phone}
                    onChange={(event) =>
                      setSelectedTenantAdminDraft((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="+2348012345678"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTenantAdminMessage(null);
                    void createTenantAdmin
                      .mutateAsync({
                        tenantId: selectedTenant.id,
                        firstName: selectedTenantAdminDraft.firstName.trim(),
                        lastName: selectedTenantAdminDraft.lastName.trim(),
                        email: selectedTenantAdminDraft.email.trim(),
                        phone: selectedTenantAdminDraft.phone.trim(),
                      })
                      .then((createdAdmin) => {
                        setTenantAdminMessage(
                          `Business admin created. Login link: ${buildTenantLoginLink(selectedTenant.slug)}. Login email: ${createdAdmin.email}. Temporary password: ${createdAdmin.tempPassword}`,
                        );
                        setSelectedTenantAdminDraft({
                          firstName: '',
                          lastName: '',
                          email: '',
                          phone: '',
                        });
                      })
                      .catch((error) => {
                        toast.error(
                          String(
                            error instanceof Error
                              ? error.message
                              : 'Could not create the business admin right now.',
                          ),
                        );
                      });
                  }}
                  disabled={
                    createTenantAdmin.isPending ||
                    !selectedTenantAdminDraft.firstName.trim() ||
                    !selectedTenantAdminDraft.lastName.trim() ||
                    !selectedTenantAdminDraft.email.trim() ||
                    !selectedTenantAdminDraft.phone.trim()
                  }
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlusCircle size={16} />
                  {createTenantAdmin.isPending
                    ? 'Creating business admin...'
                    : 'Create business admin'}
                </button>
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    People inside this business
                  </h2>
                  <InfoHint text="Use this view when support needs to confirm whether an account belongs to the correct business portal and role." />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                  <input
                    value={userSearchInput}
                    onChange={(event) => setUserSearchInput(event.target.value)}
                    placeholder="Search by name or email"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                  />
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as UserRole | 'ALL')}
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
              </div>

              {tenantUsersError ? (
                <EmptyState
                  title="Tenant users unavailable"
                  message={tenantUsersError}
                  icon={Users}
                  action={
                    <button
                      type="button"
                      onClick={reloadTenantUsers}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Try again
                    </button>
                  }
                />
              ) : tenantUsersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-28 rounded-[1.5rem]" />
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
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              user.isActive
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {formatRoleLabel(user.role)}
                            {!user.isActive ? ' · Inactive' : ''}
                          </span>
                        </div>
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
                            if (!effectiveSelectedTenantId) return;
                            void toggleUserActive
                              .mutateAsync({ tenantId: effectiveSelectedTenantId, userId: user.id })
                              .then((res) =>
                                toast.success(
                                  res.isActive
                                    ? `${user.firstName} reactivated.`
                                    : `${user.firstName} deactivated.`,
                                ),
                              )
                              .catch((err) =>
                                toast.error(
                                  getApiErrorMessage(err, 'Could not update account status right now.'),
                                ),
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
                                if (!effectiveSelectedTenantId) return;
                                void deleteUser
                                  .mutateAsync({ tenantId: effectiveSelectedTenantId, userId: user.id })
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

                  {meta ? (
                    <p className="text-sm text-slate-500">
                      Showing {users.length} of {meta.total} user{meta.total === 1 ? '' : 's'} in this business.
                    </p>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="No matching users found"
                  message="Adjust the search or role filter to see more people in this business."
                  icon={Users}
                />
              )}
            </>
          ) : (
            <EmptyState
              title="Choose a business"
              message="Pick a business from the list to inspect its people, balances, and share links."
              icon={Building2}
            />
          )}
        </AccountPanel>
      </div>
    </div>
  );
}

function TenantMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
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
