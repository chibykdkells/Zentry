'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CbtApprovalStatus } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export const ADMIN_CBT_QUERY_KEY = ['admin', 'cbt'] as const;

export interface AdminCbtApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
  cbtProfile: {
    id: string;
    centerName: string;
    licenseNumber: string;
    supportingDocUrl: string | null;
    address: string;
    state: string;
    lga: string;
    approvalStatus: CbtApprovalStatus;
    approvedAt: string | null;
    rejectionReason: string | null;
    createdAt: string;
  } | null;
}

interface AdminCbtListResponse {
  message: string;
  data: {
    items: AdminCbtApplication[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdminCbtFilters {
  status?: CbtApprovalStatus | 'ALL';
  page?: number;
  limit?: number;
}

export function useAdminCbtApplications(filters: AdminCbtFilters) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const query = useQuery({
    queryKey: [...ADMIN_CBT_QUERY_KEY, filters] as const,
    queryFn: async () => {
      const response = await apiClient.get<AdminCbtListResponse>(
        `/users/admin/cbt?${params.toString()}`,
      );
      return response.data.data;
    },
  });

  return {
    applications: query.data?.items ?? [],
    meta: query.data
      ? {
          total: query.data.total,
          page: query.data.page,
          totalPages: query.data.totalPages,
        }
      : null,
    loading: query.isLoading,
    error: query.isError ? getApiErrorMessage(query.error, 'Failed to load CBT applications') : null,
    reload: query.refetch,
  };
}

export function useApproveCbtCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/users/admin/cbt/${userId}/approve`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_CBT_QUERY_KEY });
    },
  });
}

export function useRejectCbtCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      apiClient.post(`/users/admin/cbt/${userId}/reject`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_CBT_QUERY_KEY });
    },
  });
}
