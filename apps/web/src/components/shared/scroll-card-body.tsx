import { cn } from '@/lib/utils';

interface ScrollCardBodyProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  maxHeightClassName?: string;
}

export function ScrollCardBody({
  children,
  className,
  bodyClassName,
  maxHeightClassName = 'max-h-[26rem]',
}: ScrollCardBodyProps) {
  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 flex-col rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.9)_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
        className,
      )}
    >
      <div
        className={cn(
          maxHeightClassName,
          'min-h-0 overflow-y-auto pr-1',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
