'use client';

import { useQuery } from '@tanstack/react-query';
import { UserRole } from '@zentry/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export interface AdminWalletOverview {
  totalWallets: number;
  fundedWallets: number;
  pendingFundingCount: number;
  totalAvailableBalance: string;
  totalEscrowBalance: string;
  totalEarned: string;
  totalWithdrawn: string;
  successfulFundingVolume: string;
  commissionVolume: string;
  platformCommissionVolume: string;
  cbtCommissionVolume: string;
  withdrawalVolume: string;
  refundVolume: string;
  heldFundsByTenant: Array<{
    id: string;
    name: string;
    slug: string;
    heldFunds: string;
  }>;
}

export interface AdminCbtEarningsOverview {
  summary: {
    releasedCommissionVolume: string;
    releasedCommissionCount: number;
    totalCbtWithdrawableBalance: string;
    totalCbtEarned: string;
    totalCbtWithdrawn: string;
    awaitingReleaseAmount: string;
    awaitingReleaseCount: number;
    readyReleaseAmount: string;
    readyReleaseCount: number;
    blockedReleaseAmount: string;
    blockedReleaseCount: number;
  };
  queue: {
    awaiting: Array<{
      id: string;
      orderNumber: string;
      amount: string;
      disputeWindowExpiresAt: string | null;
      cbt: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
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
    }>;
    ready: Array<{
      id: string;
      orderNumber: string;
      amount: string;
      disputeWindowExpiresAt: string | null;
      cbt: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
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
    }>;
    blocked: Array<{
      id: string;
      orderNumber: string;
      amount: string;
      disputeWindowExpiresAt: string | null;
      cbt: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
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
      dispute: {
        id: string;
        status: string;
        reason: string;
      } | null;
    }>;
  };
  topCbtWallets: Array<{
    id: string;
    availableBalance: string;
    totalEarned: string;
    totalWithdrawn: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    };
  }>;
  recentReleased: Array<{
    id: string;
    amount: string;
    reference: string;
    createdAt: string;
    cbt: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    order: {
      id: string;
      orderNumber: string;
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
    } | null;
  }>;
}

export interface AdminWalletListItem {
  id: string;
  availableBalance: string;
  escrowBalance: string;
  totalEarned: string;
  totalWithdrawn: string;
  updatedAt: string;
  transactionCount: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
}

export interface AdminWalletFilters {
  page?: number;
  limit?: number;
  role?: UserRole | 'ALL';
  search?: string;
  tenantId?: string | 'ALL';
}

interface AdminWalletListResponse {
  items: AdminWalletListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  filters: {
    role: UserRole | null;
    tenantId: string | null;
    search: string | null;
  };
}

export function useAdminWalletOverview() {
  const query = useQuery({
    queryKey: ['wallet', 'admin', 'overview'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminWalletOverview }>(
        '/wallet/admin/overview',
      );

      return response.data.data;
    },
  });

  return {
    overview: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load platform wallet visibility right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminCbtEarningsOverview() {
  const query = useQuery({
    queryKey: ['wallet', 'admin', 'cbt-earnings'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminCbtEarningsOverview }>(
        '/wallet/admin/cbt-earnings',
      );

      return response.data.data;
    },
  });

  return {
    overview: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load CBT earnings visibility right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminWallets(filters: AdminWalletFilters) {
  const query = useQuery({
    queryKey: ['wallet', 'admin', 'wallets', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) {
        params.set('page', String(filters.page));
      }

      if (filters.limit) {
        params.set('limit', String(filters.limit));
      }

      if (filters.role && filters.role !== 'ALL') {
        params.set('role', filters.role);
      }

      if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
      }

      if (filters.tenantId && filters.tenantId !== 'ALL') {
        params.set('tenantId', filters.tenantId);
      }

      const queryString = params.toString();
      const response = await apiClient.get<{ data: AdminWalletListResponse }>(
        queryString
          ? `/wallet/admin/wallets?${queryString}`
          : '/wallet/admin/wallets',
      );

      return response.data.data;
    },
  });

  return {
    wallets: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load admin wallet records right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
