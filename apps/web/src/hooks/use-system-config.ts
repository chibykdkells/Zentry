'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';

export const SYSTEM_CONFIG_QUERY_KEY = ['system-config'] as const;

export interface SystemConfigEntry {
  key: string;
  value: string;
  description: string;
  updatedAt: string | null;
  isPersisted: boolean;
}

export function useSystemConfig() {
  const query = useQuery({
    queryKey: SYSTEM_CONFIG_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<{ data: SystemConfigEntry[] }>('/system-config');
      return res.data.data;
    },
  });

  return {
    configs: query.data ?? [],
    loading: query.isLoading,
    error: query.isError
      ? getApiErrorMessage(query.error, 'Failed to load system config')
      : null,
    reload: query.refetch,
  };
}

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiClient.put(`/system-config/${key}`, { value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SYSTEM_CONFIG_QUERY_KEY });
    },
  });
}
