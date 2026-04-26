import { EmptyState } from '@/components/shared/empty-state';
import type { LucideIcon } from 'lucide-react';

interface FeaturePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function FeaturePlaceholder({
  title,
  description,
  icon,
}: FeaturePlaceholderProps) {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50">
          <EmptyState
            title={`${title} is coming next`}
            message="This route is now stable and no longer breaks navigation. The full feature implementation is scheduled for a later slice."
            icon={icon}
          />
        </div>
      </div>
    </div>
  );
}
