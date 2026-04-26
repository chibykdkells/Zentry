'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Loader2, RotateCcw } from 'lucide-react';
import { VerifyOtpSchema, ResendOtpSchema, type VerifyOtpInput } from '@zentry/validators';
import { useAuthStore, type AuthUser } from '@/stores/auth.store';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { getDefaultRouteForRole } from '@/lib/auth-routes';
import { UserRole } from '@zentry/types';
import { AuthShell } from '@/components/auth/auth-shell';
import { OtpInput } from '@/components/auth/otp-input';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { SkeletonBlock, SkeletonLine } from '@/components/shared/skeleton-loader';
import { cn } from '@/lib/utils';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthPageFallback title="Verify your email" description="Loading verification details..." />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const email = searchParams.get('email') ?? '';
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VerifyOtpInput>({
    resolver: zodResolver(VerifyOtpSchema),
    defaultValues: {
      email,
      otp: '',
    },
  });

  useEffect(() => {
    if (email) {
      setValue('email', email);
    }
  }, [email, setValue]);

  const otpValue = watch('otp');

  const handleVerifiedUser = async (accessToken: string) => {
    const profileResponse = await apiClient.get<{
      data: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: UserRole;
        isEmailVerified: boolean;
      };
    }>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = profileResponse.data.data as AuthUser;
    setAuth(user, accessToken);
    router.push(getDefaultRouteForRole(user.role));
  };

  const onSubmit = async (values: VerifyOtpInput) => {
    setLoading(true);
    setFormError(null);

    try {
      const response = await apiClient.post<{
        data: { accessToken: string; role: UserRole };
      }>('/auth/verify-email', values);

      toast.success('Email verified successfully.');
      await handleVerifiedUser(response.data.data.accessToken);
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Verification failed. Please try again.');
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Go back and enter your email first.');
      return;
    }

    setResending(true);
    setInfoMessage(null);

    try {
      await apiClient.post('/auth/resend-otp', ResendOtpSchema.parse({ email }));
      setInfoMessage('A new verification code has been sent. Check your inbox and enter the latest code.');
      toast.success('A new verification code has been sent.');
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Could not resend OTP. Please try again.');
      setFormError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      description="Enter the 6-digit code sent to your email address to activate your account."
      footer={
        <>
          Need a different email?{' '}
          <Link href="/register" className="font-semibold text-amber-600 hover:text-amber-700">
            Go back to registration
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {infoMessage ? (
          <FeedbackBanner tone="success" title="Code sent" message={infoMessage} />
        ) : null}

        {formError ? (
          <FeedbackBanner tone="error" title="Verification failed" message={formError} />
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Verification in progress</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-slate-700">
              {email || 'your email address'}
            </span>
            . Paste the full code or enter it one box at a time.
          </p>
        </div>

        <Field label="Email address" error={errors.email?.message}>
          <input
            type="email"
            readOnly={Boolean(email)}
            className={inputClass(errors.email?.message, Boolean(email))}
            {...register('email')}
          />
        </Field>

        <Field label="Verification code" error={errors.otp?.message}>
          <>
            <input type="hidden" {...register('otp')} />
            <OtpInput
              value={otpValue ?? ''}
              onChange={(nextValue) =>
                setValue('otp', nextValue, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
              disabled={loading}
              error={Boolean(errors.otp)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Enter the 6-digit code. You can paste the full code directly.
            </p>
          </>
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2f5e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Verifying...' : 'Verify email'}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
          {resending ? 'Sending...' : 'Resend code'}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthPageFallback({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AuthShell title={title} description={description}>
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6">
        <SkeletonLine className="h-4 w-36" />
        <SkeletonBlock className="h-12 rounded-2xl" />
        <SkeletonLine className="h-4 w-40" />
        <div className="flex gap-2 sm:gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-14 w-12 rounded-2xl sm:h-16 sm:w-14" />
          ))}
        </div>
        <SkeletonBlock className="h-12 rounded-2xl" />
      </div>
    </AuthShell>
  );
}

function inputClass(error?: string, readOnly = false) {
  return cn(
    'w-full rounded-xl border px-4 py-3 text-sm outline-none transition',
    'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/15',
    readOnly && 'cursor-not-allowed bg-slate-100',
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
