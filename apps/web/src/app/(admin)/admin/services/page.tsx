'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  History,
  Layers3,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ServiceDeliveryMode } from '@zentry/types';
import { AccountPanel } from '@/components/shared/account-panel';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import {
  ADMIN_PROVIDER_READINESS_QUERY_KEY,
  ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
  type AdminServiceCategory,
  type AdminServiceFilters,
  type AdminServiceItem,
  useAdminProviderReadiness,
  useAdminServiceCategories,
  useAdminServices,
} from '@/hooks/use-admin-services';
import { getApiErrorMessage } from '@/lib/api-error';
import { adminServicesSections } from '@/lib/admin-content';
import { formatNaira } from '@/lib/format';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface CategoryFormValues {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

interface ServiceFormValues {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  deliveryMode: ServiceDeliveryMode;
  platformFeeNaira: number;
  totalPriceNaira: number;
  cbtCommissionNaira: number;
  providerCostNaira: number;
  providerKey: string;
  providerServiceCode: string;
  sortOrder: number;
  isActive: boolean;
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

interface VtuProviderFormValues {
  isEnabled: boolean;
  rolloutMode: 'AUTO' | 'MOCK' | 'LIVE';
  baseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
  apiKeyHeader: string;
  apiKeyPrefix: string;
  notes: string;
}

const DEFAULT_CATEGORY_VALUES: CategoryFormValues = {
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
  isActive: true,
};

const DEFAULT_SERVICE_VALUES: ServiceFormValues = {
  categoryId: '',
  name: '',
  slug: '',
  description: '',
  deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
  platformFeeNaira: 0,
  totalPriceNaira: 0,
  cbtCommissionNaira: 0,
  providerCostNaira: 0,
  providerKey: '',
  providerServiceCode: '',
  sortOrder: 0,
  isActive: true,
  requiredFields: [],
  requiredDocuments: [],
};

const DEFAULT_VTU_PROVIDER_VALUES: VtuProviderFormValues = {
  isEnabled: true,
  rolloutMode: 'AUTO',
  baseUrl: '',
  apiKey: '',
  clearApiKey: false,
  apiKeyHeader: 'Authorization',
  apiKeyPrefix: 'Bearer ',
  notes: '',
};

export default function AdminServicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState<string>('ALL');
  const [deliveryMode, setDeliveryMode] = useState<
    ServiceDeliveryMode | 'ALL'
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>(
    'ALL',
  );
  const [page, setPage] = useState(1);
  const [editingCategory, setEditingCategory] =
    useState<AdminServiceCategory | null>(null);
  const [editingService, setEditingService] = useState<AdminServiceItem | null>(
    null,
  );

  const filters = useMemo<AdminServiceFilters>(
    () => ({
      search,
      categorySlug: categorySlug === 'ALL' ? undefined : categorySlug,
      deliveryMode: deliveryMode === 'ALL' ? undefined : deliveryMode,
      isActive:
        statusFilter === 'ALL'
          ? undefined
          : statusFilter === 'ACTIVE'
            ? true
            : false,
      page,
      limit: 10,
    }),
    [categorySlug, deliveryMode, page, search, statusFilter],
  );

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useAdminServiceCategories();
  const {
    overview,
    services,
    pagination,
    loading,
    error,
  } = useAdminServices(filters);
  const {
    readiness,
    loading: readinessLoading,
    error: readinessError,
    reload: reloadReadiness,
  } = useAdminProviderReadiness();

  const categoryForm = useForm<CategoryFormValues>({
    defaultValues: DEFAULT_CATEGORY_VALUES,
  });
  const serviceForm = useForm<ServiceFormValues>({
    defaultValues: DEFAULT_SERVICE_VALUES,
  });
  const requiredFieldsArray = useFieldArray({
    control: serviceForm.control,
    name: 'requiredFields',
  });
  const requiredDocumentsArray = useFieldArray({
    control: serviceForm.control,
    name: 'requiredDocuments',
  });
  const providerForm = useForm<VtuProviderFormValues>({
    defaultValues: DEFAULT_VTU_PROVIDER_VALUES,
  });
  const requiredFieldValues = useWatch({
    control: serviceForm.control,
    name: 'requiredFields',
  });
  const providerRolloutMode = useWatch({
    control: providerForm.control,
    name: 'rolloutMode',
  });
  const providerDraftApiKey = useWatch({
    control: providerForm.control,
    name: 'apiKey',
  });
  const providerClearApiKey = useWatch({
    control: providerForm.control,
    name: 'clearApiKey',
  });

  useEffect(() => {
    if (!editingCategory) {
      categoryForm.reset(DEFAULT_CATEGORY_VALUES);
      return;
    }

    categoryForm.reset({
      name: editingCategory.name,
      slug: editingCategory.slug,
      description: editingCategory.description ?? '',
      sortOrder: editingCategory.sortOrder,
      isActive: editingCategory.isActive,
    });
  }, [categoryForm, editingCategory]);

  useEffect(() => {
    if (!editingService) {
      serviceForm.reset({
        ...DEFAULT_SERVICE_VALUES,
        categoryId: categories[0]?.id ?? '',
      });
      return;
    }

    serviceForm.reset({
      categoryId: editingService.category.id,
      name: editingService.name,
      slug: editingService.slug,
      description: editingService.description ?? '',
      deliveryMode: editingService.deliveryMode,
      platformFeeNaira: koboToNairaNumber(editingService.platformFee),
      totalPriceNaira: koboToNairaNumber(editingService.totalPrice),
      cbtCommissionNaira: koboToNairaNumber(editingService.cbtCommission),
      providerCostNaira: koboToNairaNumber(editingService.providerCost),
      providerKey: editingService.providerKey ?? '',
      providerServiceCode: editingService.providerServiceCode ?? '',
      sortOrder: editingService.sortOrder,
      isActive: editingService.isActive,
      requiredFields: editingService.requiredFields.map(mapFieldToFormValue),
      requiredDocuments: editingService.requiredDocuments.map(
        mapDocumentToFormValue,
      ),
    });
  }, [categories, editingService, serviceForm]);

  useEffect(() => {
    if (!readiness?.savedConfig) {
      providerForm.reset(DEFAULT_VTU_PROVIDER_VALUES);
      return;
    }

    providerForm.reset({
      isEnabled: readiness.savedConfig.isEnabled,
      rolloutMode: readiness.savedConfig.rolloutMode,
      baseUrl: readiness.savedConfig.baseUrl ?? '',
      apiKey: '',
      clearApiKey: false,
      apiKeyHeader: readiness.savedConfig.apiKeyHeader ?? 'Authorization',
      apiKeyPrefix: readiness.savedConfig.apiKeyPrefix ?? 'Bearer ',
      notes: readiness.savedConfig.notes ?? '',
    });
  }, [providerForm, readiness]);

  const invalidateServiceQueries = async () => {
    await queryClient.invalidateQueries({
      queryKey: ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
    });
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === 'admin' &&
        query.queryKey[1] === 'services',
    });
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === 'services' &&
        query.queryKey[1] === 'catalog',
    });
  };

  const categoryMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim() || undefined,
        sortOrder: Number(values.sortOrder),
        isActive: values.isActive,
      };

      if (editingCategory) {
        const response = await apiClient.patch<{
          message: string;
          data: AdminServiceCategory;
        }>(`/services/admin/categories/${editingCategory.id}`, payload);
        return response.data;
      }

      const response = await apiClient.post<{
        message: string;
        data: AdminServiceCategory;
      }>('/services/admin/categories', payload);
      return response.data;
    },
    onSuccess: async (response) => {
      await invalidateServiceQueries();
      toast.success(response.message);
      setEditingCategory(null);
      categoryForm.reset(DEFAULT_CATEGORY_VALUES);
    },
    onError: (mutationError: unknown) => {
      toast.error(
        getApiErrorMessage(
          mutationError,
          'Could not save the service category right now.',
        ),
      );
    },
  });

  const serviceMutation = useMutation({
    mutationFn: async (values: ServiceFormValues) => {
      const payload = {
        categoryId: values.categoryId,
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim() || undefined,
        deliveryMode: values.deliveryMode,
        platformFeeNaira: Number(values.platformFeeNaira),
        totalPriceNaira: Number(values.totalPriceNaira),
        cbtCommissionNaira: Number(values.cbtCommissionNaira),
        providerCostNaira: Number(values.providerCostNaira),
        providerKey: values.providerKey.trim() || undefined,
        providerServiceCode: values.providerServiceCode.trim() || undefined,
        sortOrder: Number(values.sortOrder),
        isActive: values.isActive,
        requiredFields: serializeFieldDefinitions(values.requiredFields),
        requiredDocuments: serializeDocumentDefinitions(
          values.requiredDocuments,
        ),
      };

      if (editingService) {
        const response = await apiClient.patch<{
          message: string;
          data: AdminServiceItem;
        }>(`/services/admin/services/${editingService.id}`, payload);
        return response.data;
      }

      const response = await apiClient.post<{
        message: string;
        data: AdminServiceItem;
      }>('/services/admin/services', payload);
      return response.data;
    },
    onSuccess: async (response) => {
      await invalidateServiceQueries();
      toast.success(response.message);
      setEditingService(response.data);
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error && mutationError.message
          ? mutationError.message
          : getApiErrorMessage(
              mutationError,
              'Could not save the service right now.',
            );

      toast.error(message);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await apiClient.delete<{
        message: string;
        data: { id: string };
      }>(`/services/admin/categories/${categoryId}`);

      return response.data;
    },
    onSuccess: async (response) => {
      await invalidateServiceQueries();
      toast.success(response.message);
      setEditingCategory(null);
      setCategorySlug('ALL');
      categoryForm.reset(DEFAULT_CATEGORY_VALUES);
    },
    onError: (mutationError: unknown) => {
      toast.error(
        getApiErrorMessage(
          mutationError,
          'Could not delete the category right now.',
        ),
      );
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await apiClient.delete<{
        message: string;
        data: { id: string };
      }>(`/services/admin/services/${serviceId}`);

      return response.data;
    },
    onSuccess: async (response) => {
      await invalidateServiceQueries();
      toast.success(response.message);
      setEditingService(null);
      serviceForm.reset({
        ...DEFAULT_SERVICE_VALUES,
        categoryId: categories[0]?.id ?? '',
      });
    },
    onError: (mutationError: unknown) => {
      toast.error(
        getApiErrorMessage(
          mutationError,
          'Could not delete the service right now.',
        ),
      );
    },
  });

  const providerMutation = useMutation({
    mutationFn: async (values: VtuProviderFormValues) => {
      const payload = {
        isEnabled: values.isEnabled,
        rolloutMode: values.rolloutMode,
        baseUrl: values.baseUrl.trim() || undefined,
        apiKey: values.apiKey.trim() || undefined,
        clearApiKey: values.clearApiKey,
        apiKeyHeader: values.apiKeyHeader.trim() || undefined,
        apiKeyPrefix: values.apiKeyPrefix,
        notes: values.notes.trim() || undefined,
      };

      const response = await apiClient.patch<{
        message: string;
        data: unknown;
      }>('/services/admin/provider-readiness/vtu', payload);

      return response.data;
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: ADMIN_PROVIDER_READINESS_QUERY_KEY,
      });
      toast.success(response.message);
      providerForm.setValue('apiKey', '');
      providerForm.setValue('clearApiKey', false);
    },
    onError: (mutationError: unknown) => {
      toast.error(
        getApiErrorMessage(
          mutationError,
          'Could not save VTU provider settings right now.',
        ),
      );
    },
  });

  const providerValidationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{
        data: unknown;
        message: string;
      }>('/services/admin/provider-readiness/vtu/validate');

      return response.data;
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: ADMIN_PROVIDER_READINESS_QUERY_KEY,
      });
      toast.success(response.message);
    },
    onError: (mutationError) => {
      toast.error(
        getApiErrorMessage(
          mutationError,
          'Could not validate the current VTU provider settings right now.',
        ),
      );
    },
  });

  const handleDeleteCategory = () => {
    if (!editingCategory) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${editingCategory.name}? This only works when the category no longer has services.`,
    );

    if (!confirmed) {
      return;
    }

    deleteCategoryMutation.mutate(editingCategory.id);
  };

  const handleDeleteService = () => {
    if (!editingService) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${editingService.name}? This only works when the service has no order history.`,
    );

    if (!confirmed) {
      return;
    }

    deleteServiceMutation.mutate(editingService.id);
  };

  const liveRolloutNeedsValidation =
    providerRolloutMode === 'LIVE' &&
    (Boolean(providerDraftApiKey?.trim()) ||
      providerClearApiKey ||
      readiness?.savedConfig?.lastValidationStatus !== 'healthy');

  const serviceMetrics = [
    {
      title: 'Services',
      value: String(overview?.totalServices ?? 0),
      variant: 'navy' as const,
      icon: Layers3,
    },
    {
      title: 'Active',
      value: String(overview?.activeServices ?? 0),
      variant: 'teal' as const,
      icon: Settings2,
    },
    {
      title: 'Categories',
      value: String(overview?.categories ?? categories.length),
      variant: 'amber' as const,
      icon: Plus,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Admin Services
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Manage the live service catalog from one workspace
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              This slice gives super admins live category and service control
              without pulling Phase 4 fulfillment logic into the catalog layer.
            </p>
          </div>

          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Open admin orders
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {serviceMetrics.map((metric) => (
          <StatCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            variant={metric.variant}
          />
        ))}
      </div>

      <AccountPanel
        title="Provider readiness"
        description="Monitor whether the VTU layer is configured for live transport, still running in mock mode, and how cached VTU lookups are behaving."
      >
        {readinessError ? (
          <EmptyState
            title="Provider readiness unavailable"
            message={readinessError}
            icon={Activity}
          />
        ) : readinessLoading || !readiness ? (
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Loading provider readiness...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    {readiness.vtu.providerName}
                  </h2>
                  <Badge tone="navy">{readiness.scope.label}</Badge>
                  <Badge
                    tone={
                      readiness.vtu.mode === 'live'
                        ? readiness.vtu.probe.status === 'healthy'
                          ? 'success'
                          : 'amber'
                        : 'muted'
                    }
                  >
                    {readiness.vtu.mode === 'live' ? 'Live mode' : 'Mock mode'}
                  </Badge>
                  <Badge
                    tone={
                      readiness.vtu.probe.status === 'healthy'
                        ? 'success'
                        : readiness.vtu.probe.status === 'not_applicable'
                          ? 'muted'
                          : 'amber'
                    }
                  >
                    {readiness.vtu.probe.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-500">
                  {readiness.vtu.probe.message}
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  Scope key: {readiness.scope.key}
                  {readiness.scope.tenantReady ? ' · tenant-ready shape' : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={reloadReadiness}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Refresh readiness
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <MetricPill
                label="Plan cache TTL"
                value={`${readiness.cache.planTtlSeconds}s`}
              />
              <MetricPill
                label="Verify cache TTL"
                value={`${readiness.cache.verificationTtlSeconds}s`}
              />
              <MetricPill
                label="Automated services"
                value={String(readiness.automatedServices.length)}
              />
              <MetricPill
                label="Last probe"
                value={new Date(readiness.vtu.probe.checkedAt).toLocaleTimeString()}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Rollout controls
                  </p>
                  {liveRolloutNeedsValidation ? (
                    <div className="mt-3 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Live cutover should be revalidated.</p>
                        <p className="mt-1 leading-6 text-amber-800">
                          You have selected live rollout with either fresh credential
                          changes or no recent healthy validation. Save if needed, then
                          run validation before relying on the live branch.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <form
                    onSubmit={providerForm.handleSubmit((values) =>
                      providerMutation.mutate(values),
                    )}
                    className="mt-3 space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                        <input type="checkbox" {...providerForm.register('isEnabled')} />
                        Provider enabled
                      </label>
                      <Field label="Rollout mode">
                        <select
                          className={inputClass(false)}
                          {...providerForm.register('rolloutMode')}
                        >
                          <option value="AUTO">Auto</option>
                          <option value="MOCK">Force mock</option>
                          <option value="LIVE">Force live</option>
                        </select>
                      </Field>
                    </div>

                    <Field label="Base URL">
                      <input
                        className={inputClass(false)}
                        placeholder="https://provider.example.com"
                        {...providerForm.register('baseUrl')}
                      />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="API key header">
                        <input
                          className={inputClass(false)}
                          {...providerForm.register('apiKeyHeader')}
                        />
                      </Field>
                      <Field label="API key prefix">
                        <input
                          className={inputClass(false)}
                          placeholder="Bearer "
                          {...providerForm.register('apiKeyPrefix')}
                        />
                      </Field>
                    </div>

                    <Field label="New API key">
                      <input
                        type="password"
                        className={inputClass(false)}
                        placeholder={
                          readiness.savedConfig?.apiKeyConfigured
                            ? 'Leave blank to keep the saved key'
                            : 'Paste the live VTU API key'
                        }
                        {...providerForm.register('apiKey')}
                      />
                    </Field>
                    <p className="text-xs leading-5 text-slate-500">
                      Saving a new key or clearing the existing one resets the last
                      validation status until you run a fresh validation check.
                    </p>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                      <input type="checkbox" {...providerForm.register('clearApiKey')} />
                      Clear saved API key
                    </label>

                    <Field label="Ops notes">
                      <textarea
                        rows={3}
                        className={inputClass(false)}
                        placeholder="Notes for rollout, cutover timing, or provider account context"
                        {...providerForm.register('notes')}
                      />
                    </Field>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                          Saved key:{' '}
                          <span className="font-semibold text-slate-900">
                            {readiness.savedConfig?.apiKeyConfigured
                              ? `••••${readiness.savedConfig.apiKeyLast4 ?? ''}`
                              : 'Not configured'}
                          </span>
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => providerValidationMutation.mutate()}
                            disabled={providerValidationMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {providerValidationMutation.isPending ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <ShieldCheck size={16} />
                            )}
                            Validate config
                          </button>
                          <button
                            type="submit"
                            disabled={providerMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {providerMutation.isPending ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}
                            Save provider settings
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <MetricPill
                          label="Last validation"
                          value={
                            readiness.savedConfig?.lastValidatedAt
                              ? new Date(
                                  readiness.savedConfig.lastValidatedAt,
                                ).toLocaleString()
                              : 'Never'
                          }
                        />
                        <MetricPill
                          label="Validation status"
                          value={
                            readiness.savedConfig?.lastValidationStatus
                              ? readiness.savedConfig.lastValidationStatus.replace(
                                  /_/g,
                                  ' ',
                                )
                              : 'Not run'
                          }
                        />
                        <MetricPill
                          label="Credential state"
                          value={
                            readiness.savedConfig?.apiKeyConfigured
                              ? 'Saved'
                              : 'Missing'
                          }
                        />
                      </div>
                      {readiness.savedConfig?.lastValidationMessage ? (
                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          {readiness.savedConfig.lastValidationMessage}
                        </p>
                      ) : null}
                    </div>
                  </form>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Readiness controls
                  </p>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="font-semibold text-slate-900">
                      Transport support:
                    </span>{' '}
                    {readiness.vtu.supportsLiveTransport
                      ? 'Live HTTP transport is wired.'
                      : 'Mock-only transport.'}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="font-semibold text-slate-900">
                      Missing config:
                    </span>{' '}
                    {readiness.vtu.missingConfig.length
                      ? readiness.vtu.missingConfig.join(', ')
                      : 'None'}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="font-semibold text-slate-900">
                      Health endpoint:
                    </span>{' '}
                    {readiness.vtu.endpoints.health ?? 'Not configured'}
                  </div>
                </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-slate-400" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Validation history
                    </p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {readiness.validationHistory.length ? (
                      readiness.validationHistory.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              tone={
                                item.probeStatus === 'healthy'
                                  ? 'success'
                                  : item.probeStatus === 'not_applicable'
                                    ? 'muted'
                                    : 'amber'
                              }
                            >
                              {item.probeStatus.replace(/_/g, ' ')}
                            </Badge>
                            <Badge tone="navy">{item.rolloutMode}</Badge>
                            <span className="text-xs text-slate-400">
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            {item.probeMessage}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Effective mode: {item.effectiveMode} · Base URL:{' '}
                            {item.endpointBaseUrl ?? 'Not saved'}
                          </p>
                          {item.missingConfig.length ? (
                            <p className="mt-1 text-xs text-amber-700">
                              Missing config: {item.missingConfig.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        No validation runs yet. Save provider settings, then run
                        validation to create the first operational history entry.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Automated VTU coverage
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {readiness.automatedServices.map((service) => (
                      <div
                        key={service.id}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {service.name}
                          </p>
                          <Badge tone="navy">
                            {service.providerKey ?? 'No provider'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {service.category.name} · {service.slug}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AccountPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <AccountPanel
            title="Catalog controls"
            description="Filter live services, review their current pricing, and jump straight into edits."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search services"
                className={inputClass(false)}
              />

              <select
                value={categorySlug}
                onChange={(event) => {
                  setCategorySlug(event.target.value);
                  setPage(1);
                }}
                className={inputClass(false)}
              >
                <option value="ALL">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={deliveryMode}
                onChange={(event) => {
                  setDeliveryMode(
                    event.target.value === 'ALL'
                      ? 'ALL'
                      : (event.target.value as ServiceDeliveryMode),
                  );
                  setPage(1);
                }}
                className={inputClass(false)}
              >
                <option value="ALL">All delivery modes</option>
                <option value={ServiceDeliveryMode.CBT_MANUAL}>CBT manual</option>
                <option value={ServiceDeliveryMode.API_AUTOMATED}>API automated</option>
                <option value={ServiceDeliveryMode.PIN_STOCK}>PIN stock</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(
                    event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE',
                  );
                  setPage(1);
                }}
                className={inputClass(false)}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active only</option>
                <option value="INACTIVE">Inactive only</option>
              </select>
            </div>

            {error ? (
              <div className="mt-4 rounded-[1.5rem] border border-slate-100 bg-slate-50">
                <EmptyState title="Services unavailable" message={error} icon={Layers3} />
              </div>
            ) : loading ? (
              <div className="mt-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Loading live services...
              </div>
            ) : services.length ? (
              <div className="mt-4 space-y-3">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setEditingService(service)}
                    className={cn(
                      'w-full rounded-[1.5rem] border p-4 text-left transition',
                      editingService?.id === service.id
                        ? 'border-[#0D1B3E] bg-[#0D1B3E]/[0.04]'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white',
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-900">
                            {service.name}
                          </h2>
                          <Badge tone={service.isActive ? 'success' : 'muted'}>
                            {service.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge
                            tone={
                              service.deliveryMode ===
                              ServiceDeliveryMode.API_AUTOMATED
                                ? 'navy'
                                : service.deliveryMode ===
                                    ServiceDeliveryMode.PIN_STOCK
                                  ? 'amber'
                                  : 'muted'
                            }
                          >
                            {service.deliveryMode}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {service.slug} · {service.category.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {service.description || 'No description added yet.'}
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <MetricPill
                          label="Total price"
                          value={formatNaira(service.totalPrice)}
                        />
                        <MetricPill
                          label="Platform fee"
                          value={formatNaira(service.platformFee)}
                        />
                        <MetricPill
                          label="Fields"
                          value={String(service.requiredFields.length)}
                        />
                        <MetricPill
                          label="Documents"
                          value={String(service.requiredDocuments.length)}
                        />
                      </div>
                    </div>
                  </button>
                ))}

                {pagination && pagination.totalPages > 1 ? (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-slate-500">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={pagination.page <= 1}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((current) =>
                            Math.min(pagination.totalPages, current + 1),
                          )
                        }
                        disabled={pagination.page >= pagination.totalPages}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.5rem] border border-slate-100 bg-slate-50">
                <EmptyState
                  title="No services match these filters"
                  message="Adjust the current filters or create a new service from the editor."
                  icon={Layers3}
                />
              </div>
            )}
          </AccountPanel>

          <AccountPanel
            title="Workspace notes"
            description="This admin page is intentionally focused on catalog control, not later fulfillment or dispute processes."
          >
            <div className="space-y-4">
              {adminServicesSections.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0D1B3E] shadow-sm">
                    <item.icon size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AccountPanel>
        </div>

        <div className="space-y-6">
          <AccountPanel
            title={editingCategory ? 'Edit category' : 'Create category'}
            description="Keep category structure clean so the public catalog stays searchable and well grouped."
          >
            <form
              onSubmit={categoryForm.handleSubmit((values) =>
                categoryMutation.mutate(values),
              )}
              className="space-y-4"
            >
              <Field label="Name">
                <input className={inputClass(false)} {...categoryForm.register('name')} />
              </Field>
              <Field label="Slug">
                <input className={inputClass(false)} {...categoryForm.register('slug')} />
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  className={inputClass(false)}
                  {...categoryForm.register('description')}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sort order">
                  <input
                    type="number"
                    className={inputClass(false)}
                    {...categoryForm.register('sortOrder', { valueAsNumber: true })}
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" {...categoryForm.register('isActive')} />
                  Category is active
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={categoryMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {categoryMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingCategory ? 'Update category' : 'Create category'}
                </button>
                {editingCategory ? (
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Cancel edit
                  </button>
                ) : null}
                {editingCategory ? (
                  <button
                    type="button"
                    onClick={handleDeleteCategory}
                    disabled={deleteCategoryMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleteCategoryMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Delete category
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {categoriesError ? (
                <p className="text-sm text-rose-600">{categoriesError}</p>
              ) : categoriesLoading ? (
                <p className="text-sm text-slate-500">Loading categories...</p>
              ) : (
                categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setEditingCategory(category)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {category.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {category.slug} · {category.serviceCount} services
                      </p>
                    </div>
                    <PencilLine size={16} className="text-slate-400" />
                  </button>
                ))
              )}
            </div>
          </AccountPanel>

          <AccountPanel
            title={editingService ? 'Edit service' : 'Create service'}
            description="Define the request inputs and upload requirements here so the requester form is generated from live service settings."
          >
            <form
              onSubmit={serviceForm.handleSubmit((values) =>
                serviceMutation.mutate(values),
              )}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category">
                  <select className={inputClass(false)} {...serviceForm.register('categoryId')}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Delivery mode">
                  <select
                    className={inputClass(false)}
                    {...serviceForm.register('deliveryMode')}
                  >
                    <option value={ServiceDeliveryMode.CBT_MANUAL}>
                      CBT manual
                    </option>
                    <option value={ServiceDeliveryMode.API_AUTOMATED}>
                      API automated
                    </option>
                    <option value={ServiceDeliveryMode.PIN_STOCK}>
                      PIN stock
                    </option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Service name">
                  <input className={inputClass(false)} {...serviceForm.register('name')} />
                </Field>
                <Field label="Slug">
                  <input className={inputClass(false)} {...serviceForm.register('slug')} />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  rows={3}
                  className={inputClass(false)}
                  {...serviceForm.register('description')}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Platform fee (naira)">
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass(false)}
                    {...serviceForm.register('platformFeeNaira', {
                      valueAsNumber: true,
                    })}
                  />
                </Field>
                <Field label="Total price (naira)">
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass(false)}
                    {...serviceForm.register('totalPriceNaira', {
                      valueAsNumber: true,
                    })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CBT commission (naira)">
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass(false)}
                    {...serviceForm.register('cbtCommissionNaira', {
                      valueAsNumber: true,
                    })}
                  />
                </Field>
                <Field label="Provider cost (naira)">
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass(false)}
                    {...serviceForm.register('providerCostNaira', {
                      valueAsNumber: true,
                    })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider key">
                  <input
                    className={inputClass(false)}
                    {...serviceForm.register('providerKey')}
                  />
                </Field>
                <Field label="Provider service code">
                  <input
                    className={inputClass(false)}
                    {...serviceForm.register('providerServiceCode')}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sort order">
                  <input
                    type="number"
                    className={inputClass(false)}
                    {...serviceForm.register('sortOrder', { valueAsNumber: true })}
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" {...serviceForm.register('isActive')} />
                  Service is active
                </label>
              </div>

              <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Required fields
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      These inputs drive the requester form for this service.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => requiredFieldsArray.append(createEmptyField())}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    <Plus size={14} />
                    Add field
                  </button>
                </div>

                {requiredFieldsArray.fields.length ? (
                  <div className="space-y-3">
                    {requiredFieldsArray.fields.map((field, index) => {
                      const currentType =
                        requiredFieldValues?.[index]?.type ?? 'text';

                      return (
                        <div
                          key={field.id}
                          className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              Field {index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => requiredFieldsArray.remove(index)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Field key">
                              <input
                                className={inputClass(false)}
                                placeholder="fullName"
                                {...serviceForm.register(`requiredFields.${index}.name`)}
                              />
                            </Field>
                            <Field label="Label">
                              <input
                                className={inputClass(false)}
                                placeholder="Full name"
                                {...serviceForm.register(`requiredFields.${index}.label`)}
                              />
                            </Field>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Input type">
                              <select
                                className={inputClass(false)}
                                {...serviceForm.register(`requiredFields.${index}.type`)}
                              >
                                <option value="text">Text</option>
                                <option value="textarea">Textarea</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="tel">Phone</option>
                                <option value="select">Select</option>
                              </select>
                            </Field>
                            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                {...serviceForm.register(`requiredFields.${index}.required`)}
                              />
                              Required field
                            </label>
                          </div>

                          <Field label="Placeholder">
                            <input
                              className={inputClass(false)}
                              placeholder="Enter full name"
                              {...serviceForm.register(`requiredFields.${index}.placeholder`)}
                            />
                          </Field>

                          <Field label="Help text">
                            <input
                              className={inputClass(false)}
                              placeholder="Shown below the field in the order form"
                              {...serviceForm.register(`requiredFields.${index}.helpText`)}
                            />
                          </Field>

                          {currentType === 'select' ? (
                            <Field label="Options">
                              <textarea
                                rows={3}
                                className={inputClass(false)}
                                placeholder="One option per line"
                                {...serviceForm.register(`requiredFields.${index}.optionsText`)}
                              />
                            </Field>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                    No custom fields yet. Add one when this service needs requester input.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Required documents
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Configure uploads the requester must attach before checkout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      requiredDocumentsArray.append(createEmptyDocument())
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    <Plus size={14} />
                    Add document
                  </button>
                </div>

                {requiredDocumentsArray.fields.length ? (
                  <div className="space-y-3">
                    {requiredDocumentsArray.fields.map((document, index) => (
                      <div
                        key={document.id}
                        className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            Document {index + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() => requiredDocumentsArray.remove(index)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Document key">
                            <input
                              className={inputClass(false)}
                              placeholder="passportPhoto"
                              {...serviceForm.register(`requiredDocuments.${index}.name`)}
                            />
                          </Field>
                          <Field label="Label">
                            <input
                              className={inputClass(false)}
                              placeholder="Passport photograph"
                              {...serviceForm.register(`requiredDocuments.${index}.label`)}
                            />
                          </Field>
                        </div>

                        <Field label="Description">
                          <input
                            className={inputClass(false)}
                            placeholder="Explain what should be uploaded"
                            {...serviceForm.register(
                              `requiredDocuments.${index}.description`,
                            )}
                          />
                        </Field>

                        <Field label="Accepted file types">
                          <input
                            className={inputClass(false)}
                            placeholder="image/jpeg, image/png, application/pdf"
                            {...serviceForm.register(
                              `requiredDocuments.${index}.acceptedTypesText`,
                            )}
                          />
                        </Field>

                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            {...serviceForm.register(`requiredDocuments.${index}.required`)}
                          />
                          Requester must upload this document
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                    No upload requirements yet. Add one if this service needs supporting files.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={serviceMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {serviceMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingService ? 'Update service' : 'Create service'}
                </button>
                {editingService ? (
                  <button
                    type="button"
                    onClick={() => setEditingService(null)}
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    New service
                  </button>
                ) : null}
                {editingService ? (
                  <button
                    type="button"
                    onClick={handleDeleteService}
                    disabled={deleteServiceMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleteServiceMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Delete service
                  </button>
                ) : null}
              </div>
            </form>
          </AccountPanel>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'success' | 'muted' | 'navy' | 'amber';
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'success' && 'bg-emerald-50 text-emerald-700',
        tone === 'muted' && 'bg-slate-100 text-slate-600',
        tone === 'navy' && 'bg-brand-navy/10 text-brand-navy',
        tone === 'amber' && 'bg-amber-50 text-amber-700',
      )}
    >
      {children}
    </span>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition',
    'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10',
    hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
  );
}

function koboToNairaNumber(value: string) {
  return Number(value) / 100;
}

function createEmptyField(): ServiceFieldFormValue {
  return {
    name: '',
    label: '',
    type: 'text',
    required: true,
    placeholder: '',
    helpText: '',
    optionsText: '',
  };
}

function createEmptyDocument(): ServiceDocumentFormValue {
  return {
    name: '',
    label: '',
    required: true,
    description: '',
    acceptedTypesText: '',
  };
}

function mapFieldToFormValue(
  field: AdminServiceItem['requiredFields'][number],
): ServiceFieldFormValue {
  return {
    name: field.name,
    label: field.label ?? '',
    type: field.type ?? 'text',
    required: field.required === true,
    placeholder: field.placeholder ?? '',
    helpText: field.helpText ?? '',
    optionsText: (field.options ?? []).join('\n'),
  };
}

function mapDocumentToFormValue(
  document: AdminServiceItem['requiredDocuments'][number],
): ServiceDocumentFormValue {
  return {
    name: document.name,
    label: document.label ?? '',
    required: document.required !== false,
    description: document.description ?? '',
    acceptedTypesText: (document.acceptedTypes ?? []).join(', '),
  };
}

function serializeFieldDefinitions(fields: ServiceFieldFormValue[]) {
  return fields.map((field, index) => {
    const name = field.name.trim();

    if (!name) {
      throw new Error(`Field ${index + 1} needs a field key.`);
    }

    const options = field.optionsText
      .split('\n')
      .map((option) => option.trim())
      .filter(Boolean);

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

function serializeDocumentDefinitions(documents: ServiceDocumentFormValue[]) {
  return documents.map((document, index) => {
    const name = document.name.trim();

    if (!name) {
      throw new Error(`Document ${index + 1} needs a document key.`);
    }

    return {
      name,
      label: document.label.trim() || undefined,
      required: document.required,
      description: document.description.trim() || undefined,
      acceptedTypes: document.acceptedTypesText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    };
  });
}
