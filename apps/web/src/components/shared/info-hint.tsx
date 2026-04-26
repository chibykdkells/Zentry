'use client';

import { Info } from 'lucide-react';

export function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400"
      aria-label={text}
    >
      <Info size={12} />
    </span>
  );
}
