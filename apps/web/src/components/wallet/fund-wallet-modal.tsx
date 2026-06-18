'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Loader2, RefreshCw, Wallet, X } from 'lucide-react';
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

interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  expiresAt: string;
}

interface FundingInitResponse {
  reference: string;
  paymentUrl: string | null;
  virtualAccount: VirtualAccount | null;
  gateway: string;
  amountKobo: string;
  amountNaira: number;
  status: string;
  checkoutMode: 'live' | 'sandbox';
}

type Step = 'form' | 'virtual-account' | 'confirming' | 'confirmed';

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const expired = secondsLeft === 0 && expiresAt !== null;
  return { m, s, expired, secondsLeft };
}

export function FundWalletModal({ open, onClose, onSuccess }: FundWalletModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [result, setResult] = useState<FundingInitResponse | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const countdown = useCountdown(result?.virtualAccount?.expiresAt ?? null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('form');
      setResult(null);
      setInlineError(null);
      setCopied(false);
      reset({ amountNaira: 1_000 });
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open, reset]);

  // Auto-poll for confirmation once virtual account is shown
  useEffect(() => {
    if (step !== 'virtual-account' || !result) return;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.post<{ data: { status: string } }>(
          '/wallet/fund/confirm',
          { reference: result.reference },
        );
        if (res.data.data.status === 'SUCCESS') {
          clearInterval(pollRef.current!);
          setStep('confirmed');
          onSuccess?.();
        }
      } catch {
        // Still pending — keep polling silently
      }
    }, 10_000); // poll every 10 s

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, result, onSuccess]);

  const onSubmit = async (values: InitiateWalletFundingInput) => {
    setLoading(true);
    setInlineError(null);
    try {
      const response = await apiClient.post<{
        data: FundingInitResponse;
        message: string;
      }>('/wallet/fund', values);
      const data = response.data.data;
      setResult(data);

      if (data.virtualAccount) {
        setStep('virtual-account');
      } else if (data.paymentUrl) {
        // Redirect-based gateway (Paystack / Flutterwave fallback)
        window.location.assign(data.paymentUrl);
      }
    } catch (error: unknown) {
      setInlineError(
        getApiErrorMessage(error, 'Could not initialize wallet funding right now.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleManualVerify = async () => {
    if (!result) return;
    setVerifying(true);
    try {
      const res = await apiClient.post<{ data: { status: string } }>(
        '/wallet/fund/confirm',
        { reference: result.reference },
      );
      if (res.data.data.status === 'SUCCESS') {
        if (pollRef.current) clearInterval(pollRef.current);
        setStep('confirmed');
        onSuccess?.();
      } else {
        setInlineError('Payment not received yet. Please wait a moment and try again.');
      }
    } catch (error: unknown) {
      setInlineError(getApiErrorMessage(error, 'Could not verify payment right now.'));
    } finally {
      setVerifying(false);
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
            {step === 'form' && 'Add funds'}
            {step === 'virtual-account' && 'Transfer to this account'}
            {step === 'confirming' && 'Verifying payment…'}
            {step === 'confirmed' && 'Payment confirmed'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Confirmed ──────────────────────────────────────────── */}
        {step === 'confirmed' ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 size={48} className="text-emerald-500" />
            <p className="text-base font-semibold text-slate-900">Wallet funded successfully</p>
            <p className="text-sm text-slate-500">
              {result ? formatNaira(result.amountKobo) : ''} has been added to your balance.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy/90"
            >
              Done
            </button>
          </div>
        ) : step === 'virtual-account' && result?.virtualAccount ? (
          /* ── Virtual account details ─────────────────────────── */
          <div className="space-y-3">
            {inlineError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {inlineError}
              </div>
            ) : null}

            {/* Amount hero */}
            <div className="rounded-2xl bg-brand-navy px-5 py-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
                Amount to transfer
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {formatNaira(result.amountKobo)}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
                  {result.gateway}
                </span>
                {!countdown.expired ? (
                  <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-semibold text-amber-300">
                    Expires in {countdown.m}:{String(countdown.s).padStart(2, '0')}
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-400/20 px-3 py-1 text-[11px] font-semibold text-rose-300">
                    Expired
                  </span>
                )}
              </div>
            </div>

            {/* Bank name */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Bank</p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {result.virtualAccount.bankName || '—'}
              </p>
            </div>

            {/* Account number with copy */}
            <button
              type="button"
              onClick={() => handleCopy(result.virtualAccount!.accountNumber)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:bg-slate-100 active:scale-[0.98]"
            >
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Account number
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-widest text-brand-navy">
                  {result.virtualAccount.accountNumber || '—'}
                </p>
              </div>
              <span className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-white transition',
                copied ? 'bg-emerald-500' : 'bg-brand-navy',
              )}>
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              </span>
            </button>

            <p className="px-1 text-xs text-slate-400">
              Transfer the exact amount to the account above. Your wallet will
              update automatically once the transfer is received.
            </p>

            {/* Reference */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2">
              <span className="text-xs text-slate-400">Reference</span>
              <span className="font-mono text-xs font-semibold text-slate-700">
                {result.reference}
              </span>
            </div>

            {/* Manual verify */}
            <button
              type="button"
              onClick={handleManualVerify}
              disabled={verifying || countdown.expired}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-accent px-4 py-3.5 text-sm font-bold text-white transition hover:bg-brand-accent/90 disabled:opacity-60"
            >
              {verifying
                ? <><Loader2 size={15} className="animate-spin" /> Checking…</>
                : <><RefreshCw size={15} /> I&apos;ve made the transfer</>}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              I&apos;ll do this later
            </button>
          </div>
        ) : (
          /* ── Amount input form ───────────────────────────────── */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {inlineError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {inlineError}
              </div>
            ) : null}

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
              A virtual account will be generated. Transfer the exact amount
              from your bank to fund your wallet instantly.
            </p>

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
                className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy/90 disabled:opacity-60"
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
