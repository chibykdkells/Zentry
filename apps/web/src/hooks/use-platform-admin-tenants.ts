'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole } from '@zendocx/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export interface PlatformAdminTenantSummary {
  totalTenants: number;
  totalUsers: number;
  totalIndividuals: number;
  totalCbtUsers: number;
  totalAdmins: number;
}

export interface PlatformAdminTenantListItem {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  isActive: boolean;
  createdAt: string;
  metrics: {
    totalUsers: number;
    individualUsers: number;
    cbtUsers: number;
    tenantAdmins: number;
    totalOrders: number;
    totalTransactions: number;
    availableBalance: string;
    heldFunds: string;
  };
  signupLinks: {
    individual: string;
    cbt: string;
  };
  tenantAdminAccesses: PlatformAdminTenantAdminAccessRecord[];
}

export interface PlatformAdminTenantAdminAccessRecord {
  id: string;
  email: string;
  tempPassword: string;
  createdAt: string;
  updatedAt: string;
  lastResetAt: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface PlatformAdminTenantsResponse {
  summary: PlatformAdminTenantSummary;
  tenants: PlatformAdminTenantListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PlatformAdminTenantsFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PlatformAdminTenantUserListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface PlatformAdminTenantUsersResponse {
  users: PlatformAdminTenantUserListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlatformAdminTenantUsersFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | 'ALL';
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  customDomain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  tenantMarginRate?: number;
}

export interface CreateTenantAdminInput {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface PlatformAdminTenantAdminAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  tenantId: string | null;
  tempPassword: string;
}

export function usePlatformAdminTenants(filters: PlatformAdminTenantsFilters) {
  const query = useQuery({
    queryKey: ['platform-admin', 'tenants', filters] as const,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());

      const response = await apiClient.get<{ data: PlatformAdminTenantsResponse }>(
        params.toString() ? `/tenants?${params.toString()}` : '/tenants',
      );
      return response.data.data;
    },
  });

  return {
    summary: query.data?.summary ?? null,
    tenants: query.data?.tenants ?? [],
    meta: query.data
      ? {
          total: query.data.total,
          page: query.data.page,
          limit: query.data.limit,
        }
      : null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load tenants right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function usePlatformAdminTenantUsers(
  tenantId: string | null,
  filters: PlatformAdminTenantUsersFilters,
  options?: { enabled?: boolean },
) {
  const query = useQuery({
    queryKey: ['platform-admin', 'tenant-users', tenantId, filters] as const,
    enabled: Boolean(tenantId) && (options?.enabled !== false),
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.role && filters.role !== 'ALL') params.set('role', filters.role);

      const response = await apiClient.get<{ data: PlatformAdminTenantUsersResponse }>(
        params.toString()
          ? `/tenants/${tenantId}/users?${params.toString()}`
          : `/tenants/${tenantId}/users`,
      );
      return response.data.data;
    },
  });

  return {
    users: query.data?.users ?? [],
    meta: query.data
      ? {
          total: query.data.total,
          page: query.data.page,
          limit: query.data.limit,
          totalPages: query.data.totalPages,
        }
      : null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load tenant users right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTenantInput) => {
      const response = await apiClient.post<{ data: PlatformAdminTenantListItem }>(
        '/tenants',
        payload,
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['platform-admin', 'tenants'],
      });
    },
  });
}

export function useCreateTenantAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      ...payload
    }: CreateTenantAdminInput) => {
      const response = await apiClient.post<{
        data: PlatformAdminTenantAdminAccount;
      }>(`/tenants/${tenantId}/admins`, payload);
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenants'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenant-users', variables.tenantId],
        }),
      ]);
    },
  });
}

export function useResetTenantAdminPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      userId,
    }: {
      tenantId: string;
      userId: string;
    }) => {
      const response = await apiClient.post<{
        data: PlatformAdminTenantAdminAccount;
      }>(`/tenants/${tenantId}/admins/${userId}/reset-password`);
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenants'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenant-users', variables.tenantId],
        }),
      ]);
    },
  });
}

export function useToggleTenantUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      userId,
    }: {
      tenantId: string;
      userId: string;
    }) => {
      const response = await apiClient.patch<{
        data: { id: string; isActive: boolean };
      }>(`/tenants/${tenantId}/users/${userId}/active`);
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['platform-admin', 'tenant-users', variables.tenantId],
      });
    },
  });
}

export function useDeleteTenantUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      userId,
    }: {
      tenantId: string;
      userId: string;
    }) => {
      const response = await apiClient.delete<{ data: { id: string } }>(
        `/tenants/${tenantId}/users/${userId}`,
      );
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenants'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenant-users', variables.tenantId],
        }),
      ]);
    },
  });
}

export function useDismissTenantAdminAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      accessId,
    }: {
      tenantId: string;
      accessId: string;
    }) => {
      const response = await apiClient.patch<{
        data: { id: string };
      }>(`/tenants/${tenantId}/admin-access/${accessId}/dismiss`);
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenants'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['platform-admin', 'tenant-users', variables.tenantId],
        }),
      ]);
    },
  });
}
