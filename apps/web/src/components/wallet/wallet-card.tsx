'use client';

import { useState } from 'react';
import { CreditCard, Eye, EyeOff, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/format';

interface WalletCardAction {
  label: string;
  onClick?: () => void;
  icon?: 'fund' | 'withdraw';
}

interface WalletCardProps {
  availableBalance: string; // kobo as string from API
  escrowBalance?: string;
  onFundClick?: () => void;
  actionLabel?: string;
  secondaryAction?: WalletCardAction;
  className?: string;
}

export function WalletCard({
  availableBalance,
  escrowBalance,
  onFundClick,
  actionLabel = 'Add money',
  secondaryAction,
  className,
}: WalletCardProps) {
  const [hidden, setHidden] = useState(false);
  const canFund = typeof onFundClick === 'function';
  const canUseSecondary = typeof secondaryAction?.onClick === 'function';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-brand-navy p-5 text-white sm:p-6',
        'bg-[linear-gradient(135deg,var(--brand-navy)_0%,var(--brand-navy-strong)_55%,#0a1630_100%)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,166,35,0.12),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.14]" />
      </div>

      <div className="relative">
        <div className="mb-5 flex items-center justify-between sm:mb-6">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-brand-accent" />
            <span className="text-xs font-medium text-slate-300 sm:text-sm">Available Balance</span>
          </div>
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="mb-5 sm:mb-6">
          <p className="text-[2rem] font-bold tracking-tight sm:text-4xl">
            {hidden ? '₦ ••••••' : formatNaira(availableBalance)}
          </p>
          {escrowBalance && Number(escrowBalance) > 0 && (
            <p className="mt-1 text-xs text-brand-accent/80">
              + {formatNaira(escrowBalance)} currently on hold
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onFundClick}
            disabled={!canFund}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
              canFund
                ? 'bg-brand-accent text-white transition-colors hover:bg-brand-accent/90'
                : 'cursor-not-allowed bg-white/10 text-slate-300',
              'active:scale-95 duration-150',
            )}
          >
            <CreditCard size={16} />
            {actionLabel}
          </button>

          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={!canUseSecondary}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                canUseSecondary
                  ? 'border-white/20 bg-white/8 text-white hover:bg-white/14'
                  : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-400',
              )}
            >
              {secondaryAction.icon === 'withdraw' ? (
                <Landmark size={16} />
              ) : (
                <CreditCard size={16} />
              )}
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
