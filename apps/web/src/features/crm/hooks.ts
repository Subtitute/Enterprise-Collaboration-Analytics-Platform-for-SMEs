import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import type { Deal, DealStage } from '@/types';
import {
  createCustomer,
  createDeal,
  deleteCustomer,
  deleteDeal,
  fetchCustomer,
  fetchCustomers,
  fetchDeals,
  updateCustomer,
  updateDeal,
  updateDealStage,
} from './api';
import type { CreateCustomerPayload, CreateDealPayload, FetchCustomersParams } from './api';

export function useCustomersQuery(params: FetchCustomersParams = {}) {
  return useQuery({ queryKey: ['customers', params], queryFn: () => fetchCustomers(params) });
}

export function useCustomerQuery(id: string | undefined) {
  return useQuery({ queryKey: ['customer', id], queryFn: () => fetchCustomer(id as string), enabled: Boolean(id) });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) => createCustomer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Đã tạo khách hàng mới');
    },
    onError: (error) => toast.error('Không thể tạo khách hàng', extractErrorMessage(error)),
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateCustomerPayload>) => updateCustomer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('Đã cập nhật khách hàng');
    },
    onError: (error) => toast.error('Không thể cập nhật khách hàng', extractErrorMessage(error)),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Đã xoá khách hàng');
    },
    onError: (error) => toast.error('Không thể xoá khách hàng', extractErrorMessage(error)),
  });
}

/** Toan bo deal cua to chuc (khong loc customerId) - dung de dem so deal dang hoat dong tren
 *  danh sach khach hang ma khong phai goi API rieng cho tung khach hang (tranh N+1), mirror
 *  useAllTasksQuery (features/projects/hooks.ts). */
export function useAllDealsQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['deals', 'all'], queryFn: () => fetchDeals({}), staleTime: 60_000, enabled: options?.enabled });
}

export function useDealsQuery(customerId: string | undefined) {
  return useQuery({
    queryKey: ['deals', customerId],
    queryFn: () => fetchDeals({ customerId }),
    enabled: Boolean(customerId),
  });
}

export function useCreateDeal(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CreateDealPayload, 'customerId'>) => createDeal({ customerId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success('Đã tạo deal mới');
    },
    onError: (error) => toast.error('Không thể tạo deal', extractErrorMessage(error)),
  });
}

export function useUpdateDeal(customerId: string, dealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<CreateDealPayload, 'customerId'>>) => updateDeal(dealId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', customerId] });
      toast.success('Đã lưu thay đổi deal');
    },
    onError: (error) => toast.error('Không thể cập nhật deal', extractErrorMessage(error)),
  });
}

export function useDeleteDeal(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dealId: string) => deleteDeal(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success('Đã xoá deal');
    },
    onError: (error) => toast.error('Không thể xoá deal', extractErrorMessage(error)),
  });
}

/** Cap nhat giai doan Kanban (keo-tha) - optimistic update, mirror useUpdateTaskStatus. */
export function useUpdateDealStage(customerId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['deals', customerId];

  return useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: DealStage }) => updateDealStage(dealId, stage),
    onMutate: async ({ dealId, stage }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Deal[]>(queryKey);
      queryClient.setQueryData<Deal[]>(queryKey, (old) => (old ?? []).map((d) => (d.id === dealId ? { ...d, stage } : d)));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error('Không thể cập nhật giai đoạn deal', extractErrorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
