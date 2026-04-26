'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import type { AdminProviderReadiness } from './use-admin-services';
import type {
  ServiceCatalogCategory,
  ServiceCatalogFilters,
  ServiceCatalogItem,
} from './use-service-catalog';

export const TENANT_PROVIDER_READINESS_QUERY_KEY = ['tenant', 'provider-readiness'] as const;
export const TENANT_SERVICE_CATALOG_QUERY_KEY = ['tenant', 'service-catalog'] as const;
export const TENANT_SERVICE_MANAGEMENT_QUERY_KEY = ['tenant', 'service-management'] as const;

export interface UpdateTenantVtuProviderConfigInput {
  isEnabled?: boolean;
  rolloutMode?: 'AUTO' | 'MOCK' | 'LIVE';
  baseUrl?: string | null;
  apiKey?: string;
  clearApiKey?: boolean;
  apiKeyHeader?: string | null;
  apiKeyPrefix?: string | null;
  healthPath?: string | null;
  airtimePath?: string | null;
  dataPurchasePath?: string | null;
  dataPlansPath?: string | null;
  cablePlansPath?: string | null;
  cableVerifyPath?: string | null;
  cablePurchasePath?: string | null;
  electricityVerifyPath?: string | null;
  electricityPurchasePath?: string | null;
  notes?: string | null;
}

interface TenantServiceCatalogResponse {
  categories: ServiceCatalogCategory[];
  services: ServiceCatalogItem[];
  filters: {
    search: string | null;
    categorySlug: string | null;
  };
}

interface TenantManageableServiceItem extends ServiceCatalogItem {
  isSelected: boolean;
}

interface TenantServiceManagementResponse {
  selection: {
    usesCustomSelection: boolean;
    selectedServiceSlugs: string[];
    selectedCount: number;
    visibleCount: number;
  };
  categories: ServiceCatalogCategory[];
  services: TenantManageableServiceItem[];
  filters: {
    search: string | null;
    categorySlug: string | null;
  };
}

export function useTenantServiceCatalog(filters: ServiceCatalogFilters) {
  const query = useQuery({
    queryKey: [...TENANT_SERVICE_CATALOG_QUERY_KEY, filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
      }

      if (filters.categorySlug) {
        params.set('categorySlug', filters.categorySlug);
      }

      const queryString = params.toString();
      const response = await apiClient.get<{ data: TenantServiceCatalogResponse }>(
        queryString ? `/services/catalog?${queryString}` : '/services/catalog',
      );

      return response.data.data;
    },
  });

  return {
    categories: query.data?.categories ?? [],
    services: query.data?.services ?? [],
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load tenant services right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useTenantServiceManagementCatalog(filters: ServiceCatalogFilters) {
  const query = useQuery({
    queryKey: [...TENANT_SERVICE_MANAGEMENT_QUERY_KEY, filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
      }

      if (filters.categorySlug) {
        params.set('categorySlug', filters.categorySlug);
      }

      const queryString = params.toString();
      const response = await apiClient.get<{ data: TenantServiceManagementResponse }>(
        queryString ? `/services/tenant/manage?${queryString}` : '/services/tenant/manage',
      );

      return response.data.data;
    },
  });

  return {
    selection: query.data?.selection ?? null,
    categories: query.data?.categories ?? [],
    services: query.data?.services ?? [],
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load tenant service setup right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useTenantProviderReadiness() {
  const query = useQuery({
    queryKey: TENANT_PROVIDER_READINESS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminProviderReadiness }>(
        '/services/tenant/provider-readiness',
      );
      return response.data.data;
    },
  });

  return {
    readiness: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load provider config right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useUpdateTenantVtuProviderConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTenantVtuProviderConfigInput) => {
      const response = await apiClient.patch<{ data: AdminProviderReadiness }>(
        '/services/tenant/provider-readiness/vtu',
        payload,
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TENANT_PROVIDER_READINESS_QUERY_KEY });
    },
  });
}

export function useValidateTenantVtuProviderConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: AdminProviderReadiness }>(
        '/services/tenant/provider-readiness/vtu/validate',
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TENANT_PROVIDER_READINESS_QUERY_KEY });
    },
  });
}

export function useUpdateTenantServiceSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      usesCustomSelection: boolean;
      selectedServiceSlugs: string[];
    }) => {
      const response = await apiClient.patch<{ data: TenantServiceManagementResponse }>(
        '/services/tenant/manage',
        payload,
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: TENANT_SERVICE_MANAGEMENT_QUERY_KEY,
      });
      await queryClient.invalidateQueries({
        queryKey: TENANT_SERVICE_CATALOG_QUERY_KEY,
      });
    },
  });
}
