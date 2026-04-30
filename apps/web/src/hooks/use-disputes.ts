'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DisputeStatus, FulfillmentType, OrderStatus, ServiceDeliveryMode } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export interface DisputeListItem {
  id: string;
  status: DisputeStatus;
  reason: string;
  evidenceUrls: string[];
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  redoDeadline: string | null;
  redoCompletedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    deliveryMode: ServiceDeliveryMode;
    fulfillmentType: FulfillmentType;
    resultFileUrl: string | null;
    disputeWindowExpiresAt: string | null;
    completedAt: string | null;
    createdAt: string;
    service: {
      id: string;
      name: string;
      slug: string;
      category: {
        name: string;
        slug: string;
      };
    };
  };
}

interface MyDisputesResponse {
  metrics: {
    all: number;
    open: number;
    underReview: number;
    resolvedForRequester: number;
    resolvedForCbt: number;
  };
  items: DisputeListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export interface AdminDisputeListItem extends DisputeListItem {
  order: DisputeListItem['order'] & {
    totalAmount: string;
    cbtCommission: string;
    platformFee: string;
    escrowReleasedAt: string | null;
    requester: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    };
    assignedCbt: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  };
  disputeGroundwork: {
    refundAmount: string;
    escrowStillLocked: boolean;
    refundPath: 'ESCROW_REFUND_PREVIEW' | 'MANUAL_RECONCILIATION_PREVIEW';
    cbtPenaltyCandidate: string | null;
    platformAmountAtRisk: string;
    redoWindowHours: number;
    redoDeadline: string | null;
    redoCompletedAt: string | null;
    refundStatus:
      | 'EXECUTED'
      | 'PENDING'
      | 'MANUAL_RECONCILIATION_REQUIRED'
      | 'NOT_APPLICABLE';
    refundReference: string | null;
    penaltyStatus:
      | 'PENDING_REVIEW'
      | 'EXECUTED'
      | 'WAIVED'
      | 'NOT_REQUESTED'
      | 'NOT_APPLICABLE';
    penaltyReference: string | null;
    releaseBlockedByDispute: boolean;
  };
}

interface AdminDisputesResponse {
  metrics: {
    all: number;
    open: number;
    underReview: number;
    redoRequested: number;
    resolved: number;
  };
  items: AdminDisputeListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  filters: {
    search: string | null;
    status: DisputeStatus | null;
  };
}

export function useMyDisputes(page = 1, limit = 10) {
  const query = useQuery({
    queryKey: ['orders', 'disputes', 'me', page, limit] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: MyDisputesResponse }>(
        `/orders/me/disputes?page=${page}&limit=${limit}`,
      );
      return response.data.data;
    },
  });

  return {
    metrics: query.data?.metrics ?? null,
    disputes: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load your disputes right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useCreateOrderDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
      evidenceUrls,
    }: {
      orderId: string;
      reason: string;
      evidenceUrls?: string[];
    }) => {
      const response = await apiClient.post<{ data: unknown; message: string }>(
        `/orders/me/${orderId}/dispute`,
        {
          reason,
          evidenceUrls,
        },
      );
      return response.data;
    },
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'me', variables.orderId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'disputes', 'me'],
      });
    },
  });
}

export function useAdminDisputes(filters: {
  page?: number;
  limit?: number;
  search?: string;
  status?: DisputeStatus | 'ALL';
}) {
  const query = useQuery({
    queryKey: ['orders', 'admin', 'disputes', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.status && filters.status !== 'ALL') {
        params.set('status', filters.status);
      }

      const queryString = params.toString();
      const response = await apiClient.get<{ data: AdminDisputesResponse }>(
        queryString ? `/orders/admin/disputes?${queryString}` : '/orders/admin/disputes',
      );
      return response.data.data;
    },
  });

  return {
    metrics: query.data?.metrics ?? null,
    disputes: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load admin disputes right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useReviewOrderDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      action,
      resolutionNote,
      flagCbtPenalty,
    }: {
      orderId: string;
      action:
        | 'UNDER_REVIEW'
        | 'RESOLVED_FOR_REQUESTER'
        | 'RESOLVED_FOR_CBT'
        | 'REQUEST_REDO';
      resolutionNote?: string;
      flagCbtPenalty?: boolean;
    }) => {
      const response = await apiClient.patch<{ data: unknown; message: string }>(
        `/orders/admin/${orderId}/dispute`,
        {
          action,
          resolutionNote,
          flagCbtPenalty,
        },
      );
      return response.data;
    },
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'admin', 'detail', variables.orderId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'admin', 'release-preview', variables.orderId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'disputes', 'me'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'admin', 'disputes'],
      });
    },
  });
}

export function useReviewOrderDisputeFinancialFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      action,
      note,
    }: {
      orderId: string;
      action:
        | 'COMPLETE_MANUAL_REFUND'
        | 'EXECUTE_CBT_PENALTY'
        | 'WAIVE_CBT_PENALTY';
      note?: string;
    }) => {
      const response = await apiClient.patch<{ data: unknown; message: string }>(
        `/orders/admin/${orderId}/dispute`,
        {
          action,
          resolutionNote: note,
        },
      );
      return response.data;
    },
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'admin', 'detail', variables.orderId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'admin', 'disputes'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['wallet', 'admin'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['wallet', 'cbt'],
      });
    },
  });
}
