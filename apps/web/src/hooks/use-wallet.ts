'use client';

import { useQuery } from '@tanstack/react-query';
import { PaymentGateway, TransactionStatus, TransactionType } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth.store';

export interface WalletTransaction {
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
}

export interface WalletOverview {
  id: string;
  availableBalance: string;
  escrowBalance: string;
  totalEarned: string;
  totalWithdrawn: string;
  transactionCount: number;
  updatedAt: string;
  recentTransactions: WalletTransaction[];
}

export const WALLET_OVERVIEW_QUERY_KEY = ['wallet', 'overview'] as const;

export interface WalletTransactionFilters {
  page?: number;
  limit?: number;
  type?: TransactionType | 'ALL';
  status?: TransactionStatus | 'ALL';
  startDate?: string;
  endDate?: string;
}

export interface WalletTransactionListResponse {
  items: WalletTransaction[];
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
    startDate: string | null;
    endDate: string | null;
  };
}

export interface BankListItem {
  code: string;
  name: string;
}

export function useBanks() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const awaitingSession = !hasHydrated || (!!user && !accessToken);
  const query = useQuery({
    queryKey: ['wallet', 'banks'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: BankListItem[] }>('/wallet/banks');
      return response.data.data;
    },
    enabled: hasHydrated && !!accessToken,
    staleTime: 1000 * 60 * 60, // banks list changes rarely — cache for 1 hour
  });

  return {
    banks: query.data ?? [],
    loading: awaitingSession || query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load bank list.')
      : null,
  };
}

export function useWallet() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const awaitingSession = !hasHydrated || (!!user && !accessToken);
  const query = useQuery({
    queryKey: WALLET_OVERVIEW_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: WalletOverview }>('/wallet/me');
      return response.data.data;
    },
    enabled: hasHydrated && !!accessToken,
  });

  return {
    wallet: query.data ?? null,
    loading: awaitingSession || query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load your wallet right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useWalletTransactions(filters: WalletTransactionFilters) {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const awaitingSession = !hasHydrated || (!!user && !accessToken);
  const query = useQuery({
    queryKey: ['wallet', 'transactions', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) {
        params.set('page', String(filters.page));
      }

      if (filters.limit) {
        params.set('limit', String(filters.limit));
      }

      if (filters.type && filters.type !== 'ALL') {
        params.set('type', filters.type);
      }

      if (filters.status && filters.status !== 'ALL') {
        params.set('status', filters.status);
      }

      if (filters.startDate) {
        params.set('startDate', filters.startDate);
      }

      if (filters.endDate) {
        params.set('endDate', filters.endDate);
      }

      const response = await apiClient.get<{ data: WalletTransactionListResponse }>(
        `/wallet/transactions?${params.toString()}`,
      );

      return response.data.data;
    },
    enabled: hasHydrated && !!accessToken,
  });

  return {
    transactions: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    filters: query.data?.filters ?? null,
    loading: awaitingSession || query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load wallet transactions right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
