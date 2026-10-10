import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, PasswordInput, Label } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useDepartmentsQuery, useInviteUser, useRolesQuery } from '../hooks';
import { RoleCheckboxList } from './RoleCheckboxList';

export function InviteMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const departmentsQuery = useDepartmentsQuery();
  const rolesQuery = useRolesQuery();
  const inviteUser = useInviteUser();

  function reset() {
    setEmail('');
    setFullName('');
    setInitialPassword('');
    setDepartmentId('');
    setRoleIds([]);
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
    if (!initialPassword || initialPassword.length < 8) next.initialPassword = t('admin:inviteMemberModal.errors.passwordMinLength');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    inviteUser.mutate(
      {
        email: email.trim(),
        fullName: fullName.trim(),
        initialPassword,
        departmentId: departmentId || undefined,
        roleIds: roleIds.length > 0 ? roleIds : undefined,
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
          hint={t('admin:inviteMemberModal.passwordHint')}
          required
        >
          <PasswordInput
            id="invite-password"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            placeholder={t('admin:inviteMemberModal.passwordPlaceholder')}
          />
        </FormField>
        <div className="space-y-1.5">
          <Label htmlFor="invite-department">{t('admin:inviteMemberModal.departmentLabel')}</Label>
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
            {inviteUser.isPending ? t('common:loading', 'Đang xử lý...') : t('admin:inviteMemberModal.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
