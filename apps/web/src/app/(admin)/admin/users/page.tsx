'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Ban,
  Building2,
  ChevronRight,
  Copy,
  PlusCircle,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { UserRole } from '@zendocx/types';
import { DetailModal } from '@/components/shared/detail-modal';
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
  type PlatformAdminTenantUserListItem,
  usePlatformAdminTenants,
  usePlatformAdminTenantUsers,
  useResetTenantAdminPassword,
  useToggleTenantUserActive,
} from '@/hooks/use-platform-admin-tenants';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

const roleOptions = [
  { label: 'Everyone', value: 'ALL' as const },
  { label: 'Individuals', value: UserRole.INDIVIDUAL },
  { label: 'CBT centers', value: UserRole.CBT_CENTER },
  { label: 'Business admins', value: UserRole.TENANT_ADMIN },
];

function formatRoleLabel(role: UserRole) {
  switch (role) {
    case UserRole.CBT_CENTER: return 'CBT center';
    case UserRole.TENANT_ADMIN: return 'Business admin';
    case UserRole.SUPER_ADMIN: return 'Platform admin';
    default: return 'Individual';
  }
}

function buildSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─── User detail modal ────────────────────────────────────────────────────────

function UserDetailModal({
  user,
  tenantId,
  open,
  onClose,
}: {
  user: PlatformAdminTenantUserListItem;
  tenantId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggleUserActive = useToggleTenantUserActive();
  const deleteUser = useDeleteTenantUser();

  return (
    <DetailModal
      open={open}
      onClose={() => { setConfirmDelete(false); onClose(); }}
      title={`${user.firstName} ${user.lastName}`}
      description={formatRoleLabel(user.role)}
      width="md"
      zIndex="nested"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={toggleUserActive.isPending}
            onClick={() => {
              void toggleUserActive
                .mutateAsync({ tenantId, userId: user.id })
                .then((res) => {
                  toast.success(res.isActive ? `${user.firstName} reactivated.` : `${user.firstName} deactivated.`);
                  onClose();
                })
                .catch((err) => toast.error(getApiErrorMessage(err, 'Could not update account status.')));
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60"
          >
            {user.isActive ? <><Ban size={14} /> Deactivate</> : <><RefreshCcw size={14} /> Reactivate</>}
          </button>

          {confirmDelete ? (
            <>
              <button
                type="button"
                disabled={deleteUser.isPending}
                onClick={() => {
                  void deleteUser
                    .mutateAsync({ tenantId, userId: user.id })
                    .then(() => { toast.success(`${user.firstName} removed.`); onClose(); })
                    .catch((err) => { setConfirmDelete(false); toast.error(getApiErrorMessage(err, 'Could not delete this account.')); });
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {deleteUser.isPending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Email', value: user.email },
            { label: 'Phone', value: user.phone },
            { label: 'Role', value: formatRoleLabel(user.role) },
            { label: 'Account', value: user.isActive ? 'Active' : 'Paused' },
            { label: 'Email verified', value: user.isEmailVerified ? 'Yes' : 'Pending' },
            { label: 'Last sign-in', value: user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Not yet' },
            { label: 'Registered', value: formatDate(user.createdAt) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
              <p className="mt-1 text-sm text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </DetailModal>
  );
}

// ─── Tenant detail modal ──────────────────────────────────────────────────────

function TenantDetailModal({
  tenant,
  open,
  onClose,
  origin,
}: {
  tenant: PlatformAdminTenantListItem;
  open: boolean;
  onClose: () => void;
  origin: string;
}) {
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [adminDraft, setAdminDraft] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');

  const createTenantAdmin = useCreateTenantAdmin();
  const userFilters = useMemo(() => ({ page: 1, limit: 20, search: userSearch, role }), [role, userSearch]);
  const { users, meta: usersMeta, loading: usersLoading, error: usersError } = usePlatformAdminTenantUsers(
    tenant.id,
    userFilters,
    { enabled: open },
  );

  const loginLink = `${origin}/?tenant=${encodeURIComponent(tenant.slug)}`;
  const openUser = users.find((u) => u.id === openUserId) ?? null;

  return (
    <>
      <DetailModal
        open={open}
        onClose={onClose}
        title={tenant.name}
        description={`${tenant.slug}${tenant.customDomain ? ` · ${tenant.customDomain}` : ''}`}
        width="xl"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#0D1B3E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Quick copy links */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'User signup', path: tenant.signupLinks.individual },
              { label: 'CBT signup', path: tenant.signupLinks.cbt },
              { label: 'Admin login', path: `/?tenant=${encodeURIComponent(tenant.slug)}` },
            ].map(({ label, path }) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(`${window.location.origin}${path}`)
                    .then(() => toast.success(`${label} link copied.`))
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white"
              >
                <Copy size={11} />
                Copy {label} link
              </button>
            ))}
          </div>

          {/* Metrics snapshot */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
            {[
              { label: 'Users', value: String(tenant.metrics.totalUsers) },
              { label: 'CBTs', value: String(tenant.metrics.cbtUsers) },
              { label: 'Individuals', value: String(tenant.metrics.individualUsers) },
              { label: 'Admins', value: String(tenant.metrics.tenantAdmins) },
              { label: 'Orders', value: String(tenant.metrics.totalOrders) },
              { label: 'Transactions', value: String(tenant.metrics.totalTransactions) },
              { label: 'On hold', value: formatNaira(tenant.metrics.heldFunds) },
              { label: 'Available', value: formatNaira(tenant.metrics.availableBalance) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Add admin toggle */}
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
            <button
              type="button"
              onClick={() => setShowAddAdmin((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-semibold text-slate-900"
            >
              Add business admin
              <ChevronRight size={15} className={cn('text-slate-400 transition-transform', showAddAdmin && 'rotate-90')} />
            </button>

            {showAddAdmin ? (
              <div className="mt-4 space-y-3">
                {adminMessage ? <FeedbackBanner tone="success" message={adminMessage} /> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  {(['firstName', 'lastName', 'email', 'phone'] as const).map((field) => (
                    <input
                      key={field}
                      value={adminDraft[field]}
                      onChange={(e) => setAdminDraft((c) => ({ ...c, [field]: e.target.value }))}
                      placeholder={
                        field === 'firstName' ? 'First name'
                        : field === 'lastName' ? 'Last name'
                        : field === 'email' ? 'Email'
                        : 'Phone'
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={
                    createTenantAdmin.isPending ||
                    !adminDraft.firstName.trim() ||
                    !adminDraft.lastName.trim() ||
                    !adminDraft.email.trim() ||
                    !adminDraft.phone.trim()
                  }
                  onClick={() => {
                    setAdminMessage(null);
                    void createTenantAdmin
                      .mutateAsync({
                        tenantId: tenant.id,
                        firstName: adminDraft.firstName.trim(),
                        lastName: adminDraft.lastName.trim(),
                        email: adminDraft.email.trim(),
                        phone: adminDraft.phone.trim(),
                      })
                      .then((created) => {
                        setAdminMessage(
                          `Admin created. Portal: ${loginLink} · Email: ${created.email} · Password: ${created.tempPassword}`,
                        );
                        setAdminDraft({ firstName: '', lastName: '', email: '', phone: '' });
                      })
                      .catch((err) => toast.error(getApiErrorMessage(err, 'Could not create admin.')));
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:opacity-60"
                >
                  <PlusCircle size={15} />
                  {createTenantAdmin.isPending ? 'Adding...' : 'Add admin'}
                </button>
              </div>
            ) : null}
          </div>

          {/* People list */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">People in this business</h3>
              {usersMeta ? (
                <span className="text-xs text-slate-400">{usersMeta.total} total</span>
              ) : null}
            </div>

            <div className="mb-3 flex gap-2">
              <input
                value={userSearchInput}
                onChange={(e) => setUserSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setUserSearch(userSearchInput.trim()); }}
                placeholder="Search by name or email"
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole | 'ALL')}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E]"
              >
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setUserSearch(userSearchInput.trim())}
                className="rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
              >
                Search
              </button>
            </div>

            {usersError ? (
              <p className="text-sm text-rose-500">{usersError}</p>
            ) : usersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-12 rounded-2xl" />
                ))}
              </div>
            ) : users.length ? (
              <div className="space-y-1.5">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setOpenUserId(user.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-left transition hover:border-slate-200 hover:bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="ml-2 text-sm text-slate-500">{user.email}</span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        user.isActive ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600',
                      )}
                    >
                      {formatRoleLabel(user.role)}{!user.isActive ? ' · Inactive' : ''}
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No people matched this filter.</p>
            )}
          </div>
        </div>
      </DetailModal>

      {openUser ? (
        <UserDetailModal
          user={openUser}
          tenantId={tenant.id}
          open={Boolean(openUserId)}
          onClose={() => setOpenUserId(null)}
        />
      ) : null}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [tenantSearch, setTenantSearch] = useState('');
  const [openTenantId, setOpenTenantId] = useState<string | null>(null);
  const [tenantDraft, setTenantDraft] = useState({ name: '', slug: '' });
  const [tenantAdminDraft, setTenantAdminDraft] = useState({
    firstName: '', lastName: '', email: '', phone: '',
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
  const selectedTenant = tenants.find((t) => t.id === openTenantId) ?? null;

  const statCards = summary
    ? [
        { title: 'Businesses', value: String(summary.totalTenants), icon: Building2 },
        { title: 'All users', value: String(summary.totalUsers), icon: Users },
        { title: 'Individuals', value: String(summary.totalIndividuals), icon: Users },
        { title: 'CBT centers', value: String(summary.totalCbtUsers), icon: ShieldCheck },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Business Access"
        title="Create businesses and manage the people inside them"
        description="Open a new business, set up its admin, and inspect who belongs to each business."
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-32 rounded-[1.5rem]" />
            ))
          : statCards.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-[#0D1B3E]">
                  <item.icon size={18} />
                </div>
                <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{item.value}</p>
                <p className="mt-1 text-sm text-slate-500">{item.title}</p>
              </article>
            ))}
      </div>

      {/* Create business */}
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Create a business</h2>
        <p className="mt-1 text-sm text-slate-500">Set up the business and its first admin in one step.</p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTenantMessage(null);
            void (async () => {
              let created: { id: string; slug: string } | null = null;
              try {
                created = await createTenant.mutateAsync({
                  name: tenantDraft.name.trim(),
                  slug: tenantDraft.slug.trim(),
                });
                const admin = await createTenantAdmin.mutateAsync({
                  tenantId: created.id,
                  firstName: tenantAdminDraft.firstName.trim(),
                  lastName: tenantAdminDraft.lastName.trim(),
                  email: tenantAdminDraft.email.trim(),
                  phone: tenantAdminDraft.phone.trim(),
                });
                const loginLink = `${origin}/?tenant=${encodeURIComponent(created.slug)}`;
                setTenantMessage({
                  tone: 'success',
                  message: `Business created. Portal: ${loginLink} · Email: ${admin.email} · Password: ${admin.tempPassword}`,
                });
                setTenantDraft({ name: '', slug: '' });
                setTenantAdminDraft({ firstName: '', lastName: '', email: '', phone: '' });
              } catch (err) {
                setTenantMessage({
                  tone: created ? 'info' : 'error',
                  message: created
                    ? `Business created but admin setup failed. Find it in the list below. ${getApiErrorMessage(err, '')}`
                    : getApiErrorMessage(err, 'Could not create the business right now.'),
                });
              }
            })();
          }}
        >
          {tenantMessage ? <FeedbackBanner tone={tenantMessage.tone} message={tenantMessage.message} /> : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Business name</span>
              <input
                value={tenantDraft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setTenantDraft((c) => ({ ...c, name, slug: c.slug || buildSlug(name) }));
                }}
                placeholder="Summit CBT Services"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Slug</span>
              <input
                value={tenantDraft.slug}
                onChange={(e) => setTenantDraft((c) => ({ ...c, slug: buildSlug(e.target.value) }))}
                placeholder="summit-cbt"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
              />
            </label>
            {(['firstName', 'lastName', 'email', 'phone'] as const).map((field) => (
              <label key={field} className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  {field === 'firstName' ? 'First name'
                    : field === 'lastName' ? 'Last name'
                    : field === 'email' ? 'Admin email'
                    : 'Admin phone'}
                </span>
                <input
                  value={tenantAdminDraft[field]}
                  onChange={(e) => setTenantAdminDraft((c) => ({ ...c, [field]: e.target.value }))}
                  placeholder={field === 'email' ? 'owner@business.com' : field === 'phone' ? '+2348012345678' : ''}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </label>
            ))}
          </div>

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
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlusCircle size={16} />
            {createTenant.isPending || createTenantAdmin.isPending ? 'Creating...' : 'Create business'}
          </button>
        </form>
      </div>

      {/* Business list */}
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">Businesses</h2>
          <input
            value={tenantSearch}
            onChange={(e) => setTenantSearch(e.target.value)}
            placeholder="Search businesses…"
            className="w-64 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
          />
        </div>

        {error ? (
          <EmptyState
            title="Business list unavailable"
            message={error}
            icon={Building2}
            action={
              <button type="button" onClick={reload} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Try again
              </button>
            }
          />
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : tenants.length ? (
          <div className="space-y-1.5">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => setOpenTenantId(tenant.id)}
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3.5 text-left transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{tenant.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        tenant.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                      )}
                    >
                      {tenant.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{tenant.slug}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-4 text-sm text-slate-500 sm:flex">
                  <span>{tenant.metrics.totalUsers} users</span>
                  <span>{tenant.metrics.totalOrders} orders</span>
                  <span>{formatNaira(tenant.metrics.availableBalance)} available</span>
                </div>
                <ChevronRight size={15} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No businesses found"
            message="Create a business above to get started."
            icon={Building2}
          />
        )}
      </div>

      {/* Tenant detail modal */}
      {selectedTenant ? (
        <TenantDetailModal
          tenant={selectedTenant}
          open={Boolean(openTenantId)}
          onClose={() => setOpenTenantId(null)}
          origin={origin}
        />
      ) : null}
    </div>
  );
}
