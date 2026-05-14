'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant?: 'orange' | 'green' | 'navy' | 'teal' | 'amber';
  className?: string;
}

const variants: Record<string, { card: string; title: string; value: string; icon: string }> = {
  orange: {
    card: 'bg-orange-500 border-orange-500',
    title: 'text-white/75',
    value: 'text-white',
    icon: 'bg-white/20 text-white',
  },
  green: {
    card: 'bg-emerald-600 border-emerald-600',
    title: 'text-white/75',
    value: 'text-white',
    icon: 'bg-white/20 text-white',
  },
  navy: {
    card: 'bg-[#0D1B3E] border-[#0D1B3E]',
    title: 'text-white/70',
    value: 'text-white',
    icon: 'bg-white/15 text-white',
  },
  teal: {
    card: 'bg-cyan-600 border-cyan-600',
    title: 'text-white/75',
    value: 'text-white',
    icon: 'bg-white/20 text-white',
  },
  amber: {
    card: 'bg-[#F5A623] border-[#F5A623]',
    title: 'text-[#0D1B3E]/70',
    value: 'text-[#0D1B3E]',
    icon: 'bg-black/10 text-[#0D1B3E]',
  },
};

export function StatCard({ title, value, icon: Icon, variant = 'navy', className }: StatCardProps) {
  const v = variants[variant];
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm sm:p-5',
        v.card,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('mb-1.5 text-xs font-semibold uppercase tracking-wider truncate', v.title)}>{title}</p>
          <p className={cn('truncate text-xl font-black tracking-tight sm:text-2xl', v.value)}>{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11', v.icon)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
