'use client';

import { useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ServiceDeliveryMode } from '@zendocx/types';
import {
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  Plus,
  Save,
  Search,
  Settings2,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  type TenantManageableServiceItem,
  useTenantServiceManagementCatalog,
  useUpdateTenantService,
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
  const [configuringService, setConfiguringService] =
    useState<TenantManageableServiceItem | null>(null);

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
  const updateTenantService = useUpdateTenantService();

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

      <div>
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
      </div>

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
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setConfiguringService(service)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-brand-navy/20 bg-brand-navy/5 px-3.5 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-navy/10"
                        >
                          <Settings2 size={15} />
                          Configure
                        </button>
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
                          {isVisible ? 'Hide' : 'Show'}
                        </button>
                      </div>
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

      {configuringService ? (
        <ServiceConfigModal
          service={configuringService}
          isPending={updateTenantService.isPending}
          onClose={() => setConfiguringService(null)}
          onSave={(serviceId, payload) => {
            updateTenantService.mutate(
              { serviceId, payload },
              {
                onSuccess: () => {
                  toast.success('Service configuration saved.');
                  setConfiguringService(null);
                },
                onError: (err: unknown) => {
                  toast.error(getApiErrorMessage(err, 'Could not save configuration.'));
                },
              },
            );
          }}
        />
      ) : null}

      {hasDraftChanges ? (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-4">
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

interface ServiceConfigFormValues {
  description: string;
  totalPriceNaira: number;
  cbtCommissionNaira: number;
  tenantCommissionNaira: number;
  requiredFields: ServiceFieldFormValue[];
  requiredDocuments: ServiceDocumentFormValue[];
}

interface ServiceFieldFormValue {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'select';
  required: boolean;
  placeholder: string;
  helpText: string;
  optionsText: string;
}

interface ServiceDocumentFormValue {
  name: string;
  label: string;
  required: boolean;
  description: string;
  acceptedTypesText: string;
}

function ServiceConfigModal({
  service,
  isPending,
  onClose,
  onSave,
}: {
  service: TenantManageableServiceItem;
  isPending: boolean;
  onClose: () => void;
  onSave: (serviceId: string, payload: {
    description?: string;
    totalPriceNaira?: number;
    cbtCommissionNaira?: number;
    tenantCommissionNaira?: number;
    requiredFields?: Record<string, unknown>[];
    requiredDocuments?: Record<string, unknown>[];
  }) => void;
}) {
  const form = useForm<ServiceConfigFormValues>({
    defaultValues: {
      description: service.description ?? '',
      totalPriceNaira: Number(service.totalPrice) / 100,
      cbtCommissionNaira: Number(service.cbtCommission) / 100,
      tenantCommissionNaira: Number((service as TenantManageableServiceItem).tenantCommission) / 100,
      requiredFields: (service.requiredFields ?? []).map(mapFieldToFormValue),
      requiredDocuments: (service.requiredDocuments ?? []).map(mapDocumentToFormValue),
    },
  });

  const fieldsArray = useFieldArray({ control: form.control, name: 'requiredFields' });
  const docsArray = useFieldArray({ control: form.control, name: 'requiredDocuments' });
  const fieldValues = useWatch({ control: form.control, name: 'requiredFields' });

  const handleSubmit = form.handleSubmit((values) => {
    onSave(service.id, {
      description: values.description.trim() || undefined,
      totalPriceNaira: Number(values.totalPriceNaira),
      cbtCommissionNaira: Number(values.cbtCommissionNaira),
      tenantCommissionNaira: Number(values.tenantCommissionNaira),
      requiredFields: serializeFieldDefinitions(values.requiredFields),
      requiredDocuments: serializeDocumentDefinitions(values.requiredDocuments),
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Configure service
            </p>
            <h2 className="text-lg font-bold text-slate-900">{service.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="service-config-form" onSubmit={handleSubmit} className="space-y-4">

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Platform fee: <strong>{service.platformFeePercent}%</strong> of your commission is retained by the platform.
            </div>

            <ConfigField label="Description">
              <textarea
                rows={3}
                className={configInputClass}
                placeholder="Describe this service for your customers…"
                {...form.register('description')}
              />
            </ConfigField>

            <div className="grid gap-4 sm:grid-cols-3">
              <ConfigField label="Total price (₦)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={configInputClass}
                  {...form.register('totalPriceNaira', { valueAsNumber: true })}
                />
              </ConfigField>
              <ConfigField label="CBT Task Fee (₦)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={configInputClass}
                  {...form.register('cbtCommissionNaira', { valueAsNumber: true })}
                />
              </ConfigField>
              <ConfigField label="Your commission (₦)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={configInputClass}
                  {...form.register('tenantCommissionNaira', { valueAsNumber: true })}
                />
              </ConfigField>
            </div>

            {/* Required fields */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Required fields</h3>
                <button
                  type="button"
                  onClick={() => fieldsArray.append(createEmptyField())}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <Plus size={12} /> Add field
                </button>
              </div>
              {fieldsArray.fields.length ? (
                <div className="space-y-3">
                  {fieldsArray.fields.map((field, idx) => {
                    const currentType = fieldValues?.[idx]?.type ?? 'text';
                    return (
                      <div key={field.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">Field {idx + 1}</p>
                          <button
                            type="button"
                            onClick={() => fieldsArray.remove(idx)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ConfigField label="Field key">
                            <input className={configInputClass} placeholder="fullName" {...form.register(`requiredFields.${idx}.name`)} />
                          </ConfigField>
                          <ConfigField label="Label">
                            <input className={configInputClass} placeholder="Full name" {...form.register(`requiredFields.${idx}.label`)} />
                          </ConfigField>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ConfigField label="Input type">
                            <select className={configInputClass} {...form.register(`requiredFields.${idx}.type`)}>
                              <option value="text">Text</option>
                              <option value="textarea">Textarea</option>
                              <option value="number">Number</option>
                              <option value="email">Email</option>
                              <option value="tel">Phone</option>
                              <option value="select">Select</option>
                            </select>
                          </ConfigField>
                          <label className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                            <input type="checkbox" {...form.register(`requiredFields.${idx}.required`)} /> Required
                          </label>
                        </div>
                        <ConfigField label="Placeholder">
                          <input className={configInputClass} {...form.register(`requiredFields.${idx}.placeholder`)} />
                        </ConfigField>
                        <ConfigField label="Help text">
                          <input className={configInputClass} {...form.register(`requiredFields.${idx}.helpText`)} />
                        </ConfigField>
                        {currentType === 'select' ? (
                          <ConfigField label="Options (one per line)">
                            <textarea rows={3} className={configInputClass} {...form.register(`requiredFields.${idx}.optionsText`)} />
                          </ConfigField>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-400">
                  No custom fields yet. Add one if this service needs requester input.
                </p>
              )}
            </div>

            {/* Required documents */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Required documents</h3>
                <button
                  type="button"
                  onClick={() => docsArray.append(createEmptyDocument())}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <Plus size={12} /> Add document
                </button>
              </div>
              {docsArray.fields.length ? (
                <div className="space-y-3">
                  {docsArray.fields.map((doc, idx) => (
                    <div key={doc.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500">Document {idx + 1}</p>
                        <button
                          type="button"
                          onClick={() => docsArray.remove(idx)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ConfigField label="Key">
                          <input className={configInputClass} placeholder="passportPhoto" {...form.register(`requiredDocuments.${idx}.name`)} />
                        </ConfigField>
                        <ConfigField label="Label">
                          <input className={configInputClass} placeholder="Passport photograph" {...form.register(`requiredDocuments.${idx}.label`)} />
                        </ConfigField>
                      </div>
                      <ConfigField label="Description">
                        <input className={configInputClass} {...form.register(`requiredDocuments.${idx}.description`)} />
                      </ConfigField>
                      <ConfigField label="Accepted file types">
                        <input className={configInputClass} placeholder="image/jpeg, image/png, application/pdf" {...form.register(`requiredDocuments.${idx}.acceptedTypesText`)} />
                      </ConfigField>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                        <input type="checkbox" {...form.register(`requiredDocuments.${idx}.required`)} /> Required upload
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-400">
                  No document requirements yet.
                </p>
              )}
            </div>

          </form>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="submit"
            form="service-config-form"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isPending ? 'Saving…' : 'Save configuration'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const configInputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10';

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function createEmptyField(): ServiceFieldFormValue {
  return { name: '', label: '', type: 'text', required: true, placeholder: '', helpText: '', optionsText: '' };
}

function createEmptyDocument(): ServiceDocumentFormValue {
  return { name: '', label: '', required: true, description: '', acceptedTypesText: '' };
}

function mapFieldToFormValue(field: {
  name: string; label?: string; type?: string; required?: boolean;
  placeholder?: string; helpText?: string; options?: string[];
}): ServiceFieldFormValue {
  return {
    name: field.name,
    label: field.label ?? '',
    type: (field.type as ServiceFieldFormValue['type']) ?? 'text',
    required: field.required === true,
    placeholder: field.placeholder ?? '',
    helpText: field.helpText ?? '',
    optionsText: (field.options ?? []).join('\n'),
  };
}

function mapDocumentToFormValue(doc: {
  name: string; label?: string; required?: boolean; acceptedTypes?: string[]; description?: string;
}): ServiceDocumentFormValue {
  return {
    name: doc.name,
    label: doc.label ?? '',
    required: doc.required !== false,
    description: doc.description ?? '',
    acceptedTypesText: (doc.acceptedTypes ?? []).join(', '),
  };
}

function serializeFieldDefinitions(fields: ServiceFieldFormValue[]) {
  return fields.map((field, index) => {
    const name = field.name.trim();
    if (!name) throw new Error(`Field ${index + 1} needs a field key.`);
    const options = field.optionsText.split('\n').map((o) => o.trim()).filter(Boolean);
    if (field.type === 'select' && options.length === 0) {
      throw new Error(`Field ${index + 1} needs at least one select option.`);
    }
    return {
      name,
      label: field.label.trim() || undefined,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder.trim() || undefined,
      helpText: field.helpText.trim() || undefined,
      options: field.type === 'select' ? options : undefined,
    };
  });
}

function serializeDocumentDefinitions(docs: ServiceDocumentFormValue[]) {
  return docs.map((doc, index) => {
    const name = doc.name.trim();
    if (!name) throw new Error(`Document ${index + 1} needs a document key.`);
    return {
      name,
      label: doc.label.trim() || undefined,
      required: doc.required,
      description: doc.description.trim() || undefined,
      acceptedTypes: doc.acceptedTypesText.split(',').map((v) => v.trim()).filter(Boolean),
    };
  });
}
