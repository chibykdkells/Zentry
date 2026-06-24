'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/use-system-config';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';

// Human-readable label overrides
const KEY_LABELS: Record<string, string> = {
  DISPUTE_WINDOW_HOURS: 'Dispute window (hours)',
  CBT_DELIVERY_WINDOW_MINUTES: 'CBT delivery window (minutes)',
  MIN_WITHDRAWAL_KOBO: 'Min withdrawal (Kobo)',
  MAX_WITHDRAWAL_KOBO: 'Max withdrawal (Kobo)',
  PLATFORM_COMMISSION_RATE_BPS: 'Platform commission (basis points)',
  CBT_COMMISSION_RATE_BPS: 'CBT commission (basis points)',
};

const KEY_HINTS: Record<string, string> = {
  CBT_DELIVERY_WINDOW_MINUTES:
    '1–1440 minutes; how long a CBT has to deliver a manual order before it returns to the pool.',
  DISPUTE_WINDOW_HOURS: '1–72 hours',
  MIN_WITHDRAWAL_KOBO: 'e.g. 100000 = ₦1,000',
  MAX_WITHDRAWAL_KOBO: 'e.g. 50000000 = ₦500,000',
  PLATFORM_COMMISSION_RATE_BPS: '1000 bps = 10%',
  CBT_COMMISSION_RATE_BPS: '8000 bps = 80%',
};

function ConfigRow({ config }: { config: { key: string; value: string; description: string; updatedAt: string | null; isPersisted: boolean } }) {
  const [draft, setDraft] = useState(config.value);
  const [saved, setSaved] = useState(false);
  const update = useUpdateSystemConfig();

  const isDirty = draft !== config.value;

  const handleSave = async () => {
    try {
      await update.mutateAsync({ key: config.key, value: draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(`${KEY_LABELS[config.key] ?? config.key} updated`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update this setting'));
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {KEY_LABELS[config.key] ?? config.key}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{config.description}</p>
          {config.updatedAt && (
            <p className="mt-1 text-xs text-slate-400">
              Last updated {formatDate(config.updatedAt)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={KEY_HINTS[config.key] ?? ''}
              className="w-44 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800 outline-none transition focus:border-[#0D1B3E] focus:bg-white focus:ring-2 focus:ring-[#0D1B3E]/10"
            />
          </div>

          <button
            type="button"
            disabled={!isDirty || update.isPending}
            onClick={() => void handleSave()}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl transition ${
              saved
                ? 'bg-emerald-50 text-emerald-600'
                : isDirty
                  ? 'bg-[#0D1B3E] text-white hover:bg-[#132754]'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
            }`}
          >
            {update.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} />
            ) : (
              <Check size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSystemConfigPage() {
  const { configs, loading, error, reload } = useSystemConfig();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Platform Settings"
        description="Dispute window, withdrawal limits, and commission rates. Changes apply to new orders."
        actions={
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-2 rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-sm font-semibold text-amber-800">Important</p>
        <p className="mt-1 text-sm text-amber-700">
          Commission rate changes only apply to orders created after the update.
          Existing escrowed orders retain the commission split calculated at order time.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24 rounded-[1.5rem]" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Config unavailable"
          message={error}
          icon={Settings2}
          action={
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Try again
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <ConfigRow key={config.key} config={config} />
          ))}
        </div>
      )}
    </div>
  );
}
