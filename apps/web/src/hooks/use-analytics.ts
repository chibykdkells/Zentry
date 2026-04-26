'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

// ── Types ────────────────────────────────────────────────────────────

export interface RevenuePoint {
  period: string;
  revenue: string;
  orderCount: number;
}

export interface OrdersByService {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  orderCount: number;
  totalRevenue: string;
}

export interface CbtPerformer {
  cbtId: string | null;
  name: string;
  jobsCompleted: number;
  totalEarned: string;
}

export interface CbtPerformance {
  totalCompleted: number;
  totalDisputed: number;
  disputeRate: number;
  totalCbts: number;
  approvedCbts: number;
  topPerformers: CbtPerformer[];
}

export interface UserGrowthPoint {
  period: string;
  newUsers: number;
  cumulative: number;
}

export interface WalletFloat {
  totalEscrowed: string;
  platformBalance: string;
  totalCbtAvailable: string;
  totalUserAvailable: string;
}

export interface AnalyticsOverview {
  revenue: RevenuePoint[];
  ordersByService: OrdersByService[];
  cbtPerformance: CbtPerformance;
  userGrowth: UserGrowthPoint[];
  walletFloat: WalletFloat;
}

// ── Hooks ─────────────────────────────────────────────────────────────

export function useAnalyticsOverview() {
  const query = useQuery({
    queryKey: ['analytics', 'admin', 'overview'] as const,
    queryFn: async () => {
      const res = await apiClient.get<{ data: AnalyticsOverview }>(
        '/analytics/admin/overview',
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  return {
    overview: query.data ?? null,
    loading: query.isLoading,
    error: query.isError
      ? getApiErrorMessage(query.error, 'Failed to load analytics')
      : null,
    reload: query.refetch,
  };
}

export function useRevenueSeries(period: AnalyticsPeriod = 'daily', points = 30) {
  const query = useQuery({
    queryKey: ['analytics', 'admin', 'revenue', period, points] as const,
    queryFn: async () => {
      const res = await apiClient.get<{ data: RevenuePoint[] }>(
        `/analytics/admin/revenue?period=${period}&points=${points}`,
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: query.isError
      ? getApiErrorMessage(query.error, 'Failed to load revenue data')
      : null,
  };
}

export function useUserGrowth(period: AnalyticsPeriod = 'daily', points = 30) {
  const query = useQuery({
    queryKey: ['analytics', 'admin', 'user-growth', period, points] as const,
    queryFn: async () => {
      const res = await apiClient.get<{ data: UserGrowthPoint[] }>(
        `/analytics/admin/user-growth?period=${period}&points=${points}`,
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: query.isError
      ? getApiErrorMessage(query.error, 'Failed to load user growth data')
      : null,
  };
}

export function useWalletFloat() {
  const query = useQuery({
    queryKey: ['analytics', 'admin', 'wallet-float'] as const,
    queryFn: async () => {
      const res = await apiClient.get<{ data: WalletFloat }>(
        '/analytics/admin/wallet-float',
      );
      return res.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  return {
    float: query.data ?? null,
    loading: query.isLoading,
    error: query.isError
      ? getApiErrorMessage(query.error, 'Failed to load wallet float')
      : null,
  };
}
