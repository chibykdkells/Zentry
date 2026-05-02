'use client';

import { useQuery } from '@tanstack/react-query';
import { FulfillmentType, ServiceDeliveryMode } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export const ADMIN_SERVICE_CATEGORIES_QUERY_KEY = ['admin', 'service-categories'] as const;
export const ADMIN_PROVIDER_READINESS_QUERY_KEY = ['admin', 'provider-readiness'] as const;

export interface AdminServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  serviceCount: number;
}

export interface AdminServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  deliveryMode: ServiceDeliveryMode;
  fulfillmentType: FulfillmentType;
  providerCost: string;
  platformFee: string;
  platformFeePercent: number;
  totalPrice: string;
  cbtCommission: string;
  providerKey: string | null;
  providerServiceCode: string | null;
  sortOrder: number;
  requiredFields: Array<{
    name: string;
    label?: string;
    type?: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'select';
    required?: boolean;
    placeholder?: string;
    helpText?: string;
    options?: string[];
  }>;
  requiredDocuments: Array<{
    name: string;
    label?: string;
    required?: boolean;
    acceptedTypes?: string[];
    description?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface AdminServiceFilters {
  search?: string;
  categorySlug?: string;
  deliveryMode?: ServiceDeliveryMode;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminProviderReadiness {
  vtu: {
    providerName: string;
    mode: 'live' | 'mock';
    configured: boolean;
    supportsLiveTransport: boolean;
    missingConfig: string[];
    endpoints: {
      health?: string | null;
      airtime: string;
      dataPurchase: string;
      dataPlans: string;
      cablePlans: string;
      cableVerify: string;
      cablePurchase: string;
      electricityVerify: string;
      electricityPurchase: string;
    };
    probe: {
      attempted: boolean;
      status: 'not_applicable' | 'healthy' | 'unreachable' | 'error';
      message: string;
      checkedAt: string;
    };
  };
  scope: {
    type: 'PLATFORM' | 'TENANT';
    key: string;
    label: string;
    tenantReady: boolean;
    effectiveType?: 'PLATFORM' | 'TENANT';
    effectiveKey?: string;
  };
  savedConfig: {
    scopeType: 'PLATFORM' | 'TENANT';
    scopeKey: string;
    isEnabled: boolean;
    rolloutMode: 'AUTO' | 'MOCK' | 'LIVE';
    baseUrl: string | null;
    apiKeyConfigured: boolean;
    apiKeyLast4: string | null;
    apiKeyHeader: string | null;
    apiKeyPrefix: string | null;
    healthPath: string | null;
    airtimePath: string | null;
    dataPurchasePath: string | null;
    dataPlansPath: string | null;
    cablePlansPath: string | null;
    cableVerifyPath: string | null;
    cablePurchasePath: string | null;
    electricityVerifyPath: string | null;
    electricityPurchasePath: string | null;
    notes: string | null;
    lastValidatedAt: string | null;
    lastValidationStatus: string | null;
    lastValidationMessage: string | null;
  } | null;
  validationHistory: Array<{
    id: string;
    rolloutMode: 'AUTO' | 'MOCK' | 'LIVE';
    effectiveMode: 'live' | 'mock' | string;
    probeStatus: 'not_applicable' | 'healthy' | 'unreachable' | 'error' | string;
    probeMessage: string;
    missingConfig: string[];
    endpointBaseUrl: string | null;
    createdAt: string;
  }>;
  cache: {
    planTtlSeconds: number;
    verificationTtlSeconds: number;
  };
  automatedServices: Array<{
    id: string;
    name: string;
    slug: string;
    providerKey: string | null;
    category: {
      name: string;
      slug: string;
    };
  }>;
}

interface AdminServicesResponse {
  overview: {
    totalServices: number;
    activeServices: number;
    inactiveServices: number;
    manualServices: number;
    automatedServices: number;
    apiAutomatedServices: number;
    pinStockServices: number;
    categories: number;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    serviceCount: number;
  }>;
  items: AdminServiceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    categorySlug: string | null;
    deliveryMode: ServiceDeliveryMode | null;
    isActive: boolean | null;
  };
}

export const getAdminServicesQueryKey = (filters: AdminServiceFilters) =>
  ['admin', 'services', filters] as const;

export function useAdminServiceCategories() {
  const query = useQuery({
    queryKey: ADMIN_SERVICE_CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminServiceCategory[] }>(
        '/services/admin/categories',
      );
      return response.data.data;
    },
  });

  return {
    categories: query.data ?? [],
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load service categories right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminServices(filters: AdminServiceFilters) {
  const query = useQuery({
    queryKey: getAdminServicesQueryKey(filters),
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
      }

      if (filters.categorySlug) {
        params.set('categorySlug', filters.categorySlug);
      }

      if (filters.deliveryMode) {
        params.set('deliveryMode', filters.deliveryMode);
      }

      if (typeof filters.isActive === 'boolean') {
        params.set('isActive', String(filters.isActive));
      }

      if (filters.page) {
        params.set('page', String(filters.page));
      }

      if (filters.limit) {
        params.set('limit', String(filters.limit));
      }

      const response = await apiClient.get<{ data: AdminServicesResponse }>(
        params.toString()
          ? `/services/admin/services?${params.toString()}`
          : '/services/admin/services',
      );

      return response.data.data;
    },
  });

  return {
    overview: query.data?.overview ?? null,
    services: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load admin services right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminProviderReadiness() {
  const query = useQuery({
    queryKey: ADMIN_PROVIDER_READINESS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminProviderReadiness }>(
        '/services/admin/provider-readiness',
      );
      return response.data.data;
    },
  });

  return {
    readiness: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load provider readiness right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
