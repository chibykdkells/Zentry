import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

interface FeedbackBannerProps {
  tone?: FeedbackTone;
  title?: string;
  message: string;
  className?: string;
}

const toneClasses: Record<
  FeedbackTone,
  { wrapper: string; icon: string; title: string; message: string }
> = {
  info: {
    wrapper: 'border-sky-200 bg-sky-50',
    icon: 'text-sky-600',
    title: 'text-sky-900',
    message: 'text-sky-800',
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    message: 'text-emerald-800',
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    message: 'text-amber-800',
  },
  error: {
    wrapper: 'border-rose-200 bg-rose-50',
    icon: 'text-rose-600',
    title: 'text-rose-900',
    message: 'text-rose-800',
  },
};

export function FeedbackBanner({
  tone = 'info',
  title,
  message,
  className,
}: FeedbackBannerProps) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warning'
        ? TriangleAlert
        : tone === 'error'
          ? AlertCircle
          : Info;
  const palette = toneClasses[tone];

  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border px-4 py-3',
        palette.wrapper,
        className,
      )}
    >
      <div className={cn('mt-0.5 shrink-0', palette.icon)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        {title ? (
          <p className={cn('text-sm font-semibold', palette.title)}>{title}</p>
        ) : null}
        <p className={cn('text-sm leading-6', palette.message)}>{message}</p>
      </div>
    </div>
  );
}
