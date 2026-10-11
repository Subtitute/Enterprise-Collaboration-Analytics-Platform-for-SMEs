import { memo, useRef, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { CalendarIcon, ShieldIcon, UploadIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import { useToastStore } from '@/stores/toast.store';
import type { User } from '@/types';

interface ProfileIdentityCardProps {
  user: User;
  fullName: string;
  avatarPreview: string | null;
  onAvatarChange: (previewUrl: string) => void;
}

export const ProfileIdentityCard = memo(function ProfileIdentityCard({
  user,
  fullName,
  avatarPreview,
  onAvatarChange,
}: ProfileIdentityCardProps) {
  const { t } = useTranslation();
  const toast = useToastStore((s) => s.push);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lấy vai trò chính hiển thị
  const primaryRole = user?.roles?.[0]?.name ?? '';
  const lowerRole = primaryRole.toLowerCase();
  const isOrgAdmin = lowerRole.includes('admin');
  const isManager = lowerRole.includes('manager');

  const roleBadgeLabel = isOrgAdmin
    ? t('profile:page.roles.orgAdmin')
    : isManager
    ? t('profile:page.roles.manager')
    : t('profile:page.roles.employee');

  const roleBadgeClasses = isOrgAdmin
    ? 'bg-accent-soft text-accent border border-accent/20'
    : isManager
    ? 'bg-info-soft text-info border border-info/20'
    : 'bg-bg-subtle text-text-secondary border border-border-subtle';

  // Xử lý upload avatar (preview client-side)
  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onAvatarChange(url);
      toast({
        variant: 'success',
        title: t('profile:page.toasts.avatarSimulated'),
      });
    }
  }

  return (
    <Card className="p-0 border border-border-subtle bg-bg-surface rounded-radius-md shadow-none overflow-hidden">
      {/* Khối header nền accent-soft với avatar 96x96 căn giữa */}
      <div className="w-full bg-accent-soft pt-8 pb-6 flex justify-center items-center">
        <div className="relative group">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt={fullName || user.fullName}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-white"
            />
          ) : (
            <Avatar
              name={fullName || user.fullName}
              size="lg"
              className="h-24 w-24 text-[32px] font-semibold bg-[#0E5E5E] text-white ring-4 ring-white"
            />
          )}
          {/* Nút upload tròn 32x32, nền accent #0E5E5E, icon upload 14px trắng, hover #0A4848 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#0E5E5E] text-white hover:bg-[#0A4848] transition-colors focus:outline-none ring-2 ring-white cursor-pointer"
            title={t('profile:page.buttons.uploadAvatar')}
          >
            <UploadIcon className="h-3.5 w-3.5 stroke-[2.2]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Thông tin định danh */}
      <div className="px-6 py-6 text-center space-y-4">
        <div>
          <h2 className="text-[18px] leading-[26px] font-semibold text-text-primary tracking-tight">
            {fullName || user.fullName}
          </h2>
          <p className="text-[13px] leading-[20px] text-text-tertiary truncate max-w-[240px] mx-auto mt-1">
            {user.email}
          </p>
        </div>

        {/* Row badge: vai trò + trạng thái (gap 6) */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          <span className={`inline-flex items-center gap-1.5 rounded-radius-sm px-2.5 py-1 text-xs font-semibold ${roleBadgeClasses}`}>
            <ShieldIcon className="h-3.5 w-3.5" />
            {roleBadgeLabel}
          </span>
          {user.isActive === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-radius-sm bg-bg-muted px-2.5 py-1 text-xs font-medium text-text-secondary border border-border-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
              {t('profile:page.status.inactive')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-radius-sm bg-success-soft px-2.5 py-1 text-xs font-medium text-success border border-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {t('profile:page.status.active')}
            </span>
          )}
        </div>

        {/* Divider + Row ngày gia nhập */}
        <div className="w-full border-t border-border-subtle pt-4 text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-tertiary text-[12px] flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-text-tertiary" />
              {t('profile:page.fields.joinedAt')}
            </span>
            <span className="font-mono text-[13px] font-medium tabular-nums text-text-primary">
              {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
});

