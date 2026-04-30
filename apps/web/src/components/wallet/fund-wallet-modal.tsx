'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Wallet } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  InitiateWalletFundingInput,
  InitiateWalletFundingSchema,
} from '@zendocx/validators';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';

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

export function FundWalletModal({
  open,
  onClose,
  onSuccess,
}: FundWalletModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FundingInitResponse | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InitiateWalletFundingInput>({
    resolver: zodResolver(InitiateWalletFundingSchema),
    defaultValues: { amountNaira: 1000 },
  });

  useEffect(() => {
    if (!open) {
      setResult(null);
      setInlineError(null);
      reset({ amountNaira: 1000 });
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
      toast.success(response.data.message);
      onSuccess?.();
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        'Could not initialize wallet funding right now.',
      );
      setInlineError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Fund your wallet
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Initialize a funding session with the active payment gateway. Webhook-based balance crediting lands in the next Phase 2 batch.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {result ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-700">
                Funding session created
              </p>
              <p className="mt-2 text-sm text-emerald-700/90">
                Reference: {result.reference}
              </p>
              <p className="mt-1 text-sm text-emerald-700/90">
                Gateway: {result.gateway}
              </p>
              <p className="mt-1 text-sm text-emerald-700/90">
                Mode: {result.checkoutMode === 'sandbox' ? 'Sandbox checkout' : 'Live checkout'}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Continue to checkout to complete funding. In local development,
                this returns to your wallet automatically through the sandbox
                confirmation path until real gateway credentials are configured.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.assign(result.paymentUrl);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-strong"
              >
                <Wallet size={16} />
                Continue to checkout
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
            {inlineError ? (
              <FeedbackBanner tone="error" title="Funding could not start" message={inlineError} />
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Funding amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  ₦
                </span>
                <input
                  type="number"
                  min={100}
                  step="100"
                  className={cn(
                    'w-full rounded-2xl border bg-white px-4 py-3 pl-9 text-sm outline-none transition',
                    'focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10',
                    errors.amountNaira
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200',
                  )}
                  {...register('amountNaira', { valueAsNumber: true })}
                />
              </div>
              {errors.amountNaira ? (
                <p className="mt-1 text-xs text-red-500">
                  {errors.amountNaira.message}
                </p>
              ) : null}
            </div>

            <FeedbackBanner
              tone="info"
              title="What happens next"
              message="This starts checkout only. Your wallet balance updates after confirmation returns from the payment flow."
            />

            <div className="flex flex-col gap-3 sm:flex-row">
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
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Initializing...' : 'Continue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
