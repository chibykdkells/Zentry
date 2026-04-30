'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ZodType } from 'zod';
import {
  RegisterIndividualSchema,
  RegisterCbtSchema,
  type RegisterIndividualInput,
  type RegisterCbtInput,
} from '@zendocx/validators';
import { UserRole } from '@zendocx/types';
import { AuthShell } from '@/components/auth/auth-shell';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  appendTenantContextToPath,
  resolveTenantSlugForRequest,
} from '@/lib/tenant-runtime';
import { cn } from '@/lib/utils';
import { useTenantStore } from '@/stores/tenant.store';

type RegisterRole = UserRole.INDIVIDUAL | UserRole.CBT_CENTER;

interface RegistrationFormProps {
  role: RegisterRole;
  title: string;
  description: string;
  footer: React.ReactNode;
}

type RegistrationFormValues = RegisterIndividualInput & {
  address?: string;
  state?: string;
  centerName?: string;
  licenseNumber?: string;
  lga?: string;
};

const defaultValues: RegistrationFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  address: '',
  state: '',
  centerName: '',
  licenseNumber: '',
  lga: '',
};

function buildPayload(
  role: RegisterRole,
  values: RegistrationFormValues,
): RegisterIndividualInput | RegisterCbtInput {
  const commonFields = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    password: values.password,
    confirmPassword: values.confirmPassword,
  };

  switch (role) {
    case UserRole.CBT_CENTER:
      return {
        ...commonFields,
        centerName: values.centerName ?? '',
        licenseNumber: values.licenseNumber ?? '',
        address: values.address ?? '',
        state: values.state ?? '',
        lga: values.lga ?? '',
      };
    case UserRole.INDIVIDUAL:
    default:
      return commonFields;
  }
}

export function RegistrationForm({
  role,
  title,
  description,
  footer,
}: RegistrationFormProps) {
  const router = useRouter();
  const tenant = useTenantStore((state) => state.tenant);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const tenantReady = Boolean(tenant ?? resolveTenantSlugForRequest());
  const requiresTenant = true;

  const resolver = useMemo(() => {
    switch (role) {
      case UserRole.CBT_CENTER:
        return zodResolver(RegisterCbtSchema as ZodType<RegistrationFormValues>);
      case UserRole.INDIVIDUAL:
      default:
        return zodResolver(RegisterIndividualSchema as ZodType<RegistrationFormValues>);
    }
  }, [role]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver,
    defaultValues,
  });

  const onSubmit = async (values: RegistrationFormValues) => {
    if (requiresTenant && !tenantReady) {
      setFormError(
        'Registration is only available inside a tenant business portal. Use the portal URL shared by your organization, then try again.',
      );
      return;
    }

    setLoading(true);
    setFormError(null);

    const endpointMap: Record<RegisterRole, string> = {
      [UserRole.INDIVIDUAL]: '/auth/register/individual',
      [UserRole.CBT_CENTER]: '/auth/register/cbt',
    };

    try {
      await apiClient.post(endpointMap[role], buildPayload(role, values));
      toast.success('Registration successful. Verify your email to continue.');
      router.push(
        appendTenantContextToPath(
          `/verify-email?email=${encodeURIComponent(values.email)}`,
          resolveTenantSlugForRequest(),
        ),
      );
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Registration failed. Please try again.');
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={title} description={description} footer={footer}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {formError ? (
          <FeedbackBanner
            tone="error"
            title="Registration failed"
            message={formError}
          />
        ) : null}

        {!formError && requiresTenant && !tenantReady ? (
          <FeedbackBanner
            tone="info"
            title="Business portal required"
            message="ZenDocx is platform software for tenant businesses. Users and CBT centers must register through their organization's tenant portal, not the main Zendocx.net website."
          />
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">
            {role === UserRole.INDIVIDUAL
              ? 'Personal account setup'
              : 'Fulfillment onboarding'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {role === UserRole.INDIVIDUAL
              ? 'Use this path for a general user account that can buy services, manage orders, and use wallet features.'
              : 'This path is for approved CBT operators that will claim and fulfill manual service jobs.'}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Basic details
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            <input className={inputClass(errors.firstName?.message)} {...register('firstName')} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <input className={inputClass(errors.lastName?.message)} {...register('lastName')} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email address" error={errors.email?.message}>
            <input type="email" className={inputClass(errors.email?.message)} {...register('email')} />
          </Field>
          <Field label="Phone number" error={errors.phone?.message}>
            <input className={inputClass(errors.phone?.message)} placeholder="+2348012345678" {...register('phone')} />
          </Field>
        </div>


        {role === UserRole.CBT_CENTER ? (
          <>
            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Center details
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Center name" error={errors.centerName?.message}>
                <input className={inputClass(errors.centerName?.message)} {...register('centerName')} />
              </Field>
              <Field label="License number" error={errors.licenseNumber?.message}>
                <input className={inputClass(errors.licenseNumber?.message)} {...register('licenseNumber')} />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <Field label="Address" error={errors.address?.message}>
                <input className={inputClass(errors.address?.message)} {...register('address')} />
              </Field>
              <Field label="State" error={errors.state?.message}>
                <input className={inputClass(errors.state?.message)} {...register('state')} />
              </Field>
              <Field label="LGA" error={errors.lga?.message}>
                <input className={inputClass(errors.lga?.message)} {...register('lga')} />
              </Field>
            </div>
          </>
        ) : null}

        <div className="space-y-1 pt-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Access details
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Password" error={errors.password?.message}>
            <input type="password" className={inputClass(errors.password?.message)} {...register('password')} />
          </Field>
          <Field label="Confirm password" error={errors.confirmPassword?.message}>
            <input type="password" className={inputClass(errors.confirmPassword?.message)} {...register('confirmPassword')} />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading || (requiresTenant && !tenantReady)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}

function inputClass(error?: string) {
  return cn(
    'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition',
    'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10',
    error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
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
