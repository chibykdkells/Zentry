'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

interface EarningsReleaseQueueItem {
  id: string;
  orderNumber: string;
  amount: string;
  disputeWindowExpiresAt: string | null;
  service: {
    name: string;
    slug: string;
    category: {
      name: string;
      slug: string;
    };
  };
  dispute?: {
    id: string;
    status: string;
    reason: string;
  } | null;
}

interface CbtEarningsHistoryItem {
  id: string;
  type: string;
  status: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  reference: string;
  gatewayRef: string | null;
  gateway: string | null;
  description: string;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    escrowReleasedAt: string | null;
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
    };
  } | null;
}

interface CbtEarningsResponse {
  summary: {
    totalEarned: string;
    withdrawableBalance: string;
    totalWithdrawn: string;
    awaitingReleaseAmount: string;
    awaitingReleaseCount: number;
    readyReleaseAmount: string;
    readyReleaseCount: number;
    blockedReleaseAmount: string;
    blockedReleaseCount: number;
  };
  releaseQueue: {
    awaiting: EarningsReleaseQueueItem[];
    ready: EarningsReleaseQueueItem[];
    blocked: EarningsReleaseQueueItem[];
  };
  serviceMix: Array<{
    orderId: string | null;
    totalAmount: string;
    service: {
      id: string;
      name: string;
      slug: string;
      category: {
        id: string;
        name: string;
        slug: string;
      };
    } | null;
  }>;
  history: {
    items: CbtEarningsHistoryItem[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
    };
  };
}

export interface CbtEarningsFilters {
  page?: number;
  limit?: number;
}

export function useCbtEarnings(filters: CbtEarningsFilters) {
  const query = useQuery({
    queryKey: ['wallet', 'cbt', 'earnings', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const queryString = params.toString();
      const response = await apiClient.get<{ data: CbtEarningsResponse }>(
        queryString
          ? `/wallet/cbt/earnings?${queryString}`
          : '/wallet/cbt/earnings',
      );

      return response.data.data;
    },
  });

  return {
    earnings: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load CBT earnings right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
