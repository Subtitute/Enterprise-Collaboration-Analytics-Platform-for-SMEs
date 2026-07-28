import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Select, Label } from '@/components/ui/Input';
import { useDepartmentsQuery, useRolesQuery, useUpdateUser } from '../hooks';
import { RoleCheckboxList } from './RoleCheckboxList';
import type { User } from '@/types';

export function EditMemberModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [departmentId, setDepartmentId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const departmentsQuery = useDepartmentsQuery();
  const rolesQuery = useRolesQuery();
  const updateUser = useUpdateUser();

  useEffect(() => {
    setDepartmentId(user?.departmentId ?? '');
    setRoleIds((user?.roles ?? []).map((r) => r.id));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={Boolean(user)} onClose={onClose} title={`Chỉnh sửa — ${user?.fullName ?? ''}`}>
      <div className="space-y-4">
        {/* 28/07/2026: them htmlFor/id "edit-member-department" (phat hien qua ra soat kha nang tiep
            can) - Label truoc do khong tro toi Select nao ca, giong loi da sua o TaskDetailModal/
            ShareModal/NewTaskModal nhung bi sot trong modal nay; khop dung quy uoc id "<modal>-<truong>". */}
        <FormField label="Phòng ban" htmlFor="edit-member-department">
          <Select id="edit-member-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">— Không thuộc phòng ban —</option>
            {(departmentsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div>
          <Label>Vai trò</Label>
          <RoleCheckboxList roles={rolesQuery.data ?? []} selectedIds={roleIds} onChange={setRoleIds} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            isLoading={updateUser.isPending}
            onClick={() => {
              if (!user) return;
              updateUser.mutate({ id: user.id, payload: { departmentId: departmentId || null, roleIds } }, { onSuccess: onClose });
            }}
          >
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </Modal>
  );
}
