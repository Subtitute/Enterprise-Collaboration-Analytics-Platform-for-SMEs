import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Label } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
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

  const isPending = updateUser.isPending;

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      // 26/08/2026: chuyen guard "khong cho dong modal khi dang co mutation pending" (viet tay hom
      // qua ngay trong handleClose cua file nay) sang prop dung chung preventCloseWhilePending cua
      // Modal.tsx - ly do goc van vay (mutation cu van chay ngam sau khi dong+mo lai modal cho user
      // khac, xem Modal.tsx de biet chi tiet), chi khac la gio Modal tu chan ca 3 duong dong thay
      // vi tung modal phai tu viet lai.
      preventCloseWhilePending={isPending}
      title={t('admin:editMemberModal.title', { fullName: user?.fullName ?? '' })}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-member-department">{t('admin:editMemberModal.departmentLabel')}</Label>
          <CustomFilterSelect
            value={departmentId}
            onChange={setDepartmentId}
            ariaLabel={t('admin:editMemberModal.departmentLabel')}
            options={[
              { value: '', label: t('admin:editMemberModal.noDepartmentOption') },
              ...(departmentsQuery.data ?? []).map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
          />
        </div>
        <div>
          <Label>{t('admin:editMemberModal.roleLabel')}</Label>
          <RoleCheckboxList roles={rolesQuery.data ?? []} selectedIds={roleIds} onChange={setRoleIds} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[13px] font-medium text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('admin:editMemberModal.cancel')}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!user) return;
              updateUser.mutate({ id: user.id, payload: { departmentId: departmentId || null, roleIds } }, { onSuccess: onClose });
            }}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPending ? t('common:loading', 'Đang xử lý...') : t('admin:editMemberModal.saveChanges')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
