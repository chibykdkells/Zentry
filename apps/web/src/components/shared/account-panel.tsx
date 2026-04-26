import { cn } from '@/lib/utils';

interface AccountPanelProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}

export function AccountPanel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  headerClassName,
}: AccountPanelProps) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      {title || description || actions ? (
        <div
          className={cn(
            'shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5',
            'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
            headerClassName,
          )}
        >
          <div className="space-y-1">
            {title ? (
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}

      <div className={cn('min-h-0 px-4 py-4 sm:px-6 sm:py-6', contentClassName)}>
        {children}
      </div>
    </section>
  );
}
