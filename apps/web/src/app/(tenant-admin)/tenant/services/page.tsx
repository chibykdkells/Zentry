'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ServiceDeliveryMode } from '@zendocx/types';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Layers3,
  Save,
  Search,
  Settings2,
  Sparkles,
  Zap,
} from 'lucide-react';
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
  [ServiceDeliveryMode.CBT_MANUAL]: 'Manual fulfilment',
  [ServiceDeliveryMode.API_AUTOMATED]: 'Automated API',
  [ServiceDeliveryMode.PIN_STOCK]: 'PIN stock',
};

const DELIVERY_STYLES: Record<ServiceDeliveryMode, string> = {
  [ServiceDeliveryMode.CBT_MANUAL]: 'bg-amber-50 text-amber-700',
  [ServiceDeliveryMode.API_AUTOMATED]: 'bg-emerald-50 text-emerald-700',
  [ServiceDeliveryMode.PIN_STOCK]: 'bg-sky-50 text-sky-700',
};

export default function TenantServicesPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | string>('ALL');
  const [draft, setDraft] = useState<{
    usesCustomSelection: boolean;
    selectedServiceSlugs: string[];
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const filters = useMemo(
    () => ({
      search,
      categorySlug: activeCategory === 'ALL' ? undefined : activeCategory,
    }),
    [activeCategory, search],
  );

  const { selection, categories, services, loading, error, reload } =
    useTenantServiceManagementCatalog(filters);
  const updateSelection = useUpdateTenantServiceSelection();

  const usesCustom = draft?.usesCustomSelection ?? selection?.usesCustomSelection ?? false;

  const effectiveSelected = useMemo(() => {
    if (!usesCustom) {
      return new Set(services.map((service) => service.slug));
    }

    const slugs = draft?.selectedServiceSlugs ?? selection?.selectedServiceSlugs ?? [];
    return new Set(slugs);
  }, [draft, selection, services, usesCustom]);

  const hasDraftChanges =
    usesCustom !== (selection?.usesCustomSelection ?? false) ||
    services.some((service) => service.isSelected !== effectiveSelected.has(service.slug));

  const automatedCount = services.filter(
    (service) => service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED,
  ).length;
  const visibleCount = usesCustom
    ? Array.from(effectiveSelected).length
    : selection?.visibleCount ?? services.length;
  const hiddenCount = Math.max(services.length - visibleCount, 0);

  const toggleService = (slug: string) => {
    setSuccessMessage('');
    setDraft((prev) => {
      const current = new Set(
        prev?.selectedServiceSlugs ?? selection?.selectedServiceSlugs ?? [],
      );
      const nextUsesCustom = true;

      if (!usesCustom) {
        services.forEach((service) => current.add(service.slug));
      }

      if (current.has(slug)) {
        current.delete(slug);
      } else {
        current.add(slug);
      }

      return {
        usesCustomSelection: nextUsesCustom,
        selectedServiceSlugs: Array.from(current),
      };
    });
  };

  const handleModeToggle = (enabled: boolean) => {
    setSuccessMessage('');
    setDraft((prev) => ({
      usesCustomSelection: enabled,
      selectedServiceSlugs:
        prev?.selectedServiceSlugs ?? selection?.selectedServiceSlugs ?? [],
    }));
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
          setSuccessMessage('Business services saved.');
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 pb-28 md:space-y-6 md:p-8 md:pb-32">
      <PageHero
        eyebrow="Business services"
        title="Control what this business can sell"
        description="Every service your customers or operators can use is managed here. By default, the business inherits the full platform catalog and the platform API setup. Switch to a custom service mix only when this tenant needs a tighter offering."
        actions={
          <Link
            href="/tenant/providers"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
          >
            Open API integrations
            <ArrowRight size={16} />
          </Link>
        }
      />

      {successMessage ? <FeedbackBanner tone="success" message={successMessage} /> : null}
      {updateSelection.error ? (
        <FeedbackBanner
          tone="error"
          message={getApiErrorMessage(
            updateSelection.error,
            'Could not save business services right now.',
          )}
        />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <SummaryCard
          icon={Sparkles}
          label="Selection mode"
          title={usesCustom ? 'Custom business catalog' : 'Using full platform catalog'}
          description={
            usesCustom
              ? 'This business is now hiding or showing services intentionally.'
              : 'Every platform service is available here until you switch to a custom mix.'
          }
        />
        <SummaryCard
          icon={Layers3}
          label="Visible services"
          title={`${visibleCount} live`}
          description={`${hiddenCount} hidden from this business portal right now.`}
        />
        <SummaryCard
          icon={Zap}
          label="Automated services"
          title={`${automatedCount} API-driven`}
          description="These services inherit the default platform API unless this tenant configures its own connection."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Business catalog controls
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Keep the catalog simple for the team
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                Use the platform catalog when this tenant should offer everything. Turn on
                custom mode only when you want to hide specific services or keep the
                business focused on a smaller offer.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasDraftChanges || updateSelection.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {updateSelection.isPending ? 'Saving…' : 'Save business catalog'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">Search services</span>
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setSearch(searchInput.trim());
                    }
                  }}
                  placeholder="Search by service name"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">Category filter</span>
              <select
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              >
                <option value="ALL">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Custom service selection</p>
              <p className="mt-1 text-sm text-slate-500">
                {usesCustom
                  ? 'This business now has its own visible-service list.'
                  : 'This business is inheriting every service from the platform catalog.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-500">Platform default</span>
              <button
                type="button"
                role="switch"
                aria-checked={usesCustom}
                onClick={() => handleModeToggle(!usesCustom)}
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full p-0.5 transition-colors',
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
              <span className="text-sm font-medium text-slate-900">Custom</span>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy/[0.07] text-brand-navy">
              <Settings2 size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                How service routing works
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                API control stays in one place
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <RouteRule
              title="Default provider"
              description="If a service is automated and this business has no custom endpoint, it uses the platform API connection automatically."
              tone="default"
            />
            <RouteRule
              title="Business override"
              description="If this tenant saves its own API connection, every visible automated service can route through that business-specific endpoint."
              tone="success"
            />
            <RouteRule
              title="Hidden services"
              description="A hidden service disappears from the business portal, but its API setup remains available in API Integrations when you want to bring it back."
              tone="warning"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 md:px-6">
          <div className="grid gap-2 lg:grid-cols-[1.7fr_0.7fr_0.7fr_0.7fr_0.8fr]">
            {['Service', 'Category', 'Delivery', 'Price', 'Status'].map((label) => (
              <p
                key={label}
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
              >
                {label}
              </p>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5 md:p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-5 md:p-6">
            <EmptyState
              title="Business services unavailable"
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
          </div>
        ) : services.length ? (
          <div className="divide-y divide-slate-200">
            {services.map((service) => {
              const isVisible = effectiveSelected.has(service.slug);

              return (
                <article
                  key={service.id}
                  className="px-5 py-4 transition hover:bg-slate-50/70 md:px-6"
                >
                  <div className="grid gap-4 lg:grid-cols-[1.7fr_0.7fr_0.7fr_0.7fr_0.8fr] lg:items-center">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{service.name}</h3>
                        {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            API-linked
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm leading-6 text-slate-500">
                        {service.description ?? 'No service description added yet.'}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>{service.requiredFieldsCount} form fields</span>
                        <span>{service.requiredDocumentsCount} document uploads</span>
                        <span>{service.eta}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {service.category.name}
                      </p>
                    </div>

                    <div>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                          DELIVERY_STYLES[service.deliveryMode],
                        )}
                      >
                        {DELIVERY_LABELS[service.deliveryMode]}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatNaira(service.totalPrice)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Customer-facing starting price
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          isVisible
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {isVisible ? 'Visible in business' : 'Hidden from business'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleService(service.slug)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition',
                          isVisible
                            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                        )}
                      >
                        {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                        {isVisible ? 'Hide service' : 'Add service'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5 md:p-6">
            <EmptyState
              title="No services match this filter"
              message="Try a different search term or switch back to all categories."
              icon={Search}
            />
          </div>
        )}
      </section>

      {hasDraftChanges ? (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="flex w-full max-w-3xl flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Unsaved business catalog changes
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Save now to update what this tenant can sell and what stays hidden.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateSelection.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {updateSelection.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  title,
  description,
}: {
  icon: React.ElementType;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy/[0.07] text-brand-navy">
        <Icon size={18} />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <h2 className="mt-2 text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  );
}

function RouteRule({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: 'default' | 'success' | 'warning';
}) {
  return (
    <div
      className={cn(
        'rounded-[1.35rem] border p-4',
        tone === 'default' && 'border-slate-200 bg-slate-50/70',
        tone === 'success' && 'border-emerald-200 bg-emerald-50/70',
        tone === 'warning' && 'border-amber-200 bg-amber-50/70',
      )}
    >
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
