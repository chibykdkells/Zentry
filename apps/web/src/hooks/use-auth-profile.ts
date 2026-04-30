'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@zendocx/types';

export interface AuthProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  hasWalletPin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  wallet?: {
    availableBalance: string;
    escrowBalance: string;
    totalEarned: string;
    totalWithdrawn: string;
  } | null;
  cbtProfile?: {
    centerName: string;
    approvalStatus: string;
    isOnline: boolean;
  } | null;
}

export const AUTH_PROFILE_QUERY_KEY = ['auth', 'profile'] as const;

export function useAuthProfile() {
  const updateUser = useAuthStore((state) => state.updateUser);
  const accessToken = useAuthStore((state) => state.accessToken);

  const query = useQuery({
    queryKey: AUTH_PROFILE_QUERY_KEY,
    enabled: !!accessToken,
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ data: AuthProfile }>('/users/me');
        return response.data.data;
      } catch (error: unknown) {
        const maybeError = error as {
          response?: { status?: number; data?: { message?: string } };
        };

        const isMissingUsersRoute =
          maybeError.response?.status === 404 ||
          maybeError.response?.data?.message === 'Cannot GET /api/v1/users/me';

        if (!isMissingUsersRoute) {
          throw error;
        }

        const fallbackResponse = await apiClient.get<{ data: AuthProfile }>(
          '/auth/me',
        );
        return fallbackResponse.data.data;
      }
    },
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    updateUser({
      firstName: query.data.firstName,
      lastName: query.data.lastName,
      email: query.data.email,
      role: query.data.role,
      isEmailVerified: query.data.isEmailVerified,
    });
  }, [query.data, updateUser]);

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? getApiErrorMessage(
          query.error,
          'Could not load your account information right now.',
        )
      : null,
    reload: () => {
      void query.refetch();
    },
  };
}
