import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
// 17/09/2026: import truc tiep submodule (khong qua barrel '@app/common-dto') bang `import * as`
// (namespace, khong phai named import) - xem ghi chu chi tiet tai lib/utils.ts (barrel keo theo
// DTO dung class-transformer, throw Reflect.getMetadata is not a function; named import tu deep
// import CJS lam Rollup build that bai "not exported by ...").
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useCreateDepartment, useUpdateDepartment } from '../hooks';
import type { Department } from '@/types';

export function DepartmentModal({
  open,
  onClose,
  department,
}: {
  open: boolean;
  onClose: () => void;
  department?: Department | null;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [error, setError] = useState('');
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const isEditing = Boolean(department);

  // 17/09/2026: chi Org Admin (DEPARTMENT_MANAGE) moi mo duoc modal nay (nut Them/Sua o
  // DepartmentsPage.tsx da an voi Manager), nhung van kiem tra lai o day cho chac chan - truong
  // chon Truong bo phan chi hien/bat khi that su co quyen doi co cau phong ban.
  const permissions = usePermissions();
  const canManageDepartments = permissions.includes(PERMISSIONS.DEPARTMENT_MANAGE);

  const orgUsersQuery = useOrgUsersQuery();
  // Truong bo phan phai la thanh vien CUA CHINH phong ban dang sua - phong ban moi tao chua co
  // thanh vien nao (department.id chua ton tai) nen danh sach luon rong trong truong hop do.
  const departmentUsers = useMemo(
    () => (department ? (orgUsersQuery.data ?? []).filter((u) => u.departmentId === department.id) : []),
    [orgUsersQuery.data, department],
  );

  useEffect(() => {
    if (open) {
      setName(department?.name ?? '');
      setDescription(department?.description ?? '');
      setManagerId(department?.managerId ?? '');
      setError('');
    }
  }, [open, department]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('admin:departmentModal.nameRequiredError'));
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      ...(canManageDepartments ? { managerId: managerId || null } : {}),
    };
    if (isEditing && department) {
      updateDepartment.mutate({ id: department.id, payload }, { onSuccess: onClose });
    } else {
      createDepartment.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = createDepartment.isPending || updateDepartment.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      // 26/08/2026: chuyen guard "khong cho dong modal khi dang co mutation pending" (viet tay hom
      // qua ngay trong handleClose cua file nay) sang prop dung chung preventCloseWhilePending cua
      // Modal.tsx - ly do goc van vay (mutation cu van chay ngam sau khi dong+mo lai modal, xem
      // Modal.tsx de biet chi tiet), chi khac la gio Modal tu chan ca 3 duong dong thay vi tung
      // modal phai tu viet lai.
      preventCloseWhilePending={isPending}
      title={isEditing ? t('admin:departmentModal.editTitle') : t('admin:departmentModal.createTitle')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('admin:departmentModal.nameLabel')} htmlFor="department-name" error={error} required>
          <Input
            id="department-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('admin:departmentModal.namePlaceholder')}
          />
        </FormField>
        <FormField label={t('admin:departmentModal.descriptionLabel')} htmlFor="department-description">
          <Textarea id="department-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        {/* 17/09/2026: chi Org Admin (DEPARTMENT_MANAGE) moi thay/doi Truong bo phan - danh sach
            chi gom thanh vien CUA CHINH phong ban dang sua (department.managerId, backend da
            validate lai gia tri nay thuoc ve to chuc). Phong ban moi tao chua co thanh vien nao
            nen truong nay tam thoi rong/vo hieu hoa cho toi khi da co it nhat 1 thanh vien. */}
        {canManageDepartments && (
          <div className="space-y-1.5">
            <label htmlFor="department-manager" className="block text-xs font-semibold text-text-secondary">
              {t('admin:departmentModal.managerLabel')}
            </label>
            <CustomFilterSelect
              value={managerId}
              onChange={setManagerId}
              ariaLabel={t('admin:departmentModal.managerLabel')}
              options={[
                { value: '', label: t('admin:departmentModal.noManagerOption') },
                ...departmentUsers.map((u) => ({
                  value: u.id,
                  label: u.fullName,
                })),
              ]}
            />
            {(!isEditing || departmentUsers.length === 0) && (
              <p className="text-xs text-text-tertiary">{t('admin:departmentModal.managerHintNoMembers')}</p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[13px] font-medium text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('admin:departmentModal.cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPending
              ? t('common:loading', 'Đang xử lý...')
              : isEditing
              ? t('admin:departmentModal.saveChanges')
              : t('admin:departmentModal.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
