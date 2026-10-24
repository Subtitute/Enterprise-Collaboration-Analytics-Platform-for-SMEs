import { memo, useState, FormEvent } from 'react';
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
import { useToastStore } from '@/stores/toast.store';
import type { User } from '@/types';

interface ProfileInfoCardProps {
  user: User;
  fullName: string;
  onFullNameChange: (name: string) => void;
  departmentName?: string;
  departmentManagerName?: string;
}

export const ProfileInfoCard = memo(function ProfileInfoCard({
  user,
  fullName,
  onFullNameChange,
  departmentName,
  departmentManagerName,
}: ProfileInfoCardProps) {
  const { t } = useTranslation();
  const toast = useToastStore((s) => s.push);

  const [phoneNumber, setPhoneNumber] = useState<string>('0912 345 678');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [copiedEmployeeCode, setCopiedEmployeeCode] = useState(false);

  // Giả lập mã nhân viên chuẩn đẹp từ ID
  const employeeCode = user?.id ? `SME-${user.id.slice(0, 6).toUpperCase()}` : 'SME-ADMIN';

  // Sao chép mã nhân viên
  function handleCopyEmployeeCode() {
    navigator.clipboard.writeText(employeeCode);
    setCopiedEmployeeCode(true);
    setTimeout(() => setCopiedEmployeeCode(false), 2000);
  }

  // Xử lý lưu thông tin cá nhân (Họ tên, Số điện thoại)
  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({
        variant: 'error',
        title: t('profile:page.fields.fullNamePlaceholder'),
      });
      return;
    }
    setIsSavingProfile(true);
    setTimeout(() => {
      setIsSavingProfile(false);
      toast({
        variant: 'success',
        title: t('profile:page.toasts.profileUpdated'),
      });
    }, 400);
  }

  return (
    <Card className="border border-border-subtle bg-bg-surface rounded-radius-md shadow-none">
      <CardHeader className="pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          {/* Icon frame 32x32 accent-soft + icon 16px accent */}
          <div className="flex h-8 w-8 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
            <FileTextIcon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-[15px] font-semibold text-text-primary">
              {t('profile:page.sections.personalInfo')}
            </CardTitle>
            <CardDescription className="text-[13px] text-text-secondary">
              {t('profile:page.sections.personalInfoDesc')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Họ và tên: editable, h-9 (36px) */}
            <FormField label={t('profile:page.fields.fullName')} htmlFor="profile-fullname">
              <div className="relative">
                <Input
                  id="profile-fullname"
                  value={fullName}
                  onChange={(e) => onFullNameChange(e.target.value)}
                  placeholder={t('profile:page.fields.fullNamePlaceholder')}
                  className="pr-9"
                />
                <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>

            {/* Số điện thoại: editable, h-9 (36px), mono tabular-nums */}
            <FormField label={t('profile:page.fields.phone')} htmlFor="profile-phone">
              <div className="relative">
                <Input
                  id="profile-phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t('profile:page.fields.phonePlaceholder')}
                  className="font-mono text-[13px] font-medium tabular-nums pr-9"
                />
                <PhoneIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>

            {/* Mã nhân viên: read-only, nền bg-muted, value MONO 13/500 text-secondary, icon copy */}
            <FormField label={t('profile:page.fields.employeeId')} htmlFor="profile-emp-id">
              <div className="relative">
                <Input
                  id="profile-emp-id"
                  value={employeeCode}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  className="bg-bg-muted text-text-secondary border-border-strong cursor-not-allowed select-none font-mono text-[13px] font-medium tabular-nums pr-9"
                />
                <button
                  type="button"
                  onClick={handleCopyEmployeeCode}
                  title={t('profile:page.buttons.copyEmployeeCode')}
                  aria-label={t('profile:page.buttons.copyEmployeeCode')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                >
                  {copiedEmployeeCode ? (
                    <CheckIcon className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </FormField>

            {/* Phòng ban: read-only, value '—' nếu rỗng */}
            <FormField label={t('profile:page.fields.department')} htmlFor="profile-dept">
              <div className="relative">
                <Input
                  id="profile-dept"
                  value={departmentName || '—'}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  className="bg-bg-muted text-text-secondary border-border-strong cursor-not-allowed select-none pr-9"
                />
                <BuildingIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>

            {/* Trưởng phòng: read-only full-width, 'Chưa chỉ định' italic text-tertiary khi rỗng */}
            <div className="sm:col-span-2">
              <FormField label={t('profile:page.fields.departmentManager')} htmlFor="profile-dept-manager">
                <div className="relative">
                  <Input
                    id="profile-dept-manager"
                    value={departmentManagerName || t('profile:page.fields.noDepartmentManager')}
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                    className={`bg-bg-muted border-border-strong cursor-not-allowed select-none pr-9 ${
                      !departmentManagerName ? 'italic text-text-tertiary' : 'text-text-secondary'
                    }`}
                  />
                  <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                </div>
              </FormField>
            </div>
          </div>

          {/* Nút lưu thay đổi: Primary ink + icon check-circle 14px */}
          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary" isLoading={isSavingProfile}>
              <CheckCircleIcon className="h-3.5 w-3.5 mr-1.5" />
              {t('profile:page.buttons.saveProfile')}
            </Button>
          </div>
        </form>

        {/* Callout: nền info-soft #E4EEF5, chữ info #1E5A8A 13/400, icon alert-circle 14px, radius 6, padding 10x12 */}
        <div className="flex items-start gap-2.5 rounded-radius-sm border border-[#1E5A8A]/20 bg-[#E4EEF5] px-3 py-2.5 text-[13px] leading-[20px] text-[#1E5A8A]">
          <AlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-[#1E5A8A] mt-0.5" />
          <p className="font-normal">
            {t('profile:page.contactAdminCallout')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
});

