import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatPhone, normalizeVietnamesePhone, EMPLOYEE_CODE_RE } from '@/lib/phone';
import { fetchUser } from '@/features/profile/api';
import { useDeleteAvatar, useUploadAvatar } from '@/features/profile/hooks';
import { FaceReferencePanel } from '@/features/face/components/FaceReferencePanel';
import { useUpdateUser } from '../hooks';
import { getRoleBadgeConfig } from './MemberTableRow';

type FieldErrors = Partial<Record<'employeeCode' | 'fullName' | 'phoneNumber', string>>;

/**
 * 26/10/2026: Ho so nhan vien (Wireframe muc 16.2) - mo tu Danh sach nhan vien. Org Admin sua ma NV,
 * ho ten, so dien thoai (PATCH /users/:id); Manager chi xem cac o thong tin, nhung doi/xoa duoc avatar
 * va anh nhan dien cua Employee phong minh. Doi phong ban/vai tro van o menu "⋮" co san.
 */
export function EmployeeProfileDrawer({
  userId,
  onClose,
  canManageUsers,
  departmentNameById,
}: {
  userId: string | null;
  onClose: () => void;
  canManageUsers: boolean;
  departmentNameById: Record<string, string>;
}) {
  const { t } = useTranslation();
  const profileQuery = useQuery({ queryKey: ['users', userId], queryFn: () => fetchUser(userId as string), enabled: Boolean(userId) });
  const updateUser = useUpdateUser();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const user = profileQuery.data;

  useEffect(() => {
    if (!user) return;
    setEmployeeCode(user.employeeCode ?? '');
    setFullName(user.fullName);
    setPhone(user.phoneNumber ? formatPhone(user.phoneNumber) : '');
    setErrors({});
  }, [user]);

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && user) uploadAvatar.mutate({ target: user.id, file });
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const next: FieldErrors = {};
    const normalizedPhone = phone.trim() ? normalizeVietnamesePhone(phone) : null;
    if (phone.trim() && !normalizedPhone) next.phoneNumber = t('errors:PHONE_INVALID');
    if (employeeCode.trim() && !EMPLOYEE_CODE_RE.test(employeeCode.trim())) next.employeeCode = t('errors:EMPLOYEE_CODE_INVALID');
    if (!fullName.trim()) next.fullName = t('admin:employeeDrawer.fullNameRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    updateUser.mutate(
      { id: user.id, payload: { fullName: fullName.trim(), phoneNumber: normalizedPhone, employeeCode: employeeCode.trim() || null } },
      {
        // Loi server theo truong (ma NV da dung...) hien ngay duoi o nhap, ngoai toast chung.
        onError: (err) => {
          const code = axios.isAxiosError(err) ? (err.response?.data as { errorCode?: string } | undefined)?.errorCode : undefined;
          if (code === 'EMPLOYEE_CODE_TAKEN' || code === 'EMPLOYEE_CODE_INVALID') setErrors({ employeeCode: t(`errors:${code}`) });
          if (code === 'PHONE_INVALID') setErrors({ phoneNumber: t('errors:PHONE_INVALID') });
        },
      },
    );
  }

  const departmentName = user?.departmentId ? departmentNameById[user.departmentId] ?? '—' : '—';
  const roleLabel = (user?.roles ?? []).map((r) => getRoleBadgeConfig(r.name, t).label).join(', ') || '—';

  return (
    <Modal open={Boolean(userId)} onClose={onClose} title={t('admin:employeeDrawer.title')} size="lg" preventCloseWhilePending={updateUser.isPending}>
      {profileQuery.isLoading || !user ? (
        <div className="flex justify-center py-10">
          {profileQuery.isError ? <p className="text-[13px] text-error">{t('admin:employeeDrawer.loadError')}</p> : <Spinner className="h-6 w-6 text-accent" />}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <Avatar name={user.fullName} src={user.avatarUrl} size="lg" className="h-24 w-24 text-[28px] bg-accent-soft text-accent" />
            <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
              <p className="text-[16px] font-semibold text-text-primary">{user.fullName}</p>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button type="button" size="sm" variant="secondary" onClick={() => avatarInputRef.current?.click()} isLoading={uploadAvatar.isPending}>
                  {t('admin:employeeDrawer.changeAvatar')}
                </Button>
                {user.avatarUrl && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => deleteAvatar.mutate(user.id)} isLoading={deleteAvatar.isPending}>
                    {t('admin:employeeDrawer.removeAvatar')}
                  </Button>
                )}
                <span
                  className={`inline-flex items-center rounded-radius-sm border px-2 py-0.5 text-[12px] font-medium ${
                    user.isActive === false ? 'bg-bg-muted text-text-secondary border-border-subtle' : 'bg-success-soft text-success border-success/20'
                  }`}
                >
                  {t(user.isActive === false ? 'admin:membersPage.status.inactive' : 'admin:membersPage.status.active')}
                </span>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3 border-t border-border-subtle pt-4" noValidate>
            <FormField label={t('admin:employeeDrawer.email')} htmlFor="emp-email" hint={t('admin:employeeDrawer.emailReadOnly')}>
              <Input id="emp-email" value={user.email} readOnly className="bg-bg-muted text-text-secondary" />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label={t('admin:employeeDrawer.employeeCode')} htmlFor="emp-code" error={errors.employeeCode}>
                <Input id="emp-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} readOnly={!canManageUsers} className="font-mono" />
              </FormField>
              <FormField label={t('admin:employeeDrawer.fullName')} htmlFor="emp-name" error={errors.fullName}>
                <Input id="emp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} readOnly={!canManageUsers} />
              </FormField>
              <FormField label={t('admin:employeeDrawer.phone')} htmlFor="emp-phone" error={errors.phoneNumber}>
                <Input id="emp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={!canManageUsers} inputMode="tel" className="font-mono" />
              </FormField>
              <div className="text-[13px] text-text-secondary sm:pt-6">
                {t('admin:employeeDrawer.departmentRole', { department: departmentName, role: roleLabel })}
              </div>
            </div>
            {canManageUsers && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={updateUser.isPending}>
                  {t('common:actions.cancel')}
                </Button>
                <Button type="submit" isLoading={updateUser.isPending}>
                  {t('common:actions.save')}
                </Button>
              </div>
            )}
          </form>

          <div className="border-t border-border-subtle pt-4">
            <FaceReferencePanel userId={user.id} userName={user.fullName} />
          </div>
        </div>
      )}
    </Modal>
  );
}
