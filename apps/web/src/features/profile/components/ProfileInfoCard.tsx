import { memo, useEffect, useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import {
  BuildingIcon,
  PhoneIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon,
  UserIcon,
  CopyIcon,
  CheckIcon,
} from '@/components/ui/Icons';
import { formatPhone, normalizeVietnamesePhone } from '@/lib/phone';
import type { User } from '@/types';
import { useUpdateMyPhone } from '../hooks';

interface ProfileInfoCardProps {
  user: User;
  departmentName?: string;
  departmentManagerName?: string;
}

/**
 * 26/10/2026: thay phan gia lap (so dien thoai co dinh '0912 345 678', ma nhan vien bia tu id, nut Luu
 * chi setTimeout) bang du lieu/API that (Technical_Spec.md muc 27.6, Q15). Chinh chu CHI sua so dien
 * thoai (PATCH /users/me); ho ten, ma nhan vien, phong ban do quan tri vien cap nhat (muc 27.7).
 */
export const ProfileInfoCard = memo(function ProfileInfoCard({ user, departmentName, departmentManagerName }: ProfileInfoCardProps) {
  const { t } = useTranslation();
  const updatePhone = useUpdateMyPhone();
  const [phoneNumber, setPhoneNumber] = useState<string>(user.phoneNumber ? formatPhone(user.phoneNumber) : '');
  const [phoneError, setPhoneError] = useState('');
  const [copiedEmployeeCode, setCopiedEmployeeCode] = useState(false);
  const employeeCode = user.employeeCode ?? '';

  useEffect(() => {
    setPhoneNumber(user.phoneNumber ? formatPhone(user.phoneNumber) : '');
  }, [user.phoneNumber]);

  function handleCopyEmployeeCode() {
    if (!employeeCode) return;
    navigator.clipboard.writeText(employeeCode);
    setCopiedEmployeeCode(true);
    setTimeout(() => setCopiedEmployeeCode(false), 2000);
  }

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    const trimmed = phoneNumber.trim();
    const normalized = trimmed ? normalizeVietnamesePhone(trimmed) : null;
    if (trimmed && !normalized) {
      setPhoneError(t('errors:PHONE_INVALID'));
      return;
    }
    setPhoneError('');
    updatePhone.mutate(normalized);
  }

  const readOnlyClass = 'bg-bg-muted text-text-secondary border-border-strong cursor-not-allowed select-none pr-9';

  return (
    <Card className="border border-border-subtle bg-bg-surface rounded-radius-md shadow-none">
      <CardHeader className="pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
            <FileTextIcon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-[15px] font-semibold text-text-primary">{t('profile:page.sections.personalInfo')}</CardTitle>
            <CardDescription className="text-[13px] text-text-secondary">{t('profile:page.sections.personalInfoDesc')}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('profile:page.fields.fullName')} htmlFor="profile-fullname">
              <div className="relative">
                <Input id="profile-fullname" value={user.fullName} readOnly tabIndex={-1} aria-readonly="true" className={readOnlyClass} />
                <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>

            <FormField label={t('profile:page.fields.phone')} htmlFor="profile-phone" error={phoneError}>
              <div className="relative">
                <Input
                  id="profile-phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t('profile:page.fields.phonePlaceholder')}
                  inputMode="tel"
                  className="font-mono text-[13px] font-medium tabular-nums pr-9"
                />
                <PhoneIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>

            <FormField label={t('profile:page.fields.employeeId')} htmlFor="profile-emp-id">
              <div className="relative">
                <Input
                  id="profile-emp-id"
                  value={employeeCode || '—'}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  className={`${readOnlyClass} font-mono text-[13px] font-medium tabular-nums`}
                />
                {employeeCode && (
                  <button
                    type="button"
                    onClick={handleCopyEmployeeCode}
                    title={t('profile:page.buttons.copyEmployeeCode')}
                    aria-label={t('profile:page.buttons.copyEmployeeCode')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    {copiedEmployeeCode ? <CheckIcon className="h-3.5 w-3.5 text-accent" /> : <CopyIcon className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </FormField>

            <FormField label={t('profile:page.fields.department')} htmlFor="profile-dept">
              <div className="relative">
                <Input id="profile-dept" value={departmentName || '—'} readOnly tabIndex={-1} aria-readonly="true" className={readOnlyClass} />
                <BuildingIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>

            <div className="sm:col-span-2">
              <FormField label={t('profile:page.fields.departmentManager')} htmlFor="profile-dept-manager">
                <div className="relative">
                  <Input
                    id="profile-dept-manager"
                    value={departmentManagerName || t('profile:page.fields.noDepartmentManager')}
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                    className={`${readOnlyClass} ${!departmentManagerName ? 'italic text-text-tertiary' : ''}`}
                  />
                  <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                </div>
              </FormField>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary" isLoading={updatePhone.isPending}>
              <CheckCircleIcon className="h-3.5 w-3.5 mr-1.5" />
              {t('profile:page.buttons.saveProfile')}
            </Button>
          </div>
        </form>

        <div className="flex items-start gap-2.5 rounded-radius-sm border border-[#1E5A8A]/20 bg-[#E4EEF5] px-3 py-2.5 text-[13px] leading-[20px] text-[#1E5A8A]">
          <AlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-[#1E5A8A] mt-0.5" />
          <p className="font-normal">{t('profile:page.adminManagedFieldsCallout')}</p>
        </div>
      </CardContent>
    </Card>
  );
});
