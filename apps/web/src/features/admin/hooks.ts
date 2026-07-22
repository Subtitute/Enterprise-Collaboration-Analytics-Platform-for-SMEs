import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  createDepartment,
  deactivateUser,
  deleteDepartment,
  fetchDepartments,
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success('Đã mời thành viên mới');
    },
    onError: (error) => toast.error('Không thể mời thành viên', extractErrorMessage(error)),
  });
}

export function useUpdateUser() {
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
      toast.success('Đã cập nhật thành viên');
    },
    onError: (error) => toast.error('Không thể cập nhật thành viên', extractErrorMessage(error)),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success('Đã vô hiệu hoá tài khoản');
    },
    onError: (error) => toast.error('Không thể vô hiệu hoá tài khoản', extractErrorMessage(error)),
  });
}

// 22/07/2026 (review toan du an): hook moi cho PATCH /users/:id/reactivate - xem ghi chu tai
// reactivateUser() (admin/api.ts) ve ly do bo sung.
export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success('Đã kích hoạt lại tài khoản');
    },
    onError: (error) => toast.error('Không thể kích hoạt lại tài khoản', extractErrorMessage(error)),
  });
}

export function useDepartmentsQuery() {
  return useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string }) => createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Đã tạo phòng ban mới');
    },
    onError: (error) => toast.error('Không thể tạo phòng ban', extractErrorMessage(error)),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; description?: string } }) => updateDepartment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Đã cập nhật phòng ban');
    },
    onError: (error) => toast.error('Không thể cập nhật phòng ban', extractErrorMessage(error)),
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Đã xoá phòng ban');
    },
    onError: (error) => toast.error('Không thể xoá phòng ban', extractErrorMessage(error)),
  });
}

export function useRolesQuery() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles });
}

export function usePermissionsQuery() {
  return useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) => updateRolePermissions(roleId, permissionKeys),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    onError: (error) => toast.error('Không thể cập nhật quyền', extractErrorMessage(error)),
  });
}
