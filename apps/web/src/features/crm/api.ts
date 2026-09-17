import { apiClient } from '@/lib/api-client';
import type { Customer, Deal, DealStage, PaginatedResponse } from '@/types';

export interface FetchCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function fetchCustomers(params: FetchCustomersParams = {}): Promise<PaginatedResponse<Customer>> {
  const { data } = await apiClient.get<PaginatedResponse<Customer>>('/customers', { params });
  return data;
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const { data } = await apiClient.get<Customer>(`/customers/${id}`);
  return data;
}

export interface CreateCustomerPayload {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  const { data } = await apiClient.post<Customer>('/customers', payload);
  return data;
}

// 17/09/2026: PATCH /customers/:id gio nhan them ownerUserId (tuy chon) de doi nguoi phu trach
// khach hang (CustomerDetailPage.tsx) - rieng UpdateCustomerDto (BE), KHONG co o CreateCustomerDto
// (nguoi phu trach ban dau do BE tu gan luc tao, khong chon duoc qua form tao moi) nen tach thanh
// kieu rieng thay vi nhet vao CreateCustomerPayload. BE da xac thuc PERMISSIONS.CUSTOMER_UPDATE
// truoc khi cho goi ca endpoint nay (khong rieng truong ownerUserId).
export type UpdateCustomerPayload = Partial<CreateCustomerPayload> & { ownerUserId?: string };

export async function updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<Customer> {
  const { data } = await apiClient.patch<Customer>(`/customers/${id}`, payload);
  return data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}

export interface FetchDealsParams {
  customerId?: string;
  stage?: DealStage;
  limit?: number;
}

export async function fetchDeals(params: FetchDealsParams = {}): Promise<Deal[]> {
  const { data } = await apiClient.get<PaginatedResponse<Deal>>('/deals', { params: { limit: 500, ...params } });
  return data.data;
}

export interface CreateDealPayload {
  customerId: string;
  title: string;
  value?: number;
  expectedCloseDate?: string;
}

export async function createDeal(payload: CreateDealPayload): Promise<Deal> {
  const { data } = await apiClient.post<Deal>('/deals', payload);
  return data;
}

export async function updateDeal(id: string, payload: Partial<Omit<CreateDealPayload, 'customerId'>>): Promise<Deal> {
  const { data } = await apiClient.patch<Deal>(`/deals/${id}`, payload);
  return data;
}

export async function deleteDeal(id: string): Promise<void> {
  await apiClient.delete(`/deals/${id}`);
}

export async function updateDealStage(id: string, stage: DealStage): Promise<Deal> {
  const { data } = await apiClient.patch<Deal>(`/deals/${id}/stage`, { stage });
  return data;
}
