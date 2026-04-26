'use client';

import { useMemo, useState } from 'react';
import { ServiceDeliveryMode } from '@zentry/types';
import { ChevronDown, ChevronUp, Layers3, Save, Zap } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useTenantServiceManagementCatalog,
  useUpdateTenantServiceSelection,
} from '@/hooks/use-tenant-services';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

const DELIVERY_LABELS: Record<ServiceDeliveryMode, string> = {
  [ServiceDeliveryMode.CBT_MANUAL]: 'Manual',
  [ServiceDeliveryMode.API_AUTOMATED]: 'Automated',
  [ServiceDeliveryMode.PIN_STOCK]: 'PIN stock',
};

const DELIVERY_COLORS: Record<ServiceDeliveryMode, string> = {
  [ServiceDeliveryMode.CBT_MANUAL]: 'bg-amber-50 text-amber-700',
  [ServiceDeliveryMode.API_AUTOMATED]: 'bg-emerald-50 text-emerald-700',
  [ServiceDeliveryMode.PIN_STOCK]: 'bg-blue-50 text-blue-700',
};

export default function TenantServicesPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedSlugs, setExpandedSlugs] = useState<string[]>([]);
  const [draft, setDraft] = useState<{
    usesCustomSelection: boolean;
    selectedServiceSlugs: string[];
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const filters = useMemo(() => ({ search }), [search]);
  const { selection, categories, services, loading, error, reload } =
    useTenantServiceManagementCatalog(filters);
  const updateSelection = useUpdateTenantServiceSelection();

  const usesCustom = draft?.usesCustomSelection ?? selection?.usesCustomSelection ?? false;

  const effectiveSelected = useMemo(() => {
    if (!usesCustom) return new Set(services.map((s) => s.slug));
    const slugs = draft?.selectedServiceSlugs ?? selection?.selectedServiceSlugs ?? [];
    return new Set(slugs);
  }, [draft, selection, services, usesCustom]);

  const groupedServices = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          services: services.filter((s) => s.category.slug === cat.slug),
        }))
        .filter((cat) => cat.services.length > 0),
    [categories, services],
  );

  const hasDraftChanges =
    usesCustom !== (selection?.usesCustomSelection ?? false) ||
    services.some((s) => s.isSelected !== effectiveSelected.has(s.slug));

  const toggleExpand = (slug: string) =>
    setExpandedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const toggleService = (slug: string) => {
    setSuccessMessage('');
    setDraft((prev) => {
      const current = prev?.selectedServiceSlugs ?? selection?.selectedServiceSlugs ?? [];
      return {
        usesCustomSelection: true,
        selectedServiceSlugs: current.includes(slug)
          ? current.filter((s) => s !== slug)
          : [...current, slug],
      };
    });
  };

  const toggleCategory = (slugs: string[], mode: 'on' | 'off') => {
    setSuccessMessage('');
    setDraft((prev) => {
      const current = new Set(prev?.selectedServiceSlugs ?? selection?.selectedServiceSlugs ?? []);
      slugs.forEach((s) => (mode === 'on' ? current.add(s) : current.delete(s)));
      return { usesCustomSelection: true, selectedServiceSlugs: Array.from(current) };
    });
  };

  const handleSave = () => {
    updateSelection.mutate(
      {
        usesCustomSelection: usesCustom,
        selectedServiceSlugs: Array.from(effectiveSelected),
      },
      {
        onSuccess: () => {
          setDraft(null);
          setSuccessMessage('Service selection saved.');
        },
      },
    );
  };

  const totalVisible = selection?.visibleCount ?? services.length;
  const selectedCount = usesCustom ? effectiveSelected.size : totalVisible;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-32 md:p-8 md:pb-32">
      <PageHero
        eyebrow="Services"
        title="Choose what your business offers"
        description="Pick the services your customers will see. Toggle individual services on or off, or use 'All services' to offer everything the platform provides."
      />

      {successMessage ? <FeedbackBanner tone="success" message={successMessage} /> : null}
      {updateSelection.error ? (
        <FeedbackBanner
          tone="error"
          message={getApiErrorMessage(updateSelection.error, 'Could not save right now.')}
        />
      ) : null}

      {/* Mode toggle */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {usesCustom ? 'Custom selection' : 'All services'}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {usesCustom
              ? `${selectedCount} of ${totalVisible} services selected`
              : `All ${totalVisible} platform services are offered`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Custom</span>
          <button
            type="button"
            role="switch"
            aria-checked={usesCustom}
            onClick={() => {
              setSuccessMessage('');
              setDraft((prev) => ({
                usesCustomSelection: !usesCustom,
                selectedServiceSlugs:
                  prev?.selectedServiceSlugs ?? selection?.selectedServiceSlugs ?? [],
              }));
            }}
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
              usesCustom ? 'bg-brand-button' : 'bg-slate-200',
            )}
          >
            <span
              className={cn(
                'h-6 w-6 rounded-full bg-white shadow transition-transform',
                usesCustom ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(searchInput.trim());
            }
          }}
          placeholder="Search services by name…"
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
        />
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSearchInput('');
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSearch(searchInput.trim())}
            className="rounded-2xl bg-brand-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
          >
            Search
          </button>
        )}
      </div>

      {/* Service list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Services unavailable"
          message={error}
          icon={Layers3}
          action={
            <button
              type="button"
              onClick={reload}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Try again
            </button>
          }
        />
      ) : groupedServices.length ? (
        <div className="space-y-2">
          {groupedServices.map((cat) => {
            const isOpen = expandedSlugs.includes(cat.slug);
            const catSlugs = cat.services.map((s) => s.slug);
            const catSelected = catSlugs.filter((s) => effectiveSelected.has(s)).length;
            const allCatSelected = catSelected === cat.services.length;

            return (
              <section key={cat.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {/* Category header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat.slug)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Zap size={16} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{cat.name}</span>
                      <span className="block text-xs text-slate-500">
                        {catSelected} of {cat.services.length} selected
                      </span>
                    </span>
                    <span className="text-slate-400">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {/* Select all / clear category */}
                  {usesCustom ? (
                    <button
                      type="button"
                      onClick={() => toggleCategory(catSlugs, allCatSelected ? 'off' : 'on')}
                      className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      {allCatSelected ? 'Deselect all' : 'Select all'}
                    </button>
                  ) : null}
                </div>

                {/* Services list */}
                {isOpen ? (
                  <div className="border-t border-slate-100">
                    {cat.services.map((service, idx) => {
                      const isOn = effectiveSelected.has(service.slug);
                      return (
                        <div
                          key={service.id}
                          className={cn(
                            'flex items-center gap-4 px-4 py-3',
                            idx < cat.services.length - 1 && 'border-b border-slate-100',
                          )}
                        >
                          {/* Toggle */}
                          {usesCustom ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isOn}
                              onClick={() => toggleService(service.slug)}
                              className={cn(
                                'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
                                isOn ? 'bg-emerald-500' : 'bg-slate-200',
                              )}
                            >
                              <span
                                className={cn(
                                  'h-5 w-5 rounded-full bg-white shadow transition-transform',
                                  isOn ? 'translate-x-4' : 'translate-x-0',
                                )}
                              />
                            </button>
                          ) : (
                            <span className="flex h-6 w-10 shrink-0 items-center justify-center">
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            </span>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                'text-sm font-medium',
                                isOn ? 'text-slate-900' : 'text-slate-400',
                              )}
                            >
                              {service.name}
                            </p>
                            {service.description ? (
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                {service.description}
                              </p>
                            ) : null}
                          </div>

                          {/* Price */}
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatNaira(Number(service.totalPrice))}
                            </p>
                            <span
                              className={cn(
                                'mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                DELIVERY_COLORS[service.deliveryMode],
                              )}
                            >
                              {DELIVERY_LABELS[service.deliveryMode]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No services found"
          message={
            search
              ? `No services matched "${search}". Try a different term.`
              : 'No platform services are available right now.'
          }
          icon={Layers3}
        />
      )}

      {/* Sticky save bar */}
      {hasDraftChanges ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 px-4 py-4 shadow-lg backdrop-blur-sm md:left-64">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              You have unsaved changes.{' '}
              <span className="font-semibold text-slate-900">
                {selectedCount} service{selectedCount === 1 ? '' : 's'} selected.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setSuccessMessage('');
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateSelection.isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:opacity-60"
              >
                <Save size={14} />
                {updateSelection.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
