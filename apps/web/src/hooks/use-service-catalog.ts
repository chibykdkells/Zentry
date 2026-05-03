'use client';

import { useQuery } from '@tanstack/react-query';
import { FulfillmentType, ServiceDeliveryMode } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export interface ServiceCatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  serviceCount: number;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  deliveryMode: ServiceDeliveryMode;
  fulfillmentType: FulfillmentType;
  totalPrice: string;
  cbtCommission: string;
  requiredFieldsCount: number;
  requiredFields: Array<{
    name: string;
    label?: string;
    type?: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'select';
    required?: boolean;
    placeholder?: string;
    helpText?: string;
    options?: string[];
  }>;
  requiredDocumentsCount: number;
  requiredDocuments: Array<{
    name: string;
    label?: string;
    required?: boolean;
    acceptedTypes?: string[];
    description?: string;
  }>;
  eta: string;
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
}

export interface ServiceCatalogFilters {
  search?: string;
  categorySlug?: string;
  tenantSlug?: string;
}

interface ServiceCatalogResponse {
  categories: ServiceCatalogCategory[];
  services: ServiceCatalogItem[];
  filters: {
    search: string | null;
    categorySlug: string | null;
  };
}

export interface VtuDataPlan {
  code: string;
  name: string;
  amountKobo: string;
  validity: string;
}

export interface VtuCablePlan {
  code: string;
  name: string;
  amountKobo: string;
  duration: string;
}

export interface VtuIntegrationMeta {
  name: string;
  mode: 'live' | 'mock';
  cached: boolean;
}

interface VtuDataPlansResponse {
  serviceId: string;
  serviceName: string;
  network: string;
  plans: VtuDataPlan[];
  provider: VtuIntegrationMeta;
}

interface VtuCablePlansResponse {
  serviceId: string;
  serviceName: string;
  provider: string;
  plans: VtuCablePlan[];
  integration: VtuIntegrationMeta;
}

export function useServiceCatalog(filters: ServiceCatalogFilters) {
  const query = useQuery({
    queryKey: ['services', 'catalog', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
      }

      if (filters.categorySlug) {
        params.set('categorySlug', filters.categorySlug);
      }

      if (filters.tenantSlug) {
        params.set('tenantSlug', filters.tenantSlug);
      }

      const queryString = params.toString();
      const response = await apiClient.get<{ data: ServiceCatalogResponse }>(
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
      ? getApiErrorMessage(
          query.error,
          'Could not load the service catalog right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useVtuDataPlans(serviceId: string, enabled = true) {
  const query = useQuery({
    queryKey: ['services', 'vtu-data-plans', serviceId] as const,
    enabled: enabled && Boolean(serviceId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: VtuDataPlansResponse }>(
        `/services/vtu/data-plans/${serviceId}`,
      );

      return response.data.data;
    },
  });

  return {
    serviceName: query.data?.serviceName ?? null,
    network: query.data?.network ?? null,
    plans: query.data?.plans ?? [],
    integration: query.data?.provider ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load data plans for this service right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useVtuCablePlans(serviceId: string, enabled = true) {
  const query = useQuery({
    queryKey: ['services', 'vtu-cable-plans', serviceId] as const,
    enabled: enabled && Boolean(serviceId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: VtuCablePlansResponse }>(
        `/services/vtu/cable-plans/${serviceId}`,
      );

      return response.data.data;
    },
  });

  return {
    serviceName: query.data?.serviceName ?? null,
    provider: query.data?.provider ?? null,
    plans: query.data?.plans ?? [],
    integration: query.data?.integration ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load cable plans for this service right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
