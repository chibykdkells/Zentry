'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Wallet, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  InitiateWalletFundingInput,
  InitiateWalletFundingSchema,
} from '@zendocx/validators';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

const QUICK_AMOUNTS = [500, 1_000, 2_000, 5_000, 10_000];

interface FundWalletModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FundingInitResponse {
  reference: string;
  paymentUrl: string;
  gateway: string;
  amountKobo: string;
  amountNaira: number;
  status: string;
  checkoutMode: 'live' | 'sandbox';
}

export function FundWalletModal({ open, onClose, onSuccess }: FundWalletModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FundingInitResponse | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InitiateWalletFundingInput>({
    resolver: zodResolver(InitiateWalletFundingSchema),
    defaultValues: { amountNaira: 1_000 },
  });

  const currentAmount = watch('amountNaira');

  useEffect(() => {
    if (!open) {
      setResult(null);
      setInlineError(null);
      reset({ amountNaira: 1_000 });
    }
  }, [open, reset]);

  const onSubmit = async (values: InitiateWalletFundingInput) => {
    setLoading(true);
    setInlineError(null);
    try {
      const response = await apiClient.post<{
        data: FundingInitResponse;
        message: string;
      }>('/wallet/fund', values);
      setResult(response.data.data);
      onSuccess?.();
    } catch (error: unknown) {
      setInlineError(
        getApiErrorMessage(error, 'Could not initialize wallet funding right now.'),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm rounded-t-[2rem] bg-white px-5 pb-8 pt-5 shadow-2xl sm:rounded-[2rem] sm:px-6 sm:py-6">
        {/* drag pill — mobile only */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">
            {result ? 'Ready to pay' : 'Add funds'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            <X size={15} />
          </button>
        </div>

        {result ? (
          /* ── Success / ready state ─────────────────────────────── */
          <div className="space-y-3">
            {/* Amount hero card */}
            <div className="rounded-2xl bg-brand-navy px-5 py-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
                Amount
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {formatNaira(result.amountKobo)}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
                  {result.gateway}
                </span>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-semibold',
                    result.checkoutMode === 'live'
                      ? 'bg-emerald-400/20 text-emerald-300'
                      : 'bg-amber-400/20 text-amber-300',
                  )}
                >
                  {result.checkoutMode === 'live' ? 'Live' : 'Test'}
                </span>
              </div>
            </div>

            {/* Reference row */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-xs text-slate-400">Ref</span>
              <span className="font-mono text-xs font-semibold text-slate-700">
                {result.reference}
              </span>
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={() => window.location.assign(result.paymentUrl)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-accent px-4 py-3.5 text-sm font-bold text-white transition hover:bg-brand-accent/90 active:scale-[0.98]"
            >
              Pay with {result.gateway}
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* ── Input form ────────────────────────────────────────── */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {inlineError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {inlineError}
              </div>
            ) : null}

            {/* Amount input */}
            <div>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 transition',
                  'focus-within:border-brand-navy focus-within:ring-2 focus-within:ring-brand-navy/10',
                  errors.amountNaira ? 'border-rose-300' : 'border-slate-200',
                )}
              >
                <span className="text-base font-bold text-slate-400">₦</span>
                <input
                  type="number"
                  min={100}
                  step="100"
                  placeholder="0"
                  className="flex-1 bg-transparent text-2xl font-bold text-brand-ink outline-none placeholder:text-slate-200"
                  {...register('amountNaira', { valueAsNumber: true })}
                />
              </div>
              {errors.amountNaira ? (
                <p className="mt-1 text-xs text-rose-500">
                  {errors.amountNaira.message}
                </p>
              ) : null}
            </div>

            {/* Quick-select amounts */}
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() =>
                    setValue('amountNaira', amount, { shouldValidate: true })
                  }
                  className={cn(
                    'rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition',
                    currentAmount === amount
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-navy/30 hover:bg-slate-50',
                  )}
                >
                  {amount >= 1_000 ? `₦${amount / 1_000}k` : `₦${amount}`}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400">
              You&apos;ll be redirected to complete payment. Balance updates once confirmed.
            </p>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-strong disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Wallet size={15} />
                )}
                {loading ? 'Please wait…' : 'Fund Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
