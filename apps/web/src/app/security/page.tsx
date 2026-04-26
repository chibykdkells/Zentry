'use client';

import Link from 'next/link';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  KeyRound,
  Shield,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { ChangePinInput, ChangePinSchema, SetPinInput, SetPinSchema } from '@zentry/validators';
import { ProtectedShell } from '@/components/layout/protected-shell';
import { EmptyState } from '@/components/shared/empty-state';
import { AccountPanel } from '@/components/shared/account-panel';
import { PageHero } from '@/components/shared/page-hero';
import { useAuthProfile } from '@/hooks/use-auth-profile';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';

export default function SecurityPage() {
  const { profile, loading, error, reload } = useAuthProfile();

  if (loading) {
    return (
      <ProtectedShell title="Security">
        <div className="mx-auto max-w-5xl space-y-5 p-4 md:space-y-6 md:p-8">
          <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 animate-pulse rounded-3xl bg-slate-200" />
            <div className="h-80 animate-pulse rounded-3xl bg-slate-200" />
          </div>
        </div>
      </ProtectedShell>
    );
  }

  if (!profile || error) {
    return (
      <ProtectedShell title="Security">
        <EmptyState
          title="Security workspace unavailable"
          message={error ?? 'We could not load your account security details right now.'}
          icon={Shield}
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
    <ProtectedShell title="Security">
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:space-y-6 md:p-8">
        <PageHero
          eyebrow="Security"
          title="Protect your account and wallet access"
          description="This page now reflects the real auth and wallet-protection capabilities already available in the backend."
          aside={
            <>
              <SecurityBadge
                label="Email status"
                value={profile.isEmailVerified ? 'Verified' : 'Pending'}
              />
              <SecurityBadge
                label="Wallet PIN"
                value={profile.hasWalletPin ? 'Configured' : 'Not set'}
              />
            </>
          }
        />

        <div className="grid gap-5 md:gap-6 xl:grid-cols-[1fr_1fr]">
          <AccountPanel
            title={profile.hasWalletPin ? 'Change wallet PIN' : 'Set wallet PIN'}
            description={
              profile.hasWalletPin
                ? 'Use a fresh 6-digit PIN to secure sensitive wallet actions.'
                : 'Create a 6-digit PIN now so wallet-sensitive actions are protected.'
            }
          >
            {profile.hasWalletPin ? (
              <ChangePinForm onSuccess={reload} />
            ) : (
              <SetPinForm onSuccess={reload} />
            )}
          </AccountPanel>

          <div className="space-y-6">
            <AccountPanel
              title="Account protections"
              description="A quick view of the protections already active on this account."
            >
              <div className="space-y-4">
                <SecurityRow
                  icon={ShieldCheck}
                  title="Email verification"
                  description={
                    profile.isEmailVerified
                      ? 'Your email is verified and can be used for login recovery and account updates.'
                      : 'Complete email verification to strengthen account recovery and notifications.'
                  }
                />
                <SecurityRow
                  icon={WalletCards}
                  title="Wallet PIN"
                  description={
                    profile.hasWalletPin
                      ? 'A wallet PIN is already configured for secure wallet-sensitive actions.'
                      : 'No wallet PIN is configured yet. Set one now to protect future wallet actions.'
                  }
                />
                <SecurityRow
                  icon={KeyRound}
                  title="Session recovery"
                  description="Password reset invalidates refresh sessions so old browser sessions lose access after a reset."
                />
              </div>
            </AccountPanel>

            <AccountPanel
              title="Recovery actions"
              description="Use the current auth flows to recover or refresh access without waiting for a later phase."
            >
              <div className="space-y-3">
                <Link
                  href="/forgot-password"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-white"
                >
                  Start password reset
                  <span className="text-slate-400">Open</span>
                </Link>
                <Link
                  href="/support"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-white"
                >
                  Contact support if you are locked out
                  <span className="text-slate-400">Open</span>
                </Link>
              </div>
            </AccountPanel>
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}

function SetPinForm({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SetPinInput>({
    resolver: zodResolver(SetPinSchema),
  });

  const onSubmit = async (values: SetPinInput) => {
    setSubmitting(true);

    try {
      await apiClient.post('/auth/set-pin', values);
      toast.success('Wallet PIN set successfully.');
      reset();
      onSuccess();
    } catch (requestError: unknown) {
      toast.error(
        getApiErrorMessage(
          requestError,
          'We could not update your wallet PIN right now.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <SecurityInput
        label="PIN"
        error={errors.pin?.message}
        inputProps={{
          type: 'password',
          inputMode: 'numeric',
          maxLength: 6,
          autoComplete: 'off',
          ...register('pin'),
        }}
      />

      <SecurityInput
        label="Confirm PIN"
        error={errors.confirmPin?.message}
        inputProps={{
          type: 'password',
          inputMode: 'numeric',
          maxLength: 6,
          autoComplete: 'off',
          ...register('confirmPin'),
        }}
      />

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Set PIN'}
      </button>
    </form>
  );
}

function ChangePinForm({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePinInput>({
    resolver: zodResolver(ChangePinSchema),
  });

  const onSubmit = async (values: ChangePinInput) => {
    setSubmitting(true);

    try {
      await apiClient.post('/auth/change-pin', values);
      toast.success('Wallet PIN changed successfully.');
      reset();
      onSuccess();
    } catch (requestError: unknown) {
      toast.error(
        getApiErrorMessage(
          requestError,
          'We could not update your wallet PIN right now.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <SecurityInput
        label="Current PIN"
        error={errors.currentPin?.message}
        inputProps={{
          type: 'password',
          inputMode: 'numeric',
          maxLength: 6,
          autoComplete: 'off',
          ...register('currentPin'),
        }}
      />

      <SecurityInput
        label="New PIN"
        error={errors.newPin?.message}
        inputProps={{
          type: 'password',
          inputMode: 'numeric',
          maxLength: 6,
          autoComplete: 'off',
          ...register('newPin'),
        }}
      />

      <SecurityInput
        label="Confirm PIN"
        error={errors.confirmPin?.message}
        inputProps={{
          type: 'password',
          inputMode: 'numeric',
          maxLength: 6,
          autoComplete: 'off',
          ...register('confirmPin'),
        }}
      />

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Update PIN'}
      </button>
    </form>
  );
}

function SecurityBadge({
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

function SecurityRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 sm:p-4">
      <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0D1B3E] shadow-sm">
        <Icon size={18} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function SecurityInput({
  label,
  error,
  inputProps,
}: {
  label: string;
  error?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        {...inputProps}
        className={cn(
          'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition',
          'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10',
          error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
        )}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : null}
    </div>
  );
}
