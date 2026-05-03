'use client';

import { type ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  zIndex?: 'base' | 'nested';
}

export function DetailModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'lg',
  zIndex = 'base',
}: DetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const maxW = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[width];
  const backdropZ = zIndex === 'nested' ? 'z-[70]' : 'z-[50]';
  const panelZ = zIndex === 'nested' ? 'z-[80]' : 'z-[60]';

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn('fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]', backdropZ)}
            onClick={onClose}
          />

          <div className={cn('fixed inset-0 flex items-start justify-center overflow-y-auto p-4 pt-[5vh]', panelZ)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className={cn(
                'relative flex w-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl',
                maxW,
                footer ? 'max-h-[88vh]' : 'max-h-[88vh]',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{title}</h2>
                  {description ? (
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

              {footer ? (
                <div className="shrink-0 border-t border-slate-100 px-6 py-4">{footer}</div>
              ) : null}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
