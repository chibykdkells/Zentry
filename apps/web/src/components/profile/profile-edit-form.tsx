'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Save } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { AUTH_PROFILE_QUERY_KEY, type AuthProfile } from '@/hooks/use-auth-profile';
import { cn } from '@/lib/utils';

interface ProfileEditFormProps {
  profile: AuthProfile;
}

interface ProfileEditValues {
  firstName: string;
  lastName: string;
  phone: string;
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileEditValues>({
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
    },
  });

  useEffect(() => {
    reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
    });
  }, [profile.firstName, profile.lastName, profile.phone, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ProfileEditValues) => {
      const response = await apiClient.patch<{ data: AuthProfile; message: string }>(
        '/users/me',
        values,
      );
      return response.data;
    },
    onSuccess: async (response) => {
      queryClient.setQueryData(AUTH_PROFILE_QUERY_KEY, response.data);
      await queryClient.invalidateQueries({ queryKey: AUTH_PROFILE_QUERY_KEY });
      toast.success(response.message ?? 'Profile updated successfully.');
      reset({
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        phone: response.data.phone,
      });
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(error, 'Could not update your profile right now.'),
      );
    },
  });

  const onSubmit = (values: ProfileEditValues) => {
    mutation.mutate({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First name" error={errors.firstName?.message}>
          <input
            className={inputClass(Boolean(errors.firstName))}
            {...register('firstName', {
              required: 'First name is required',
              minLength: { value: 2, message: 'First name must be at least 2 characters' },
              maxLength: { value: 50, message: 'First name must be 50 characters or fewer' },
            })}
          />
        </Field>

        <Field label="Last name" error={errors.lastName?.message}>
          <input
            className={inputClass(Boolean(errors.lastName))}
            {...register('lastName', {
              required: 'Last name is required',
              minLength: { value: 2, message: 'Last name must be at least 2 characters' },
              maxLength: { value: 50, message: 'Last name must be 50 characters or fewer' },
            })}
          />
        </Field>
      </div>

      <Field label="Phone number" error={errors.phone?.message}>
        <input
          className={inputClass(Boolean(errors.phone))}
          placeholder="+2348012345678"
          {...register('phone', {
            required: 'Phone number is required',
            pattern: {
              value: /^(\+234|0)[789][01]\d{8}$/,
              message: 'Enter a valid Nigerian phone number',
            },
          })}
        />
      </Field>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-500">
          Keep your basic account details current so notifications and order handoffs stay accurate.
        </p>
        <button
          type="submit"
          disabled={mutation.isPending || !isDirty}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {mutation.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
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

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition',
    'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10',
    hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
  );
}
