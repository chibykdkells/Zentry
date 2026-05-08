'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FulfillmentType, OrderStatus, UserRole } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import type { OrderDetail } from '@/hooks/use-orders';

export interface CbtJobSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  totalAmount: string;
  platformFee: string;
  cbtCommission: string;
  requesterDocCount: number;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  completedAt: string | null;
  state: {
    isActive: boolean;
    hasIssue: boolean;
    isCompleted: boolean;
  };
  service: {
    id: string;
    name: string;
    slug: string;
    category: {
      id: string;
      name: string;
      slug: string;
    };
  };
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
  assignedCbt: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    cbtProfile: {
      centerName: string;
      approvalStatus: string;
    } | null;
  } | null;
}

interface CbtDashboardResponse {
  centerName: string;
  approvalStatus: string;
  metrics: {
    availableJobs: number;
    activeJobs: number;
    completedJobs: number;
    totalEarned: string;
    awaitingRelease: string;
    availableBalance: string;
    totalWithdrawn: string;
  };
  availableJobs: CbtJobSummary[];
  myJobs: CbtJobSummary[];
}

interface CbtJobPoolResponse {
  items: CbtJobSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  filters: {
    search: string | null;
    categorySlug: string | null;
  };
}

interface CbtMyJobsResponse {
  metrics: {
    assigned: number;
    inProgress: number;
    completed: number;
  };
  items: CbtJobSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  filters: {
    search: string | null;
    status: OrderStatus | null;
  };
}

export interface CbtJobPoolFilters {
  page?: number;
  limit?: number;
  search?: string;
  categorySlug?: string;
}

export interface CbtMyJobsFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus | 'ALL';
}

interface CbtOrderMutationResponse {
  message: string;
  data: OrderDetail;
}

export function useCbtDashboard() {
  const query = useQuery({
    queryKey: ['orders', 'cbt', 'dashboard'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: CbtDashboardResponse }>(
        '/orders/cbt/dashboard',
      );
      return response.data.data;
    },
  });

  return {
    dashboard: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load the CBT dashboard right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useCbtJobPool(filters: CbtJobPoolFilters) {
  const query = useQuery({
    queryKey: ['orders', 'cbt', 'job-pool', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.categorySlug) params.set('categorySlug', filters.categorySlug);

      const queryString = params.toString();
      const response = await apiClient.get<{ data: CbtJobPoolResponse }>(
        queryString ? `/orders/cbt/job-pool?${queryString}` : '/orders/cbt/job-pool',
      );
      return response.data.data;
    },
  });

  return {
    jobs: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load the CBT job pool right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useCbtMyJobs(filters: CbtMyJobsFilters) {
  const query = useQuery({
    queryKey: ['orders', 'cbt', 'my-jobs', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);

      const queryString = params.toString();
      const response = await apiClient.get<{ data: CbtMyJobsResponse }>(
        queryString ? `/orders/cbt/my-jobs?${queryString}` : '/orders/cbt/my-jobs',
      );
      return response.data.data;
    },
  });

  return {
    metrics: query.data?.metrics ?? null,
    jobs: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load CBT jobs right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useCbtJobDetail(orderId: string | null) {
  const query = useQuery({
    queryKey: ['orders', 'cbt', 'detail', orderId] as const,
    enabled: Boolean(orderId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: OrderDetail }>(
        `/orders/cbt/${orderId}`,
      );
      return response.data.data;
    },
  });

  return {
    job: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load this CBT job right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useClaimCbtJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.post<CbtOrderMutationResponse>(
        `/orders/cbt/${orderId}/claim`,
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useStartCbtJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.post<CbtOrderMutationResponse>(
        `/orders/cbt/${orderId}/start`,
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCompleteCbtJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      file,
      cbtNotes,
    }: {
      orderId: string;
      file: File;
      cbtNotes?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);

      if (cbtNotes?.trim()) {
        formData.append('cbtNotes', cbtNotes.trim());
      }

      const response = await apiClient.post<CbtOrderMutationResponse>(
        `/orders/cbt/${orderId}/result`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRequestTimeExtension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const response = await apiClient.post<{ message: string; data: { id: string; status: string; createdAt: string } }>(
        `/orders/cbt/${orderId}/request-extension`,
        { reason },
      );
      return response.data;
    },
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['orders', 'cbt', 'detail', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'cbt', 'my-jobs'] });
    },
  });
}

export interface ExtensionRequest {
  id: string;
  cbtId: string;
  reason: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    deliveryDeadline: string | null;
    service: { name: string };
    assignedCbt: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      cbtProfile: { centerName: string } | null;
    } | null;
  };
}

export function usePendingExtensionRequests() {
  const query = useQuery({
    queryKey: ['orders', 'admin', 'extension-requests'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: ExtensionRequest[] }>(
        '/orders/admin/extension-requests',
      );
      return response.data.data;
    },
    refetchInterval: 30_000,
  });
  return {
    requests: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? getApiErrorMessage(query.error, 'Could not load extension requests.') : null,
    reload: () => { void query.refetch(); },
  };
}

export function useReviewExtension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      extensionId,
      action,
      additionalMinutes,
    }: {
      extensionId: string;
      action: 'APPROVE' | 'REJECT';
      additionalMinutes?: number;
    }) => {
      const response = await apiClient.post<{ message: string }>(
        `/orders/admin/extension-requests/${extensionId}/review`,
        { action, additionalMinutes },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders', 'admin', 'extension-requests'] });
    },
  });
}
