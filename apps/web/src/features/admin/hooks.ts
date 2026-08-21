import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  createDepartment,
  deactivateUser,
  deleteDepartment,
  fetchDepartments,
  fetchFailedEvents,
  fetchPermissions,
  fetchRoles,
  fetchUsers,
  inviteUser,
  reactivateUser,
  updateDepartment,
  updateRolePermissions,
  updateUser,
} from './api';
import type { InviteUserPayload, UpdateUserPayload } from './api';

export function useUsersQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['admin', 'users', params], queryFn: () => fetchUsers(params) });
}

export function useInviteUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success(t('admin:toast.memberInvited'));
    },
    onError: (error) => toast.error(t('admin:toast.memberInviteFailed'), extractErrorMessage(error)),
  });
}

export function useUpdateUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) => updateUser(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      // 22/07/2026: sua loi thuc te - onSuccess truoc day khong invalidate ['users', id], dung
      // KHOP CHINH XAC voi queryKey cua useMyProfileQuery() (features/profile/hooks.ts). Ket qua:
      // admin tu sua phong ban/vai tro cua CHINH MINH qua Quan tri > Thanh vien thi trang Ho so
      // ca nhan van hien du lieu cu (stale) tu cache cho toi khi refetch tu nhien xay ra. Them
      // dong nay de cache profile duoc lam moi ngay sau khi sua.
      queryClient.invalidateQueries({ queryKey: ['users', variables.id] });
      toast.success(t('admin:toast.memberUpdated'));
    },
    onError: (error) => toast.error(t('admin:toast.memberUpdateFailed'), extractErrorMessage(error)),
  });
}

export function useDeactivateUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success(t('admin:toast.memberDeactivated'));
    },
    onError: (error) => toast.error(t('admin:toast.memberDeactivateFailed'), extractErrorMessage(error)),
  });
}

// 22/07/2026 (review toan du an): hook moi cho PATCH /users/:id/reactivate - xem ghi chu tai
// reactivateUser() (admin/api.ts) ve ly do bo sung.
export function useReactivateUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success(t('admin:toast.memberReactivated'));
    },
    onError: (error) => toast.error(t('admin:toast.memberReactivateFailed'), extractErrorMessage(error)),
  });
}

export function useDepartmentsQuery() {
  return useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
}

export function useCreateDepartment() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string }) => createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(t('admin:toast.departmentCreated'));
    },
    onError: (error) => toast.error(t('admin:toast.departmentCreateFailed'), extractErrorMessage(error)),
  });
}

export function useUpdateDepartment() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; description?: string } }) => updateDepartment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(t('admin:toast.departmentUpdated'));
    },
    onError: (error) => toast.error(t('admin:toast.departmentUpdateFailed'), extractErrorMessage(error)),
  });
}

export function useDeleteDepartment() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(t('admin:toast.departmentDeleted'));
    },
    onError: (error) => toast.error(t('admin:toast.departmentDeleteFailed'), extractErrorMessage(error)),
  });
}

export function useRolesQuery() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles });
}

export function usePermissionsQuery() {
  return useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions });
}

export function useUpdateRolePermissions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) => updateRolePermissions(roleId, permissionKeys),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    onError: (error) => toast.error(t('admin:toast.permissionsUpdateFailed'), extractErrorMessage(error)),
  });
}

// 28/07/2026: hook cho GET /failed-events (Dead Letter Queue) - xem ghi chu tai fetchFailedEvents
// (admin/api.ts). Chi doc, khong co mutation di kem (khong co hanh dong "thu lai/replay").
export function useFailedEventsQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['admin', 'failed-events', params], queryFn: () => fetchFailedEvents(params) });
}
