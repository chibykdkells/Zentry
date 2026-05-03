'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { ResetPasswordSchema, type ResetPasswordInput } from '@zendocx/validators';
import { AuthShell } from '@/components/auth/auth-shell';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';
import { cn } from '@/lib/utils';
import { SkeletonBlock, SkeletonLine } from '@/components/shared/skeleton-loader';

const RESEND_COOLDOWN = 60;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      token,
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (token) {
      setValue('token', token);
    }
  }, [setValue, token]);

  useEffect(() => {
    startCooldown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const onSubmit = async (values: ResetPasswordInput) => {
    setLoading(true);
    setFormError(null);

    try {
      await apiClient.post('/auth/reset-password', values);
      toast.success('Password reset successful. Sign in with your new password.');
      router.push(
        resolveTenantSlugForRequest()
          ? appendTenantContextToPath('/login', resolveTenantSlugForRequest())
          : '/platform/login',
      );
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Could not reset password.');
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      toast.success('A new reset token has been sent to your email.');
      startCooldown();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Could not resend the token.'));
    } finally {
      setResending(false);
    }
  };

  const loginHref = resolveTenantSlugForRequest()
    ? appendTenantContextToPath('/login', resolveTenantSlugForRequest())
    : '/platform/login';

  return (
    <AuthShell
      title="Choose a new password"
      description="Enter the reset token and set a new secure password for your account."
      footer={
        <>
          Back to{' '}
          <Link href={loginHref} className="font-semibold text-amber-600 hover:text-amber-700">
            login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {formError ? (
          <FeedbackBanner tone="error" title="Reset failed" message={formError} />
        ) : null}

        {!token ? (
          <FeedbackBanner
            tone="warning"
            title="Reset token needed"
            message="If you do not already have a reset token, go back and start from the forgot-password flow first."
          />
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Recovery step two</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Paste the reset token from your email, choose a new password, and then return to sign in.
          </p>
        </div>

        <Field label="Reset token" error={errors.token?.message}>
          <input
            className={inputClass(errors.token?.message)}
            {...register('token')}
          />
        </Field>

        <Field label="New password" error={errors.password?.message}>
          <input
            type="password"
            className={inputClass(errors.password?.message)}
            {...register('password')}
          />
        </Field>

        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <input
            type="password"
            className={inputClass(errors.confirmPassword?.message)}
            {...register('confirmPassword')}
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2f5e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Resetting...' : 'Reset password'}
        </button>

        {email ? (
          <p className="text-center text-sm text-slate-500">
            Didn&apos;t receive the email?{' '}
            {cooldown > 0 ? (
              <span className="text-slate-400">
                Resend in{' '}
                <span className="tabular-nums font-semibold text-slate-600">
                  {cooldown}s
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="font-semibold text-amber-600 hover:text-amber-700 disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend token'}
              </button>
            )}
          </p>
        ) : null}
      </form>
    </AuthShell>
  );
}

function AuthPageFallback() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Preparing the reset form for your account."
    >
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6">
        <SkeletonLine className="h-4 w-40" />
        <SkeletonBlock className="h-12 rounded-2xl" />
        <SkeletonBlock className="h-12 rounded-2xl" />
        <SkeletonBlock className="h-12 rounded-2xl" />
        <SkeletonBlock className="h-12 rounded-2xl" />
      </div>
    </AuthShell>
  );
}

function inputClass(error?: string) {
  return cn(
    'w-full rounded-xl border px-4 py-3 text-sm outline-none transition',
    'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/15',
    error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white',
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-500">{error}</span> : null}
    </label>
  );
}
