import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) => createCustomer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(t('crm:hooks.customer.createSuccess'));
    },
    onError: (error) => toast.error(t('crm:hooks.customer.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateCustomer(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateCustomerPayload>) => updateCustomer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success(t('crm:hooks.customer.updateSuccess'));
    },
    onError: (error) => toast.error(t('crm:hooks.customer.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteCustomer() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(t('crm:hooks.customer.deleteSuccess'));
    },
    onError: (error) => toast.error(t('crm:hooks.customer.deleteError'), extractErrorMessage(error)),
  });
}

export function useDealsQuery(customerId: string | undefined) {
  return useQuery({
    queryKey: ['deals', customerId],
    queryFn: () => fetchDeals({ customerId }),
    enabled: Boolean(customerId),
  });
}

export function useCreateDeal(customerId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CreateDealPayload, 'customerId'>) => createDeal({ customerId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success(t('crm:hooks.deal.createSuccess'));
    },
    onError: (error) => toast.error(t('crm:hooks.deal.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateDeal(customerId: string, dealId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<CreateDealPayload, 'customerId'>>) => updateDeal(dealId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', customerId] });
      toast.success(t('crm:hooks.deal.updateSuccess'));
    },
    onError: (error) => toast.error(t('crm:hooks.deal.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteDeal(customerId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dealId: string) => deleteDeal(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success(t('crm:hooks.deal.deleteSuccess'));
    },
    onError: (error) => toast.error(t('crm:hooks.deal.deleteError'), extractErrorMessage(error)),
  });
}

/** Cap nhat giai doan Kanban (keo-tha) - optimistic update, mirror useUpdateTaskStatus. */
export function useUpdateDealStage(customerId: string) {
  const { t } = useTranslation();
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
      toast.error(t('crm:hooks.deal.updateStageError'), extractErrorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
