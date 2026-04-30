'use client';

import { useState } from 'react';
import { Eye, EyeOff, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/format';

interface WalletCardProps {
  availableBalance: string; // kobo as string from API
  escrowBalance?: string;
  onFundClick?: () => void;
  actionLabel?: string;
  className?: string;
}

export function WalletCard({
  availableBalance,
  escrowBalance,
  onFundClick,
  actionLabel = 'Add money',
  className,
}: WalletCardProps) {
  const [hidden, setHidden] = useState(false);
  const canFund = typeof onFundClick === 'function';

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

        <button
          type="button"
          onClick={onFundClick}
          disabled={!canFund}
          className={cn(
            'flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold',
            canFund
              ? 'bg-brand-accent hover:bg-brand-accent/90 text-white transition-colors'
              : 'bg-white/10 text-slate-300 cursor-not-allowed',
            'active:scale-95 duration-150',
          )}
        >
          <CreditCard size={16} />
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
