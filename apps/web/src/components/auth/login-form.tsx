'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { LoginSchema, LoginInput } from '@zentry/validators';
import { useAuthStore } from '@/stores/auth.store';
import apiClient from '@/lib/api-client';
import { disconnectSocket } from '@/lib/socket-client';
import { UserRole } from '@zentry/types';
import { AuthShell } from '@/components/auth/auth-shell';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { getSafePostLoginRoute } from '@/lib/auth-routes';
import { getHumanLoginErrorMessage } from '@/lib/api-error';
import {
  clearPersistedTenantSlug,
  persistActiveTenantSlug,
  resolveTenantSlugForRequest,
  shouldAllowPlatformLoginFallback,
} from '@/lib/tenant-runtime';
import { cn } from '@/lib/utils';

type LoginMode = 'auto' | 'platform';

type LoginSuccessPayload = {
  accessToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    tenantId: string | null;
    isEmailVerified: boolean;
  };
};

type LoginAttemptResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

async function attemptLogin(
  data: LoginInput,
  tenantSlug?: string | null,
): Promise<LoginAttemptResult> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
    },
    body: JSON.stringify(data),
  });

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

export function LoginForm({ mode = 'auto' }: { mode?: LoginMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, clearAuth, setAccessToken, setAuth, user } =
    useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nextPath = searchParams.get('next');
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const inferredTenantSlug =
    typeof window !== 'undefined' ? resolveTenantSlugForRequest() : null;
  const platformMode = mode === 'platform';
  const infoMessage =
    !formError && sessionExpired
      ? 'Your session expired. Please sign in again to continue.'
      : null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  useEffect(() => {
    if (!user || sessionExpired) {
      return;
    }

    if (accessToken) {
      const targetRoute = getSafePostLoginRoute(user.role, nextPath);
      router.replace(targetRoute);
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      try {
        const refreshRes = await apiClient.post<{
          data: { accessToken: string };
        }>('/auth/refresh');

        if (cancelled) {
          return;
        }

        setAccessToken(refreshRes.data.data.accessToken);
        router.replace(getSafePostLoginRoute(user.role, nextPath));
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    clearAuth,
    nextPath,
    router,
    sessionExpired,
    setAccessToken,
    user,
  ]);

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setFormError(null);
    disconnectSocket();
    clearAuth();

    try {
      const tenantSlug = platformMode ? null : inferredTenantSlug;
      const primaryAttempt = await attemptLogin(data, tenantSlug);

      let resolvedBody = primaryAttempt.body;
      let resolvedStatus = primaryAttempt.status;

      if (
        !primaryAttempt.ok &&
        primaryAttempt.status === 401 &&
        tenantSlug &&
        shouldAllowPlatformLoginFallback()
      ) {
        const fallbackAttempt = await attemptLogin(data, null);
        const fallbackData = (fallbackAttempt.body as {
          data?: LoginSuccessPayload;
        } | null)?.data;

        if (
          fallbackAttempt.ok &&
          fallbackData?.user?.role === UserRole.SUPER_ADMIN
        ) {
          resolvedBody = fallbackAttempt.body;
          resolvedStatus = fallbackAttempt.status;
        }
      }

      const payload = (resolvedBody as { data?: LoginSuccessPayload } | null)
        ?.data;

      if (!payload) {
        const error = new Error('Login failed');
        (
          error as Error & { response?: { status: number; data: unknown } }
        ).response = {
          status: resolvedStatus,
          data: resolvedBody,
        };
        throw error;
      }

      const { accessToken, user } = payload;
      if (user.role === UserRole.SUPER_ADMIN) {
        clearPersistedTenantSlug();
      } else if (tenantSlug) {
        persistActiveTenantSlug(tenantSlug);
      }
      setAuth(user, accessToken);

      toast.success(`Welcome back, ${user.firstName}!`);
      const targetRoute = getSafePostLoginRoute(user.role, nextPath);

      if (typeof window !== 'undefined') {
        reset();
        window.location.replace(targetRoute);
        return;
      }

      reset();
      router.push(targetRoute);
    } catch (err: unknown) {
      const message = getHumanLoginErrorMessage(err);
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const footer = platformMode ? (
    <p>
      Tenant users and CBT centers should sign in through the portal URL shared
      by their organization. Platform owners can continue here.
    </p>
  ) : (
    <div className="space-y-3 text-left">
      <p>
        New here?{' '}
        <Link
          href="/register"
          className="font-semibold text-[#0D1B3E] hover:text-[#132754]"
        >
          Create an individual account
        </Link>
      </p>
      <p>
        Operate a CBT center?{' '}
        <Link
          href="/register/cbt"
          className="font-semibold text-[#0D1B3E] hover:text-[#132754]"
        >
          Apply as a CBT center
        </Link>
      </p>
    </div>
  );

  return (
    <AuthShell
      variant={platformMode ? 'platform' : 'default'}
      title={platformMode ? 'Platform owner sign in' : 'Sign in'}
      description={
        platformMode
          ? 'Use this ZenDocx access point to manage tenants, provision tenant admins, and operate the platform dashboard.'
          : 'Access your ZenDocx workspace with a cleaner, role-aware sign-in flow.'
      }
      footer={footer}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {infoMessage ? (
          <FeedbackBanner tone="info" message={infoMessage} />
        ) : null}

        {formError ? (
          <FeedbackBanner
            tone="error"
            title="Sign-in failed"
            message={formError}
          />
        ) : null}

        {platformMode ? (
          <FeedbackBanner
            tone="info"
            title="Platform owner access"
            message="This login is for ZenDocx platform owners and internal admins. Tenant users should use their own business portal URL."
          />
        ) : null}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={cn(
              'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition',
              'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10',
              errors.email
                ? 'border-red-300 bg-red-50'
                : 'border-slate-200 bg-white',
            )}
            {...register('email')}
          />
          {errors.email ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-4">
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-slate-500 hover:text-[#0D1B3E]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className={cn(
                'w-full rounded-2xl border px-4 py-3 pr-11 text-sm outline-none transition',
                'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10',
                errors.password
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200 bg-white',
              )}
              {...register('password')}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition',
            'bg-[#0D1B3E] text-white hover:bg-[#132754]',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
