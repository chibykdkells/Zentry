import { cn } from '@/lib/utils';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  message,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[1.5rem] border border-slate-100 bg-slate-50/70 px-5 py-14 text-center md:px-6 md:py-16',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm md:h-16 md:w-16">
        <Icon size={30} className="text-slate-400" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-700">{title}</h3>
      <p className="max-w-sm text-sm leading-6 text-slate-500">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
