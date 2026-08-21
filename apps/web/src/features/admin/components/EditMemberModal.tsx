import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Select, Label } from '@/components/ui/Input';
import { useDepartmentsQuery, useRolesQuery, useUpdateUser } from '../hooks';
import { RoleCheckboxList } from './RoleCheckboxList';
import type { User } from '@/types';

export function EditMemberModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation();
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
    <Modal open={Boolean(user)} onClose={onClose} title={t('admin:editMemberModal.title', { fullName: user?.fullName ?? '' })}>
      <div className="space-y-4">
        {/* 28/07/2026: them htmlFor/id "edit-member-department" (phat hien qua ra soat kha nang tiep
            can) - Label truoc do khong tro toi Select nao ca, giong loi da sua o TaskDetailModal/
            ShareModal/NewTaskModal nhung bi sot trong modal nay; khop dung quy uoc id "<modal>-<truong>". */}
        <FormField label={t('admin:editMemberModal.departmentLabel')} htmlFor="edit-member-department">
          <Select id="edit-member-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">{t('admin:editMemberModal.noDepartmentOption')}</option>
            {(departmentsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div>
          <Label>{t('admin:editMemberModal.roleLabel')}</Label>
          <RoleCheckboxList roles={rolesQuery.data ?? []} selectedIds={roleIds} onChange={setRoleIds} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('admin:editMemberModal.cancel')}
          </Button>
          <Button
            type="button"
            isLoading={updateUser.isPending}
            onClick={() => {
              if (!user) return;
              updateUser.mutate({ id: user.id, payload: { departmentId: departmentId || null, roleIds } }, { onSuccess: onClose });
            }}
          >
            {t('admin:editMemberModal.saveChanges')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
