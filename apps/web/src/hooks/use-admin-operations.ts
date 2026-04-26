'use client';

import { useQuery } from '@tanstack/react-query';
import { OrderStatus, UserRole } from '@zentry/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export interface AdminOverviewOrderItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string;
  cbtCommission: string;
  createdAt: string;
  disputeWindowExpiresAt: string | null;
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
  } | null;
}

interface AdminOperationsOverview {
  metrics: {
    totalTenants: number;
    totalIndividualUsers: number;
    approvedCbtCenters: number;
    totalTransactions: number;
    activeUsers: number;
    pendingPoolJobs: number;
    assignedJobs: number;
    inProgressJobs: number;
    completedJobs: number;
    awaitingRelease: number;
    readyForRelease: number;
  };
  scheduler: {
    disputeWindowHours: number;
    readyCount: number;
    awaitingCount: number;
    blockedCount: number;
    nextWindowExpiryAt: string | null;
    queueName: string;
    jobName: string;
  };
  previews: {
    availableJobs: AdminOverviewOrderItem[];
    readyForRelease: AdminOverviewOrderItem[];
    awaitingWindow: AdminOverviewOrderItem[];
  };
}

export interface AdminReleaseSchedulerCandidate {
  orderId: string;
  orderNumber: string;
  releaseState: 'NOT_READY' | 'AWAITING_WINDOW' | 'READY_FOR_RELEASE' | 'RELEASED';
  scheduledFor: string;
  delayMs: number;
  shouldEnqueueNow: boolean;
  blockedReasons: string[];
  jobId: string;
  queueName: string;
  jobName: string;
  payload: {
    orderId: string;
    orderNumber: string;
    requesterId: string;
    assignedCbtId: string | null;
    escrowLocked: string;
    cbtCommission: string;
    platformNet: string;
  };
}

interface AdminReleaseSchedulerPreview {
  queueName: string;
  jobName: string;
  summary: {
    readyCount: number;
    waitingCount: number;
    blockedCount: number;
  };
  readyCandidates: AdminReleaseSchedulerCandidate[];
  waitingCandidates: AdminReleaseSchedulerCandidate[];
  blockedCandidates: AdminReleaseSchedulerCandidate[];
}

export function useAdminOperationsOverview() {
  const query = useQuery({
    queryKey: ['orders', 'admin', 'overview'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminOperationsOverview }>(
        '/orders/admin/overview',
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
          'Could not load admin operations overview right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useAdminReleaseSchedulerPreview() {
  const query = useQuery({
    queryKey: ['orders', 'admin', 'release-scheduler-preview'] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data: AdminReleaseSchedulerPreview }>(
        '/orders/admin/release-scheduler-preview',
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
          'Could not load the release scheduler preview right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
