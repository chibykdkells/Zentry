'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@zendocx/validators';
import { AuthShell } from '@/components/auth/auth-shell';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setLoading(true);
    setFormError(null);

    try {
      await apiClient.post('/auth/forgot-password', values);
      toast.success('If the email exists, a reset token has been issued.');
      router.push(
        appendTenantContextToPath(
          `/reset-password?email=${encodeURIComponent(values.email)}`,
          resolveTenantSlugForRequest(),
        ),
      );
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Could not start password reset.');
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we’ll start the password reset flow."
      footer={
        <>
          Remembered your password?{' '}
          <Link
            href={appendTenantContextToPath('/login', resolveTenantSlugForRequest())}
            className="font-semibold text-amber-600 hover:text-amber-700"
          >
            Back to login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {formError ? (
          <FeedbackBanner tone="error" title="Reset could not start" message={formError} />
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Recovery step one</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Enter the email tied to your account. In local development, the reset token is logged by the API for testing.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </span>
          <input
            type="email"
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm outline-none transition',
              'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/15',
              errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white',
            )}
            {...register('email')}
          />
          {errors.email ? (
            <span className="mt-1 block text-xs text-red-500">
              {errors.email.message}
            </span>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2f5e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Submitting...' : 'Continue'}
        </button>
      </form>
    </AuthShell>
  );
}
