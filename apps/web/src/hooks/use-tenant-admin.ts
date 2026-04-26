'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole } from '@zentry/types';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { useTenantStore } from '@/stores/tenant.store';

export const TENANT_ADMIN_OVERVIEW_QUERY_KEY = ['tenant-admin', 'overview'] as const;

export interface TenantAdminOverview {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    textColor: string;
    buttonColor: string;
    fontStyle: string;
    customDomain: string | null;
  };
  metrics: {
    totalUsers: number;
    individualUsers: number;
    cbtUsers: number;
    activeOrders: number;
    completedOrders: number;
    disputedOrders: number;
    heldFunds: string;
    availableBalance: string;
    awaitingReleaseCount: number;
    readyReleaseCount: number;
    blockedReleaseCount: number;
  };
  recentUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string | null;
  }>;
  releaseQueue: Array<{
    id: string;
    orderNumber: string;
    cbtCommission: string;
    releaseState: 'AWAITING_WINDOW' | 'READY' | 'BLOCKED';
    disputeWindowExpiresAt: string | null;
    service: {
      id: string;
      name: string;
      slug: string;
    };
    requester: {
      id: string;
      name: string;
      email: string;
    };
    assignedCbt: {
      id: string;
      name: string;
      email: string;
    } | null;
    dispute: {
      id: string;
      status: string;
      reason: string;
    } | null;
  }>;
}

export interface TenantAdminUserListItem {
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

export interface TenantAdminUsersResponse {
  users: TenantAdminUserListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TenantAdminUserMutationResponse {
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

export interface TenantAdminUsersFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | 'ALL';
}

export interface UpdateTenantSettingsInput {
  name?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  buttonColor?: string;
  fontStyle?: 'modern' | 'classic' | 'clean';
  customDomain?: string | null;
}

export const getTenantUsersQueryKey = (filters: TenantAdminUsersFilters) =>
  ['tenant-admin', 'users', filters] as const;

export function useTenantOverview() {
  const query = useQuery({
    queryKey: TENANT_ADMIN_OVERVIEW_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: TenantAdminOverview }>('/tenants/me');
      return response.data.data;
    },
  });

  return {
    overview: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(query.error, 'Could not load tenant overview right now.')
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function useTenantUsers(filters: TenantAdminUsersFilters) {
  const query = useQuery({
    queryKey: getTenantUsersQueryKey(filters),
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.role && filters.role !== 'ALL') params.set('role', filters.role);

      const response = await apiClient.get<{ data: TenantAdminUsersResponse }>(
        params.toString() ? `/tenants/me/users?${params.toString()}` : '/tenants/me/users',
      );
      return response.data.data;
    },
  });

  return {
    users: query.data?.users ?? [],
    pagination: query.data
      ? {
          page: query.data.page,
          limit: query.data.limit,
          total: query.data.total,
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

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient();
  const setTenant = useTenantStore((state) => state.setTenant);

  return useMutation({
    mutationFn: async (payload: UpdateTenantSettingsInput) => {
      const response = await apiClient.patch<{ data: TenantAdminOverview['tenant'] }>(
        '/tenants/me',
        payload,
      );
      return response.data.data;
    },
    onSuccess: async (updatedTenant) => {
      setTenant(updatedTenant);
      await queryClient.invalidateQueries({
        queryKey: TENANT_ADMIN_OVERVIEW_QUERY_KEY,
      });
      await queryClient.invalidateQueries({
        queryKey: ['tenant-bootstrap'],
      });
    },
  });
}

export function useUploadTenantLogo() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<{
        data: { url: string; publicId: string };
      }>('/tenants/me/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data;
    },
  });
}

export function useUpdateTenantUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { userId: string; role: UserRole }) => {
      const response = await apiClient.patch<{
        data: TenantAdminUserMutationResponse;
      }>(`/tenants/me/users/${payload.userId}/role`, { role: payload.role });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tenant-admin', 'users'],
      });
      await queryClient.invalidateQueries({
        queryKey: TENANT_ADMIN_OVERVIEW_QUERY_KEY,
      });
    },
  });
}

export function useDeleteTenantUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.delete<{ data: { id: string } }>(
        `/tenants/me/users/${userId}`,
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tenant-admin', 'users'],
      });
      await queryClient.invalidateQueries({
        queryKey: TENANT_ADMIN_OVERVIEW_QUERY_KEY,
      });
    },
  });
}
