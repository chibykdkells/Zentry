'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  Clock3,
  Mail,
  Phone,
  ShieldCheck,
  UserCircle2,
  Wallet,
} from 'lucide-react';
import { ProtectedShell } from '@/components/layout/protected-shell';
import { ProfileEditForm } from '@/components/profile/profile-edit-form';
import { EmptyState } from '@/components/shared/empty-state';
import { AccountPanel } from '@/components/shared/account-panel';
import {
  SkeletonBlock,
  SkeletonCircle,
  SkeletonLine,
} from '@/components/shared/skeleton-loader';
import { useAuthProfile } from '@/hooks/use-auth-profile';
import { formatDate } from '@/lib/format';
import { UserRole } from '@zendocx/types';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { profile, loading, error, reload } = useAuthProfile();

  if (loading) {
    return (
      <ProtectedShell title="Profile">
        <ProfileSkeleton />
      </ProtectedShell>
    );
  }

  if (!profile || error) {
    return (
      <ProtectedShell title="Profile">
        <EmptyState
          title="Profile unavailable"
          message={error ?? 'We could not load your profile right now.'}
          icon={UserCircle2}
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

  return (
    <ProtectedShell title="Profile">
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:space-y-6 md:p-8">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0D1B3E] text-xl font-black text-white shadow-sm">
                {profile.firstName[0]}
                {profile.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">
                  {formatRole(profile.role)}
                </p>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {profile.firstName} {profile.lastName}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Member since {formatDate(profile.createdAt)}
                </p>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3 lg:min-w-[26rem]">
              <ProfileHighlight
                label="Email"
                value={profile.isEmailVerified ? 'Verified' : 'Pending'}
              />
              <ProfileHighlight
                label="Phone"
                value={profile.isPhoneVerified ? 'Verified' : 'Not verified'}
              />
              <ProfileHighlight label="Role" value={formatRole(profile.role)} />
            </div>
          </div>
        </section>

        <div className="grid gap-5 md:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <AccountPanel
            title="Personal details"
            description="This is the account information currently available across authentication, wallet, and notifications."
            actions={
              <Link
                href="/wallet"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Open wallet
              </Link>
            }
          >
            <div className="space-y-4">
              <InfoRow
                icon={Mail}
                label="Email address"
                value={profile.email}
                status={profile.isEmailVerified ? 'Verified' : 'Pending'}
              />
              <InfoRow
                icon={Phone}
                label="Phone number"
                value={profile.phone}
                status={profile.isPhoneVerified ? 'Verified' : 'Not verified'}
              />
              <InfoRow
                icon={Clock3}
                label="Last login"
                value={
                  profile.lastLoginAt
                    ? formatDate(profile.lastLoginAt)
                  : 'No login activity recorded yet'
                }
              />
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  Update basic details
                </h3>
                <p className="text-sm leading-6 text-slate-500">
                  Edit your name and phone number without leaving this page.
                </p>
              </div>
              <ProfileEditForm profile={profile} />
            </div>
          </AccountPanel>

          <div className="space-y-6">
            <AccountPanel
              title="Account status"
              description="A quick read on verification, approval, and security readiness."
            >
              <div className="space-y-4">
                <StatusCard
                  title="Email verification"
                  description={
                    profile.isEmailVerified
                      ? 'Your email is verified and ready for sign-in, notifications, and order updates.'
                      : 'Please verify your email to unlock the rest of the platform.'
                  }
                  tone={profile.isEmailVerified ? 'success' : 'warning'}
                />
                {profile.role === UserRole.CBT_CENTER && profile.cbtProfile ? (
                  <StatusCard
                    title="CBT approval"
                    description={`${profile.cbtProfile.centerName} is currently ${profile.cbtProfile.approvalStatus.toLowerCase()}.`}
                    tone={
                      profile.cbtProfile.approvalStatus === 'APPROVED'
                        ? 'success'
                        : 'warning'
                    }
                  />
                ) : null}
                <StatusCard
                  title="Security"
                  description="Password reset and wallet PIN flows are available in the current authentication layer. Dedicated account controls can be surfaced later without changing the backend."
                  tone="neutral"
                />
              </div>
            </AccountPanel>

            <AccountPanel title="What you can do next">
              <div className="space-y-3">
                <ActionRow
                  icon={Wallet}
                  title="Review wallet balances"
                  description="Track available funds, money on hold, and wallet readiness from one place."
                  href="/wallet"
                  cta="Open wallet"
                />
                <ActionRow
                  icon={ShieldCheck}
                  title="Stay account ready"
                  description="Use verified email access and PIN protection to keep your orders and payouts secure."
                  href="/security"
                  cta="View security"
                />
              </div>
            </AccountPanel>
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}

function formatRole(role: UserRole): string {
  switch (role) {
    case UserRole.CBT_CENTER:
      return 'CBT Center';
    case UserRole.TENANT_ADMIN:
      return 'Tenant Admin';
    case UserRole.INDIVIDUAL:
      return 'Individual';
    case UserRole.SUPER_ADMIN:
      return 'Super Admin';
    default:
      return 'Individual';
  }
}

function ProfileHighlight({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  status?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
      </div>
      {status ? (
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            status === 'Verified'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-200 text-slate-600',
          )}
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  href,
  cta,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 sm:gap-4 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        {cta}
      </Link>
    </div>
  );
}

function StatusCard({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        tone === 'success' && 'border-emerald-100 bg-emerald-50',
        tone === 'warning' && 'border-amber-100 bg-amber-50',
        tone === 'neutral' && 'border-slate-200 bg-slate-50',
      )}
    >
      <div className="flex items-center gap-2">
        <BadgeCheck
          size={18}
          className={cn(
            tone === 'success' && 'text-emerald-600',
            tone === 'warning' && 'text-amber-600',
            tone === 'neutral' && 'text-slate-600',
          )}
        />
        <p className="font-semibold text-slate-900">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <SkeletonCircle className="h-16 w-16" />
            <div className="space-y-3">
              <SkeletonLine className="h-3 w-24" />
              <SkeletonLine className="h-7 w-44" />
              <SkeletonLine className="h-4 w-32" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[26rem]">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonBlock className="h-72" />
        <div className="space-y-6">
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-40" />
        </div>
      </div>
    </div>
  );
}
