'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function MobileSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: MobileSheetProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[1px] xl:hidden"
            onClick={onClose}
          />

          <motion.section
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed bottom-0 left-0 right-0 z-[80] max-h-[90vh] overflow-hidden rounded-t-[2.2rem] border border-slate-200 bg-white shadow-2xl xl:hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pt-3.5">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 pb-4 pt-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className={`overflow-y-auto px-4 pt-4 ${
                footer
                  ? 'max-h-[calc(90vh-164px)] pb-4'
                  : 'max-h-[calc(90vh-88px)] pb-[calc(1.25rem+env(safe-area-inset-bottom))]'
              }`}
            >
              {children}
            </div>

            {footer ? (
              <div className="border-t border-slate-100 bg-white/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
                {footer}
              </div>
            ) : null}
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}
