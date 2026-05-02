'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
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
import { ServiceDeliveryMode } from '@zendocx/types';
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
  deliveryMode: ServiceDeliveryMode;
  platformFeePercent: number;
  providerKey: string;
  providerServiceCode: string;
  sortOrder: number;
  isActive: boolean;
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
  deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
  platformFeePercent: 0,
  providerKey: '',
  providerServiceCode: '',
  sortOrder: 0,
  isActive: true,
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
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [apiConfigService, setApiConfigService] = useState<AdminServiceItem | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'categories' | 'vtu'>('services');

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
  const providerForm = useForm<VtuProviderFormValues>({
    defaultValues: DEFAULT_VTU_PROVIDER_VALUES,
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
      deliveryMode: editingService.deliveryMode,
      platformFeePercent: editingService.platformFeePercent ?? 0,
      providerKey: editingService.providerKey ?? '',
      providerServiceCode: editingService.providerServiceCode ?? '',
      sortOrder: editingService.sortOrder,
      isActive: editingService.isActive,
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
      setShowCategoryModal(false);
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
        deliveryMode: values.deliveryMode,
        platformFeePercent: Number(values.platformFeePercent),
        providerKey: values.providerKey.trim() || undefined,
        providerServiceCode: values.providerServiceCode.trim() || undefined,
        sortOrder: Number(values.sortOrder),
        isActive: values.isActive,
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
      setShowServiceModal(false);
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
      setShowCategoryModal(false);
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
      setShowServiceModal(false);
      serviceForm.reset({ ...DEFAULT_SERVICE_VALUES, categoryId: categories[0]?.id ?? '' });
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
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">

      {/* ── Page header ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Service Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">Manage services, categories, and VTU provider configuration.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Orders
            <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditingService(null);
              serviceForm.reset({ ...DEFAULT_SERVICE_VALUES, categoryId: categories[0]?.id ?? '' });
              setShowServiceModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#F5A623] px-4 py-2.5 text-sm font-bold text-[#0D1B3E] transition hover:bg-[#e8961a]"
          >
            <Plus size={15} />
            Add Service
          </button>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
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

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {(['services', 'categories', 'vtu'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition',
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {tab === 'services' ? 'Services' : tab === 'categories' ? 'Categories' : 'VTU Provider'}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* SERVICES TAB                                            */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search services…"
              className={cn(inputClass(false), 'flex-1 min-w-[160px] max-w-xs')}
            />
            <select
              value={categorySlug}
              onChange={(e) => { setCategorySlug(e.target.value); setPage(1); }}
              className={cn(inputClass(false), 'w-auto')}
            >
              <option value="ALL">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select
              value={deliveryMode}
              onChange={(e) => {
                setDeliveryMode(e.target.value === 'ALL' ? 'ALL' : (e.target.value as ServiceDeliveryMode));
                setPage(1);
              }}
              className={cn(inputClass(false), 'w-auto')}
            >
              <option value="ALL">All modes</option>
              <option value={ServiceDeliveryMode.CBT_MANUAL}>CBT manual</option>
              <option value={ServiceDeliveryMode.API_AUTOMATED}>API automated</option>
              <option value={ServiceDeliveryMode.PIN_STOCK}>PIN stock</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE'); setPage(1); }}
              className={cn(inputClass(false), 'w-auto')}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active only</option>
              <option value="INACTIVE">Inactive only</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {error ? (
              <EmptyState title="Services unavailable" message={error} icon={Layers3} />
            ) : loading ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">Loading services…</div>
            ) : services.length === 0 ? (
              <EmptyState
                title="No services match these filters"
                message="Adjust filters or add a new service."
                icon={Layers3}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        <Th>Service name</Th>
                        <Th>Category</Th>
                        <Th>Total price</Th>
                        <Th>Mode</Th>
                        <Th>Sort</Th>
                        <Th>Status</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {services.map((service) => (
                        <tr key={service.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">{service.name}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{service.slug}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{service.category.name}</td>
                          <td className="px-5 py-4 font-semibold text-slate-900">{formatNaira(service.totalPrice)}</td>
                          <td className="px-5 py-4">
                            <Badge
                              tone={
                                service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                                  ? 'navy'
                                  : service.deliveryMode === ServiceDeliveryMode.PIN_STOCK
                                    ? 'amber'
                                    : 'muted'
                              }
                            >
                              {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                                ? 'API auto'
                                : service.deliveryMode === ServiceDeliveryMode.PIN_STOCK
                                  ? 'PIN stock'
                                  : 'CBT manual'}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-slate-500">{service.sortOrder}</td>
                          <td className="px-5 py-4">
                            <Badge tone={service.isActive ? 'success' : 'muted'}>
                              {service.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1">
                              <ActionButton
                                title="Edit service"
                                onClick={() => {
                                  setEditingService(service);
                                  setShowServiceModal(true);
                                }}
                              >
                                <PencilLine size={14} />
                              </ActionButton>
                              {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED ? (
                                <ActionButton
                                  title="API integration config"
                                  onClick={() => setApiConfigService(service)}
                                >
                                  <Settings2 size={14} />
                                </ActionButton>
                              ) : null}
                              <ActionButton
                                title="Delete service"
                                danger
                                onClick={() => {
                                  setEditingService(service);
                                  setTimeout(() => handleDeleteService(), 0);
                                }}
                              >
                                <Trash2 size={14} />
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pagination && pagination.totalPages > 1 ? (
                  <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                    <p className="text-xs text-slate-500">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page >= pagination.totalPages}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* CATEGORIES TAB                                          */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setEditingCategory(null); categoryForm.reset(DEFAULT_CATEGORY_VALUES); setShowCategoryModal(true); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#F5A623] px-4 py-2.5 text-sm font-bold text-[#0D1B3E] transition hover:bg-[#e8961a]"
            >
              <Plus size={15} />
              Add Category
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {categoriesLoading ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">Loading categories…</div>
            ) : categoriesError ? (
              <div className="px-6 py-6 text-center text-sm text-rose-600">{categoriesError}</div>
            ) : categories.length === 0 ? (
              <EmptyState title="No categories yet" message="Add your first service category to get started." icon={Layers3} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <Th>Name</Th>
                    <Th>Slug</Th>
                    <Th>Services</Th>
                    <Th>Sort</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900">{cat.name}</td>
                      <td className="px-5 py-4 text-slate-500 font-mono text-xs">{cat.slug}</td>
                      <td className="px-5 py-4 text-slate-600">{cat.serviceCount}</td>
                      <td className="px-5 py-4 text-slate-500">{cat.sortOrder}</td>
                      <td className="px-5 py-4">
                        <Badge tone={cat.isActive ? 'success' : 'muted'}>
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <ActionButton
                          title="Edit category"
                          onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }}
                        >
                          <PencilLine size={14} />
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* VTU PROVIDER TAB                                        */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'vtu' && (
        <div className="space-y-5">
          {readinessError ? (
            <EmptyState title="Provider readiness unavailable" message={readinessError} icon={Activity} />
          ) : readinessLoading || !readiness ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-8 text-center text-sm text-slate-400">Loading provider readiness…</div>
          ) : (
            <>
              {/* Status card */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-bold text-slate-900">{readiness.vtu.providerName}</h2>
                  <Badge tone="navy">{readiness.scope.label}</Badge>
                  <Badge tone={readiness.vtu.mode === 'live' ? (readiness.vtu.probe.status === 'healthy' ? 'success' : 'amber') : 'muted'}>
                    {readiness.vtu.mode === 'live' ? 'Live mode' : 'Mock mode'}
                  </Badge>
                  <Badge tone={readiness.vtu.probe.status === 'healthy' ? 'success' : readiness.vtu.probe.status === 'not_applicable' ? 'muted' : 'amber'}>
                    {readiness.vtu.probe.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={reloadReadiness}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <MetricPill label="Plan cache TTL" value={`${readiness.cache.planTtlSeconds}s`} />
                <MetricPill label="Verify cache TTL" value={`${readiness.cache.verificationTtlSeconds}s`} />
                <MetricPill label="Automated services" value={String(readiness.automatedServices.length)} />
                <MetricPill label="Last probe" value={new Date(readiness.vtu.probe.checkedAt).toLocaleTimeString()} />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                {/* Config form */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-sm font-bold text-slate-900">Provider configuration</h3>
                  {liveRolloutNeedsValidation ? (
                    <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Live cutover should be revalidated.</p>
                        <p className="mt-1 leading-6 text-amber-800">Save changes then run validation before relying on the live branch.</p>
                      </div>
                    </div>
                  ) : null}
                  <form onSubmit={providerForm.handleSubmit((v) => providerMutation.mutate(v))} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                        <input type="checkbox" {...providerForm.register('isEnabled')} />
                        Provider enabled
                      </label>
                      <Field label="Rollout mode">
                        <select className={inputClass(false)} {...providerForm.register('rolloutMode')}>
                          <option value="AUTO">Auto</option>
                          <option value="MOCK">Force mock</option>
                          <option value="LIVE">Force live</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Base URL">
                      <input className={inputClass(false)} placeholder="https://provider.example.com" {...providerForm.register('baseUrl')} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="API key header">
                        <input className={inputClass(false)} {...providerForm.register('apiKeyHeader')} />
                      </Field>
                      <Field label="API key prefix">
                        <input className={inputClass(false)} placeholder="Bearer " {...providerForm.register('apiKeyPrefix')} />
                      </Field>
                    </div>
                    <Field label="New API key">
                      <input
                        type="password"
                        className={inputClass(false)}
                        placeholder={readiness.savedConfig?.apiKeyConfigured ? 'Leave blank to keep saved key' : 'Paste live VTU API key'}
                        {...providerForm.register('apiKey')}
                      />
                    </Field>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                      <input type="checkbox" {...providerForm.register('clearApiKey')} />
                      Clear saved API key
                    </label>
                    <Field label="Ops notes">
                      <textarea rows={2} className={inputClass(false)} placeholder="Rollout notes or provider account context" {...providerForm.register('notes')} />
                    </Field>
                    <div className="flex flex-wrap gap-3">
                      <span className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                        Saved key: <strong>{readiness.savedConfig?.apiKeyConfigured ? `••••${readiness.savedConfig.apiKeyLast4 ?? ''}` : 'Not configured'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => providerValidationMutation.mutate()}
                        disabled={providerValidationMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {providerValidationMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        Validate
                      </button>
                      <button
                        type="submit"
                        disabled={providerMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:opacity-60"
                      >
                        {providerMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save settings
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricPill label="Last validation" value={readiness.savedConfig?.lastValidatedAt ? new Date(readiness.savedConfig.lastValidatedAt).toLocaleString() : 'Never'} />
                      <MetricPill label="Validation status" value={readiness.savedConfig?.lastValidationStatus?.replace(/_/g, ' ') ?? 'Not run'} />
                      <MetricPill label="Credential state" value={readiness.savedConfig?.apiKeyConfigured ? 'Saved' : 'Missing'} />
                    </div>
                  </form>
                </div>

                {/* Validation history + VTU coverage */}
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <History size={14} className="text-slate-400" />
                      <h3 className="text-sm font-bold text-slate-900">Validation history</h3>
                    </div>
                    <div className="space-y-2">
                      {readiness.validationHistory.length ? (
                        readiness.validationHistory.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={item.probeStatus === 'healthy' ? 'success' : item.probeStatus === 'not_applicable' ? 'muted' : 'amber'}>
                                {item.probeStatus.replace(/_/g, ' ')}
                              </Badge>
                              <Badge tone="navy">{item.rolloutMode}</Badge>
                              <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-900">{item.probeMessage}</p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
                          No validation runs yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">Automated VTU coverage</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {readiness.automatedServices.map((service) => (
                        <div key={service.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                          <p className="text-sm font-medium text-slate-900">{service.name}</p>
                          <Badge tone="navy">{service.providerKey ?? 'None'}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* SERVICE EDIT MODAL                                      */}
      {/* ════════════════════════════════════════════════════════ */}
      {showServiceModal ? (
        <ModalOverlay onClose={() => { setShowServiceModal(false); setEditingService(null); }}>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900">
              {editingService ? 'Edit service' : 'Create service'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowServiceModal(false); setEditingService(null); }}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(90vh - 130px)' }}>
            <form
              onSubmit={serviceForm.handleSubmit((v) => serviceMutation.mutate(v))}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category">
                  <select className={inputClass(false)} {...serviceForm.register('categoryId')}>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Delivery mode">
                  <select className={inputClass(false)} {...serviceForm.register('deliveryMode')}>
                    <option value={ServiceDeliveryMode.CBT_MANUAL}>CBT manual</option>
                    <option value={ServiceDeliveryMode.API_AUTOMATED}>API automated</option>
                    <option value={ServiceDeliveryMode.PIN_STOCK}>PIN stock</option>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Platform fee (%)">
                  <input type="number" step="0.1" min="0" max="100" className={inputClass(false)} {...serviceForm.register('platformFeePercent', { valueAsNumber: true })} />
                </Field>
                <Field label="Sort order">
                  <input type="number" className={inputClass(false)} {...serviceForm.register('sortOrder', { valueAsNumber: true })} />
                </Field>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" {...serviceForm.register('isActive')} />
                Service is active
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={serviceMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:opacity-60">
                  {serviceMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {editingService ? 'Update service' : 'Create service'}
                </button>
                {editingService ? (
                  <button type="button" onClick={handleDeleteService} disabled={deleteServiceMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60">
                    {deleteServiceMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    Delete service
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </ModalOverlay>
      ) : null}

      {/* ════════════════════════════════════════════════════════ */}
      {/* API CONFIG MODAL (per-service provider key)             */}
      {/* ════════════════════════════════════════════════════════ */}
      {apiConfigService ? (
        <ModalOverlay onClose={() => setApiConfigService(null)} narrow>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">API Integration</p>
              <h2 className="text-lg font-bold text-slate-900">{apiConfigService.name}</h2>
            </div>
            <button type="button" onClick={() => setApiConfigService(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition">✕</button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500 leading-6">
              The provider key tells the VTU layer which service endpoint to call when processing automated orders. The service code is passed in the API request body.
            </p>
            <form
              onSubmit={serviceForm.handleSubmit((v) => {
                serviceMutation.mutate(v);
                setApiConfigService(null);
              })}
              className="space-y-4"
            >
              <Field label="Provider key (API endpoint identifier)">
                <input
                  className={inputClass(false)}
                  placeholder="e.g. airtime, data-mtn, electricity-ekedc"
                  {...serviceForm.register('providerKey')}
                  defaultValue={apiConfigService.providerKey ?? ''}
                />
              </Field>
              <Field label="Provider service code">
                <input
                  className={inputClass(false)}
                  placeholder="e.g. MTN, EKEDC, GOTV"
                  {...serviceForm.register('providerServiceCode')}
                  defaultValue={apiConfigService.providerServiceCode ?? ''}
                />
              </Field>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                API credentials are configured globally under the VTU Provider tab. These fields only configure which service within the provider this entry maps to.
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={serviceMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-[#F5A623] px-5 py-2.5 text-sm font-bold text-[#0D1B3E] transition hover:bg-[#e8961a] disabled:opacity-60">
                  {serviceMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save API config
                </button>
                <button type="button" onClick={() => setApiConfigService(null)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      ) : null}

      {/* ════════════════════════════════════════════════════════ */}
      {/* CATEGORY MODAL                                          */}
      {/* ════════════════════════════════════════════════════════ */}
      {showCategoryModal ? (
        <ModalOverlay onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }} narrow>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900">
              {editingCategory ? 'Edit category' : 'Create category'}
            </h2>
            <button type="button" onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition">✕</button>
          </div>
          <div className="px-6 py-5">
            <form onSubmit={categoryForm.handleSubmit((v) => categoryMutation.mutate(v))} className="space-y-4">
              <Field label="Name"><input className={inputClass(false)} {...categoryForm.register('name')} /></Field>
              <Field label="Slug"><input className={inputClass(false)} {...categoryForm.register('slug')} /></Field>
              <Field label="Description"><textarea rows={2} className={inputClass(false)} {...categoryForm.register('description')} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sort order"><input type="number" className={inputClass(false)} {...categoryForm.register('sortOrder', { valueAsNumber: true })} /></Field>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 mt-6">
                  <input type="checkbox" {...categoryForm.register('isActive')} /> Active
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={categoryMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:opacity-60">
                  {categoryMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingCategory ? 'Update' : 'Create'}
                </button>
                {editingCategory ? (
                  <button type="button" onClick={handleDeleteCategory} disabled={deleteCategoryMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60">
                    {deleteCategoryMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </ModalOverlay>
      ) : null}

    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
  narrow = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  narrow?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-[1.75rem] bg-white shadow-2xl',
          narrow ? 'max-w-lg' : 'max-w-2xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  title,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-xl border transition',
          danger
            ? 'border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
        )}
      >
        {children}
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        {title}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-left">
      {children}
    </th>
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

