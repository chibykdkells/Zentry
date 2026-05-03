'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItem {
  id: string;
  header: ReactNode;
  body: (isOpen: boolean) => ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpenIds?: string[];
  className?: string;
  onOpenChange?: (id: string, isOpen: boolean) => void;
}

export function Accordion({
  items,
  allowMultiple = true,
  defaultOpenIds,
  className,
  onOpenChange,
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenIds ?? []),
  );

  const toggle = (id: string) => {
    setOpenIds((current) => {
      const isCurrentlyOpen = current.has(id);
      const next = new Set(current);
      if (isCurrentlyOpen) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }
      onOpenChange?.(id, !isCurrentlyOpen);
      return next;
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div
            key={item.id}
            className={cn(
              'overflow-hidden rounded-[1.5rem] border bg-white transition-[border-color,box-shadow] duration-150',
              isOpen ? 'border-[#0D1B3E]/20 shadow-sm' : 'border-slate-200',
            )}
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className="flex w-full items-start gap-3 p-5 text-left"
            >
              <div className="min-w-0 flex-1">{item.header}</div>
              <ChevronDown
                size={17}
                className={cn(
                  'mt-0.5 shrink-0 text-slate-400 transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            </button>

            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-200',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                  {item.body(isOpen)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
