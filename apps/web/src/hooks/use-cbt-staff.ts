import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface CbtStaff {
  membershipId: string;
  joinedAt: string;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateCbtStaffPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export function useCbtStaff() {
  return useQuery({
    queryKey: ['cbt', 'staff'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CbtStaff[] }>('/cbt/staff');
      return res.data.data;
    },
  });
}

export function useCreateCbtStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCbtStaffPayload) => {
      const res = await apiClient.post<{ data: CbtStaff }>('/cbt/staff', payload);
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cbt', 'staff'] });
    },
  });
}

export function useDeleteCbtStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staffId: string) => {
      await apiClient.delete(`/cbt/staff/${staffId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cbt', 'staff'] });
    },
  });
}
