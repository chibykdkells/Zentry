'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrderStatus, FulfillmentType } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import type { OrderDetail } from '@/hooks/use-orders';

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface TenantAdminOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  totalAmount: string;
  platformFee: string;
  cbtCommission: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  releaseState: 'AWAITING_WINDOW' | 'READY' | 'RELEASED' | 'BLOCKED' | null;
  service: {
    id: string;
    name: string;
    slug: string;
    category: { id: string; name: string; slug: string };
  };
  tenant: { id: string; name: string; slug: string } | null;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedCbt: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    cbtProfile?: { centerName: string } | null;
  } | null;
}

export interface TenantAdminDisputeSummary {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    service: { name: string };
    requester: { firstName: string; lastName: string; email: string };
    assignedCbt: {
      firstName: string;
      lastName: string;
      email: string;
      cbtProfile?: { centerName: string } | null;
    } | null;
  };
}

interface OrderMetrics {
  all: number;
  active: number;
  completed: number;
  issues: number;
  awaitingRelease: number;
  readyForRelease: number;
}

interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

interface AdminOrdersResponse {
  metrics: OrderMetrics;
  items: TenantAdminOrderSummary[];
  meta: PageMeta;
  filters: Record<string, unknown>;
}

interface DisputeMetrics {
  total: number;
  open: number;
  underReview: number;
  redoRequested: number;
  resolved: number;
}

interface AdminDisputesResponse {
  metrics: DisputeMetrics;
  items: TenantAdminDisputeSummary[];
  meta: PageMeta;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface TenantAdminOrderFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus | 'ALL';
  fulfillmentType?: FulfillmentType;
  releaseState?: string;
}

export interface TenantAdminDisputeFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTenantAdminOrders(filters: TenantAdminOrderFilters = {}) {
  const query = useQuery({
    queryKey: ['orders', 'tenant-admin', 'list', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.fulfillmentType) params.set('fulfillmentType', filters.fulfillmentType);
      if (filters.releaseState) params.set('releaseState', filters.releaseState);

      const qs = params.toString();
      const res = await apiClient.get<{ data: AdminOrdersResponse }>(
        qs ? `/orders/admin?${qs}` : '/orders/admin',
      );
      return res.data.data;
    },
  });

  return {
    metrics: query.data?.metrics ?? null,
    orders: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load orders right now.')
      : null,
    reload: () => { void query.refetch(); },
  };
}

export function useTenantAdminOrderDetail(orderId: string | null) {
  const query = useQuery({
    queryKey: ['orders', 'tenant-admin', 'detail', orderId] as const,
    enabled: Boolean(orderId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: OrderDetail }>(
        `/orders/admin/${orderId}`,
      );
      return res.data.data;
    },
  });

  return {
    order: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load this order right now.')
      : null,
    reload: () => { void query.refetch(); },
  };
}

export function useTenantAdminDisputes(filters: TenantAdminDisputeFilters = {}) {
  const query = useQuery({
    queryKey: ['orders', 'tenant-admin', 'disputes', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);

      const qs = params.toString();
      const res = await apiClient.get<{ data: AdminDisputesResponse }>(
        qs ? `/orders/admin/disputes?${qs}` : '/orders/admin/disputes',
      );
      return res.data.data;
    },
  });

  return {
    metrics: query.data?.metrics ?? null,
    disputes: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load disputes right now.')
      : null,
    reload: () => { void query.refetch(); },
  };
}

export function useUpdateOrderNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, adminNotes }: { orderId: string; adminNotes: string }) => {
      const res = await apiClient.patch<{ message: string; data: OrderDetail }>(
        `/orders/admin/${orderId}/notes`,
        { adminNotes },
      );
      return res.data;
    },
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['orders', 'tenant-admin', 'detail', orderId] });
    },
  });
}

export function useReviewDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      action,
      resolutionNote,
    }: {
      orderId: string;
      action: string;
      resolutionNote?: string;
    }) => {
      const res = await apiClient.patch<{ message: string; data: OrderDetail }>(
        `/orders/admin/${orderId}/dispute`,
        { action, resolutionNote },
      );
      return res.data;
    },
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['orders', 'tenant-admin'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'tenant-admin', 'detail', orderId] });
    },
  });
}
