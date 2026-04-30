'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DisputeStatus,
  FulfillmentType,
  OrderStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  totalAmount: string;
  platformFee: string;
  cbtCommission: string;
  submittedData: Record<string, string>;
  requesterDocUrls: string[];
  resultFileUrl: string | null;
  resultUploadedAt: string | null;
  escrowReleasedAt: string | null;
  disputeWindowExpiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  releaseState: 'NOT_READY' | 'AWAITING_WINDOW' | 'READY_FOR_RELEASE' | 'RELEASED';
  service: {
    id: string;
    name: string;
    slug: string;
    category: {
      name: string;
      slug: string;
    };
  };
}

interface OrdersResponse {
  metrics: {
    all: number;
    active: number;
    completed: number;
    issues: number;
  };
  items: OrderListItem[];
}

export interface OrderDetail extends OrderListItem {
  resultFileUrl: string | null;
  resultUploadedAt: string | null;
  escrowReleasedAt: string | null;
  disputeWindowExpiresAt: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  providerReference: string | null;
  providerResponse: Record<string, unknown> | null;
  cbtNotes: string | null;
  adminNotes: string | null;
  state: {
    isActive: boolean;
    hasIssue: boolean;
    isCompleted: boolean;
  };
  service: OrderListItem['service'] & {
    fulfillmentType: FulfillmentType;
    requiredFields: Array<Record<string, unknown>>;
    requiredDocuments: Array<Record<string, unknown>>;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
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
  transactions: Array<{
    id: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: string;
    description: string;
    reference: string;
    createdAt: string;
  }>;
  dispute: {
    id: string;
    status: DisputeStatus;
    reason: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    redoDeadline: string | null;
    redoCompletedAt: string | null;
    resolutionNote: string | null;
    evidenceUrls: string[];
  } | null;
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
  } | null;
}

export interface AdminOrderListItem extends OrderListItem {
  state: OrderDetail['state'];
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  requester: OrderDetail['requester'];
  assignedCbt: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface AdminOrdersFilters {
  page?: number;
  limit?: number;
  search?: string;
  tenantId?: string | 'ALL';
  status?: OrderStatus | 'ALL';
  fulfillmentType?: FulfillmentType | 'ALL';
  requesterRole?: UserRole | 'ALL';
  releaseState?: 'AWAITING_WINDOW' | 'READY_FOR_RELEASE' | 'RELEASED' | 'ALL';
}

interface AdminOrdersResponse {
  metrics: OrdersResponse['metrics'] & {
    awaitingRelease: number;
    readyForRelease: number;
  };
  items: AdminOrderListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  filters: {
    search: string | null;
    tenantId: string | null;
    status: OrderStatus | null;
    fulfillmentType: FulfillmentType | null;
    requesterRole: UserRole | null;
    releaseState: 'AWAITING_WINDOW' | 'READY_FOR_RELEASE' | 'RELEASED' | null;
  };
}

export interface AdminOrderReleasePreview {
  orderId: string;
  orderNumber: string;
  releaseState: 'NOT_READY' | 'AWAITING_WINDOW' | 'READY_FOR_RELEASE' | 'RELEASED';
  canPrepareRelease: boolean;
  blockedReasons: string[];
  timing: {
    completedAt: string | null;
    disputeWindowExpiresAt: string | null;
    escrowReleasedAt: string | null;
  };
  actors: {
    requesterEmail: string;
    assignedCbtEmail: string | null;
    assignedCbtName: string | null;
  };
  amounts: {
    escrowLocked: string;
    cbtCommission: string;
    platformNet: string;
  };
  job: {
    queueName: string;
    jobName: string;
    jobId: string;
    scheduledFor: string;
    delayMs: number;
    shouldEnqueueNow: boolean;
  };
  steps: Array<{
    type: 'ESCROW_RELEASE' | 'CBT_COMMISSION' | 'PLATFORM_COMMISSION';
    amount: string;
    summary: string;
  }>;
}

export function useOrders() {
  const query = useQuery({
    queryKey: ['orders', 'me'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: OrdersResponse }>('/orders/me');
      return response.data.data;
    },
  });

  return {
    metrics: query.data?.metrics ?? null,
    orders: query.data?.items ?? [],
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load your orders right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useOrderDetail(orderId: string | null) {
  const query = useQuery({
    queryKey: ['orders', 'me', orderId] as const,
    enabled: Boolean(orderId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: OrderDetail }>(
        `/orders/me/${orderId}`,
      );
      return response.data.data;
    },
  });

  return {
    order: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load this order right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminOrders(filters: AdminOrdersFilters) {
  const query = useQuery({
    queryKey: ['orders', 'admin', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.tenantId && filters.tenantId !== 'ALL') {
        params.set('tenantId', filters.tenantId);
      }
      if (filters.status && filters.status !== 'ALL') {
        params.set('status', filters.status);
      }
      if (filters.fulfillmentType && filters.fulfillmentType !== 'ALL') {
        params.set('fulfillmentType', filters.fulfillmentType);
      }
      if (filters.requesterRole && filters.requesterRole !== 'ALL') {
        params.set('requesterRole', filters.requesterRole);
      }
      if (filters.releaseState && filters.releaseState !== 'ALL') {
        params.set('releaseState', filters.releaseState);
      }

      const queryString = params.toString();
      const response = await apiClient.get<{ data: AdminOrdersResponse }>(
        queryString ? `/orders/admin?${queryString}` : '/orders/admin',
      );
      return response.data.data;
    },
  });

  return {
    metrics: query.data?.metrics ?? null,
    orders: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    filters: query.data?.filters ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load admin orders right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminOrderDetail(orderId: string | null) {
  const query = useQuery({
    queryKey: ['orders', 'admin', 'detail', orderId] as const,
    enabled: Boolean(orderId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: OrderDetail }>(
        `/orders/admin/${orderId}`,
      );
      return response.data.data;
    },
  });

  return {
    order: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load this admin order view right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminOrderReleasePreview(orderId: string | null) {
  const query = useQuery({
    queryKey: ['orders', 'admin', 'release-preview', orderId] as const,
    enabled: Boolean(orderId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminOrderReleasePreview }>(
        `/orders/admin/${orderId}/release-preview`,
      );
      return response.data.data;
    },
  });

  return {
    preview: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load the release preview right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useUpdateAdminOrderNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      adminNotes,
    }: {
      orderId: string;
      adminNotes: string;
    }) => {
      const response = await apiClient.patch<{ data: OrderDetail; message: string }>(
        `/orders/admin/${orderId}/notes`,
        {
          adminNotes,
        },
      );
      return response.data;
    },
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({
        queryKey: ['orders', 'admin', 'detail', variables.orderId],
      });
    },
  });
}
