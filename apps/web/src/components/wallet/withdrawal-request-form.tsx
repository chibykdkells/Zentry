'use client';

import { ChevronDown, Loader2, Send } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  CreateWithdrawalRequestInput,
  CreateWithdrawalRequestSchema,
} from '@zendocx/validators';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { useCreateWithdrawalRequest } from '@/hooks/use-withdrawal-requests';
import { useBanks } from '@/hooks/use-wallet';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

const WITHDRAWAL_FEE_RATE = 0.0299; // 2.99%

function calcFeeBreakdown(amountNaira: number) {
  const amountKobo = Math.round(amountNaira * 100);
  const feeKobo = Math.ceil(amountKobo * WITHDRAWAL_FEE_RATE);
  const payoutKobo = amountKobo - feeKobo;
  return { feeKobo, payoutKobo };
}

export function WithdrawalRequestForm() {
  const mutation = useCreateWithdrawalRequest();
  const { banks, loading: banksLoading } = useBanks();
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateWithdrawalRequestInput>({
    resolver: zodResolver(CreateWithdrawalRequestSchema),
    defaultValues: {
      amountNaira: 1000,
      bankName: '',
      bankCode: '',
      accountNumber: '',
      accountName: '',
    },
  });

  const selectedBankCode = useWatch({ control, name: 'bankCode' });
  const watchedAmount = useWatch({ control, name: 'amountNaira' });
  const { feeKobo, payoutKobo } = calcFeeBreakdown(Number(watchedAmount) || 0);

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const bank = banks.find((b) => b.code === code);
    setValue('bankCode', code, { shouldValidate: true });
    setValue('bankName', bank?.name ?? '', { shouldValidate: true });
  };

  const onSubmit = (values: CreateWithdrawalRequestInput) => {
    setFeedback(null);
    mutation.mutate(values, {
      onSuccess: () => {
        reset({
          amountNaira: 1000,
          bankName: '',
          bankCode: '',
          accountNumber: '',
          accountName: '',
        });
        setFeedback({
          tone: 'success',
          title: 'Request submitted',
          message:
            'Your withdrawal request is now under review. The amount has been reserved from your available balance.',
        });
      },
      onError: (error) => {
        setFeedback({
          tone: 'error',
          title: 'Request failed',
          message: getApiErrorMessage(
            error,
            'Could not submit your withdrawal request right now.',
          ),
        });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {feedback ? (
        <FeedbackBanner
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Withdrawal amount" error={errors.amountNaira?.message}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              ₦
            </span>
            <input
              type="number"
              min={100}
              step="100"
              className={inputClass(Boolean(errors.amountNaira), 'pl-9')}
              {...register('amountNaira', { valueAsNumber: true })}
            />
          </div>
        </Field>

        <Field label="Account name" error={errors.accountName?.message}>
          <input
            className={inputClass(Boolean(errors.accountName))}
            placeholder="John Doe"
            {...register('accountName')}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Bank" error={errors.bankCode?.message ?? errors.bankName?.message}>
          {banks.length > 0 ? (
            <div className="relative">
              <select
                value={selectedBankCode}
                onChange={handleBankChange}
                className={cn(
                  inputClass(Boolean(errors.bankCode || errors.bankName)),
                  'appearance-none pr-10',
                )}
              >
                <option value="">Select a bank</option>
                {banks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          ) : (
            <input
              className={inputClass(Boolean(errors.bankName))}
              placeholder={banksLoading ? 'Loading banks…' : 'Access Bank'}
              disabled={banksLoading}
              {...register('bankName')}
            />
          )}
          {/* hidden inputs keep bankCode + bankName in form state */}
          <input type="hidden" {...register('bankCode')} />
          <input type="hidden" {...register('bankName')} />
        </Field>

        <Field label="Account number" error={errors.accountNumber?.message}>
          <input
            inputMode="numeric"
            className={inputClass(Boolean(errors.accountNumber))}
            placeholder="0123456789"
            {...register('accountNumber')}
          />
        </Field>
      </div>

      {Number(watchedAmount) > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
          <p className="mb-3 font-semibold text-slate-700">Charge breakdown</p>
          <div className="space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Amount requested</span>
              <span>{formatNaira(String(Math.round(Number(watchedAmount) * 100)))}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Service charge (2.99%)</span>
              <span>− {formatNaira(String(feeKobo))}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>You will receive</span>
              <span>{formatNaira(String(payoutKobo))}</span>
            </div>
          </div>
        </div>
      )}

      <FeedbackBanner
        tone="info"
        title="Before you submit"
        message="Requests reserve funds immediately from your available balance. Admin review then moves the request through approval, processing, or rejection with a clear audit trail."
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mutation.isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
        {mutation.isPending ? 'Submitting...' : 'Submit withdrawal request'}
      </button>
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

function inputClass(hasError: boolean, extraClassName?: string) {
  return cn(
    'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition',
    'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10',
    hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
    extraClassName,
  );
}
