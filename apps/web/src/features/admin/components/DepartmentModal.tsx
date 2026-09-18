import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
// 17/09/2026: import truc tiep submodule (khong qua barrel '@app/common-dto') bang `import * as`
// (namespace, khong phai named import) - xem ghi chu chi tiet tai lib/utils.ts (barrel keo theo
// DTO dung class-transformer, throw Reflect.getMetadata is not a function; named import tu deep
// import CJS lam Rollup build that bai "not exported by ...").
import * as PermissionEnum from '@app/common-dto/dist/enums/permission.enum';
import { usePermissions } from '@/stores/auth.store';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Input';
import { useCreateDepartment, useUpdateDepartment } from '../hooks';
import type { Department } from '@/types';

const { PERMISSIONS } = PermissionEnum;

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
          <FormField
            label={t('admin:departmentModal.managerLabel')}
            htmlFor="department-manager"
            hint={!isEditing || departmentUsers.length === 0 ? t('admin:departmentModal.managerHintNoMembers') : undefined}
          >
            <Select
              id="department-manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              disabled={!isEditing || departmentUsers.length === 0}
            >
              <option value="">{t('admin:departmentModal.noManagerOption')}</option>
              {departmentUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t('admin:departmentModal.cancel')}
          </Button>
          <Button type="submit" isLoading={isPending}>
            {isEditing ? t('admin:departmentModal.saveChanges') : t('admin:departmentModal.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
