import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, PasswordInput, Label } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { EMPLOYEE_CODE_RE, normalizeVietnamesePhone } from '@/lib/phone';
import { useDepartmentsQuery, useInviteUser, useRolesQuery } from '../hooks';
import { RoleCheckboxList } from './RoleCheckboxList';

// 26/10/2026: mat khau KHONG con bat buoc (Technical_Spec.md muc 27.9, Q7) - de trong thi he thong gui
// email kich hoat (khong chua mat khau). Org Admin nhap them so dien thoai/ma nhan vien; Manager moi
// thi phong ban bi khoa ve phong cua minh (server cung ep lai).

export function InviteMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canManageUsers = usePermissions().includes(PERMISSIONS.USER_MANAGE);
  const myDepartmentId = useAuthStore((s) => s.user?.departmentId ?? null);
  const departmentLocked = !canManageUsers && Boolean(myDepartmentId);

  const departmentsQuery = useDepartmentsQuery();
  const rolesQuery = useRolesQuery();
  const inviteUser = useInviteUser();

  function reset() {
    setEmail('');
    setFullName('');
    setInitialPassword('');
    setDepartmentId('');
    setRoleIds([]);
    setPhoneNumber('');
    setEmployeeCode('');
    setErrors({});
  }

  // 26/08/2026: bo nhanh kiem tra "if (inviteUser.isPending) return" o day - gio Modal.tsx tu chan
  // ca 3 duong dong (nut X, Escape, click ra ngoai overlay) qua prop preventCloseWhilePending
  // truyen ben duoi, nen handleClose CHI con lo phan rieng cua modal nay: reset() du lieu form
  // truoc khi dong (ly do can chan dong khi pending van giu nguyen - xem Modal.tsx).
  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = t('admin:inviteMemberModal.errors.emailRequired');
    if (!fullName.trim()) next.fullName = t('admin:inviteMemberModal.errors.fullNameRequired');
    if (initialPassword && initialPassword.length < 8) next.initialPassword = t('admin:inviteMemberModal.errors.passwordMinLength');
    const normalizedPhone = phoneNumber.trim() ? normalizeVietnamesePhone(phoneNumber) : null;
    if (phoneNumber.trim() && !normalizedPhone) next.phoneNumber = t('errors:PHONE_INVALID');
    if (employeeCode.trim() && !EMPLOYEE_CODE_RE.test(employeeCode.trim())) next.employeeCode = t('errors:EMPLOYEE_CODE_INVALID');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    inviteUser.mutate(
      {
        email: email.trim(),
        fullName: fullName.trim(),
        initialPassword: initialPassword || undefined,
        departmentId: departmentLocked ? (myDepartmentId as string) : departmentId || undefined,
        roleIds: roleIds.length > 0 ? roleIds : undefined,
        phoneNumber: canManageUsers && normalizedPhone ? normalizedPhone : undefined,
        employeeCode: canManageUsers && employeeCode.trim() ? employeeCode.trim() : undefined,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={inviteUser.isPending}
      title={t('admin:inviteMemberModal.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('admin:inviteMemberModal.emailLabel')} htmlFor="invite-email" error={errors.email} required>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('admin:inviteMemberModal.emailPlaceholder')}
          />
        </FormField>
        <FormField label={t('admin:inviteMemberModal.fullNameLabel')} htmlFor="invite-fullname" error={errors.fullName} required>
          <Input
            id="invite-fullname"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('admin:inviteMemberModal.fullNamePlaceholder')}
          />
        </FormField>
        <FormField
          label={t('admin:inviteMemberModal.passwordLabel')}
          htmlFor="invite-password"
          error={errors.initialPassword}
          hint={t('admin:inviteMemberModal.passwordOptionalHint')}
        >
          <PasswordInput
            id="invite-password"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            placeholder={t('admin:inviteMemberModal.passwordPlaceholder')}
          />
        </FormField>
        {canManageUsers && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t('admin:inviteMemberModal.phoneLabel')} htmlFor="invite-phone" error={errors.phoneNumber}>
              <Input id="invite-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} inputMode="tel" />
            </FormField>
            <FormField label={t('admin:inviteMemberModal.employeeCodeLabel')} htmlFor="invite-code" error={errors.employeeCode}>
              <Input id="invite-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} className="font-mono" />
            </FormField>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="invite-department">{t('admin:inviteMemberModal.departmentLabel')}</Label>
          {departmentLocked ? (
            <p className="flex h-9 items-center rounded-radius-sm border border-border-strong bg-bg-muted px-3 text-[13px] text-text-secondary">
              {(departmentsQuery.data ?? []).find((d) => d.id === myDepartmentId)?.name ?? '—'}
            </p>
          ) : (
          <CustomFilterSelect
            value={departmentId}
            onChange={setDepartmentId}
            ariaLabel={t('admin:inviteMemberModal.departmentLabel')}
            options={[
              { value: '', label: t('admin:inviteMemberModal.noDepartmentOption') },
              ...(departmentsQuery.data ?? []).map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
          />
          )}
        </div>
        <div>
          <Label>{t('admin:inviteMemberModal.roleLabel')}</Label>
          <RoleCheckboxList roles={rolesQuery.data ?? []} selectedIds={roleIds} onChange={setRoleIds} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle mt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={inviteUser.isPending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[13px] font-medium text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('admin:inviteMemberModal.cancel')}
          </button>
          <button
            type="submit"
            disabled={inviteUser.isPending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {inviteUser.isPending ? t('common:processing') : t('admin:inviteMemberModal.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
