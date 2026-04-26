import { cn } from '@/lib/utils';

interface FilterOption {
  id: string;
  label: string;
}

interface FilterChipGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  className?: string;
}

export function FilterChipGroup({
  value,
  onChange,
  options,
  className,
}: FilterChipGroupProps) {
  return (
    <div
      className={cn(
        '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'shrink-0 rounded-full px-3 py-2.5 text-sm font-medium transition',
            value === option.id
              ? 'bg-[#0D1B3E] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
