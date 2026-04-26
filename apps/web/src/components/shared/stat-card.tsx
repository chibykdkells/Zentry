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

const variants = {
  orange: 'border-brand-line bg-brand-surface text-brand-ink',
  green: 'border-brand-line bg-brand-surface text-brand-ink',
  navy: 'border-brand-line bg-brand-surface text-brand-ink',
  teal: 'border-brand-line bg-brand-surface text-brand-ink',
  amber: 'border-brand-line bg-brand-surface text-brand-ink',
};

const iconVariants = {
  orange: 'bg-brand-surface-soft text-brand-navy',
  green: 'bg-brand-surface-soft text-brand-navy',
  navy: 'bg-brand-navy text-white',
  teal: 'bg-brand-surface-soft text-brand-navy',
  amber: 'bg-brand-surface-soft text-brand-navy',
};

export function StatCard({ title, value, icon: Icon, variant = 'navy', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm sm:p-5',
        variants[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-brand-muted sm:text-sm">{title}</p>
          <p className="text-xl font-bold tracking-tight text-brand-ink sm:text-2xl">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl sm:h-11 sm:w-11', iconVariants[variant])}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
