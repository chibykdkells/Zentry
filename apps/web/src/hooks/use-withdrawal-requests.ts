'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { WithdrawalStatus } from '@zendocx/types';
import type { CreateWithdrawalRequestInput } from '@zendocx/validators';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth.store';

const MY_WITHDRAWALS_QUERY_KEY = ['wallet', 'withdrawals', 'me'] as const;
const ADMIN_WITHDRAWALS_QUERY_KEY = ['wallet', 'withdrawals', 'admin'] as const;

export interface WithdrawalRequestItem {
  id: string;
  amount: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  status: WithdrawalStatus;
  processorNote: string | null;
  gatewayRef: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWithdrawalRequestItem extends WithdrawalRequestItem {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface WithdrawalSummary {
  pendingAmount: string;
  pendingCount: number;
  approvedAmount: string;
  approvedCount: number;
  processingAmount: string;
  processingCount: number;
  completedAmount: string;
  completedCount: number;
  rejectedAmount: string;
  rejectedCount: number;
}

interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface MyWithdrawalFilters {
  page?: number;
  limit?: number;
  status?: WithdrawalStatus | 'ALL';
}

export interface AdminWithdrawalFilters {
  page?: number;
  limit?: number;
  status?: WithdrawalStatus | 'ALL';
  search?: string;
}

interface MyWithdrawalResponse {
  items: WithdrawalRequestItem[];
  summary: WithdrawalSummary;
  meta: PaginatedMeta;
  filters: {
    status: WithdrawalStatus | null;
  };
}

interface AdminWithdrawalResponse {
  items: AdminWithdrawalRequestItem[];
  summary: WithdrawalSummary;
  meta: PaginatedMeta;
  filters: {
    status: WithdrawalStatus | null;
    search: string | null;
  };
}

interface ReviewWithdrawalPayload {
  withdrawalRequestId: string;
  status: WithdrawalStatus.APPROVED | WithdrawalStatus.PROCESSING | WithdrawalStatus.COMPLETED | WithdrawalStatus.REJECTED;
  note?: string;
  gatewayRef?: string;
}

function buildQueryString(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  return search.toString();
}

export function useMyWithdrawalRequests(filters: MyWithdrawalFilters) {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const awaitingSession = !hasHydrated || (!!user && !accessToken);
  const query = useQuery({
    queryKey: [...MY_WITHDRAWALS_QUERY_KEY, filters] as const,
    queryFn: async () => {
      const queryString = buildQueryString({
        page: filters.page,
        limit: filters.limit,
        status: filters.status && filters.status !== 'ALL' ? filters.status : undefined,
      });

      const response = await apiClient.get<{ data: MyWithdrawalResponse }>(
        queryString ? `/wallet/withdrawals?${queryString}` : '/wallet/withdrawals',
      );

      return response.data.data;
    },
    enabled: hasHydrated && !!accessToken,
  });

  return {
    requests: query.data?.items ?? [],
    summary: query.data?.summary ?? null,
    meta: query.data?.meta ?? null,
    loading: awaitingSession || query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load your withdrawal requests right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminWithdrawalRequests(filters: AdminWithdrawalFilters) {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const awaitingSession = !hasHydrated || (!!user && !accessToken);
  const query = useQuery({
    queryKey: [...ADMIN_WITHDRAWALS_QUERY_KEY, filters] as const,
    queryFn: async () => {
      const queryString = buildQueryString({
        page: filters.page,
        limit: filters.limit,
        status: filters.status && filters.status !== 'ALL' ? filters.status : undefined,
        search: filters.search?.trim() || undefined,
      });

      const response = await apiClient.get<{ data: AdminWithdrawalResponse }>(
        queryString
          ? `/wallet/admin/withdrawals?${queryString}`
          : '/wallet/admin/withdrawals',
      );

      return response.data.data;
    },
    enabled: hasHydrated && !!accessToken,
  });

  return {
    requests: query.data?.items ?? [],
    summary: query.data?.summary ?? null,
    meta: query.data?.meta ?? null,
    loading: awaitingSession || query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load withdrawal review data right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useCreateWithdrawalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CreateWithdrawalRequestInput) => {
      const response = await apiClient.post<{
        message: string;
        data: {
          request: WithdrawalRequestItem;
          wallet: {
            availableBalance: string;
            totalWithdrawn: string;
          };
        };
      }>('/wallet/withdrawals', values);

      return response.data;
    },
    onSuccess: async (response) => {
      toast.success(response.message ?? 'Withdrawal request submitted.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: MY_WITHDRAWALS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'cbt', 'earnings'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] }),
        queryClient.invalidateQueries({ queryKey: ADMIN_WITHDRAWALS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'admin', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'admin', 'cbt-earnings'] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(
          error,
          'Could not submit your withdrawal request right now.',
        ),
      );
    },
  });
}

export function useReviewWithdrawalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      withdrawalRequestId,
      ...values
    }: ReviewWithdrawalPayload) => {
      const response = await apiClient.patch<{
        message: string;
        data: AdminWithdrawalRequestItem;
      }>(`/wallet/admin/withdrawals/${withdrawalRequestId}`, values);

      return response.data;
    },
    onSuccess: async (response) => {
      toast.success(response.message ?? 'Withdrawal request updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_WITHDRAWALS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MY_WITHDRAWALS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'cbt', 'earnings'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'admin', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'admin', 'cbt-earnings'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'admin', 'transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'admin', 'wallets'] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(
          error,
          'Could not update this withdrawal request right now.',
        ),
      );
    },
  });
}
