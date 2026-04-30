'use client';

import { useQuery } from '@tanstack/react-query';
import { PaymentGateway, TransactionStatus, TransactionType, UserRole } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export interface AdminWalletTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  reference: string;
  gatewayRef: string | null;
  gateway: PaymentGateway | null;
  description: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
}

export interface AdminWalletTransactionFilters {
  page?: number;
  limit?: number;
  type?: TransactionType | 'ALL';
  status?: TransactionStatus | 'ALL';
  role?: UserRole | 'ALL';
  tenantId?: string | 'ALL';
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface AdminWalletTransactionListResponse {
  items: AdminWalletTransaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  filters: {
    type: TransactionType | null;
    status: TransactionStatus | null;
    role: UserRole | null;
    tenantId: string | null;
    search: string | null;
    startDate: string | null;
    endDate: string | null;
  };
}

export function useAdminWalletTransactions(
  filters: AdminWalletTransactionFilters,
) {
  const query = useQuery({
    queryKey: ['wallet', 'admin', 'transactions', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.type && filters.type !== 'ALL') params.set('type', filters.type);
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.role && filters.role !== 'ALL') params.set('role', filters.role);
      if (filters.tenantId && filters.tenantId !== 'ALL') params.set('tenantId', filters.tenantId);
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const queryString = params.toString();
      const response = await apiClient.get<{ data: AdminWalletTransactionListResponse }>(
        queryString
          ? `/wallet/admin/transactions?${queryString}`
          : '/wallet/admin/transactions',
      );

      return response.data.data;
    },
  });

  return {
    transactions: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load platform wallet activity right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
