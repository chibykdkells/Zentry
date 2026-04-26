import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function SkeletonBlock({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-3xl bg-slate-200/90', className)} />;
}

export function SkeletonLine({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-full bg-slate-200/90', className)} />;
}

export function SkeletonCircle({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-full bg-slate-200/90', className)} />;
}
