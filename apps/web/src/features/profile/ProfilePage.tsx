import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import {
  CalendarIcon,
  BuildingIcon,
  ShieldIcon,
  PhoneIcon,
  UploadIcon,
  CheckCircleIcon,
  InfoIcon,
  LockIcon,
  FileTextIcon,
  UserIcon,
} from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import { useToastStore } from '@/stores/toast.store';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useMyProfileQuery } from './hooks';

export function ProfilePage() {
  const { t } = useTranslation();
  const toast = useToastStore((s) => s.push);
  const profileQuery = useMyProfileQuery();
  const departmentsQuery = useDepartmentsQuery();
  const user = profileQuery.data;
  const department = departmentsQuery.data?.find((d) => d.id === user?.departmentId);

  // Trạng thái cục bộ cho tương tác người dùng (Avatar, Họ tên, Số điện thoại, Đổi mật khẩu)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('0912 345 678');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Đồng bộ họ và tên từ dữ liệu server khi load xong
  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user?.fullName]);

  // Form đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Giả lập mã nhân viên chuẩn đẹp từ ID
  const employeeCode = user?.id ? `SME-${user.id.slice(0, 6).toUpperCase()}` : 'SME-ADMIN';

  // Lấy vai trò chính hiển thị
  const primaryRole = user?.roles?.[0]?.name ?? '';
  const lowerRole = primaryRole.toLowerCase();
  const roleBadgeLabel = lowerRole.includes('admin') || lowerRole.includes('quản trị')
    ? t('profile:page.roles.orgAdmin')
    : lowerRole.includes('manager') || lowerRole.includes('quản lý')
    ? t('profile:page.roles.manager')
    : t('profile:page.roles.employee');

  // Xử lý upload avatar (preview client-side)
  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      toast({
        variant: 'success',
        title: t('profile:page.toasts.avatarSimulated'),
      });
    }
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

  // Xử lý đổi mật khẩu
  function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast({
        variant: 'error',
        title: t('profile:page.toasts.missingCurrentPassword'),
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        variant: 'error',
        title: t('profile:page.toasts.passwordTooShort'),
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'error',
        title: t('profile:page.toasts.passwordMismatch'),
      });
      return;
    }

    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        variant: 'success',
        title: t('profile:page.toasts.passwordSuccess'),
      });
    }, 500);
  }

  return (
    <div className="space-y-6">
      {/* Header trang */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('profile:page.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('profile:page.subtitle')}</p>
      </div>

      <QueryState
        isLoading={profileQuery.isLoading}
        isError={profileQuery.isError || departmentsQuery.isError}
        onRetry={() => {
          profileQuery.refetch();
          departmentsQuery.refetch();
        }}
        loadingFallback={<FullPageSpinner label={t('profile:page.loading')} />}
        errorTitle={t('profile:page.loadError')}
      >
        {user && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* CỘT TRÁI (~1/3): THẺ TÓM TẮT DANH TÍNH */}
            <div className="lg:col-span-4">
              <Card className="px-6 py-8 text-center border-slate-200/80 shadow-xs relative overflow-hidden">
                {/* Lớp nền mờ trang trí phía trên */}
                <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-br from-indigo-500/10 via-indigo-50/50 to-transparent pointer-events-none" />

                <div className="relative flex flex-col items-center space-y-6">
                  {/* Avatar lớn + Nút tải ảnh lên */}
                  <div className="relative group">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt={fullName || user.fullName}
                        className="h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md"
                      />
                    ) : (
                      <Avatar
                        name={fullName || user.fullName}
                        size="lg"
                        className="h-24 w-24 text-2xl font-bold ring-4 ring-white shadow-md"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 rounded-full bg-indigo-600 p-2 text-white shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none ring-2 ring-white cursor-pointer"
                      title={t('profile:page.buttons.uploadAvatar')}
                    >
                      <UploadIcon className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>

                  {/* Cụm thông tin định danh: Họ tên, Email, Huy hiệu */}
                  <div className="space-y-3 w-full">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        {fullName || user.fullName}
                      </h2>
                      {/* Email phụ đề duy nhất dưới tên */}
                      <p className="text-xs text-slate-500 truncate max-w-[240px] mx-auto mt-1">
                        {user.email}
                      </p>
                    </div>

                    {/* Huy hiệu vai trò & Trạng thái hoạt động */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200/70 shadow-2xs">
                        <ShieldIcon className="h-3.5 w-3.5" />
                        {roleBadgeLabel}
                      </span>
                      <Badge variant={user.isActive === false ? 'danger' : 'success'}>
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {user.isActive === false ? t('profile:page.status.inactive') : t('profile:page.status.active')}
                        </span>
                      </Badge>
                    </div>
                  </div>

                  {/* Ngày gia nhập */}
                  <div className="w-full border-t border-slate-100 pt-5 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                        {t('profile:page.fields.joinedAt')}
                      </span>
                      <span className="font-semibold text-slate-700">{formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* CỘT PHẢI (~2/3): PHÂN TẦNG 2 KHỐI CARD ĐỘC LẬP */}
            <div className="space-y-6 lg:col-span-8">
              {/* KHỐI 1: THÔNG TIN CÁ NHÂN */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <BuildingIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t('profile:page.sections.personalInfo')}</CardTitle>
                      <CardDescription className="text-xs">{t('profile:page.sections.personalInfoDesc')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-5">
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* HÀNG 1 - CỘT 1: Họ và tên (cho phép cập nhật) */}
                      <FormField label={t('profile:page.fields.fullName')} htmlFor="profile-fullname">
                        <div className="relative">
                          <Input
                            id="profile-fullname"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder={t('profile:page.fields.fullNamePlaceholder')}
                            className="focus:border-indigo-500 focus:ring-indigo-500/20 pr-9"
                          />
                          <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                      </FormField>

                      {/* HÀNG 1 - CỘT 2: Số điện thoại liên hệ (cho phép cập nhật) */}
                      <FormField label={t('profile:page.fields.phone')} htmlFor="profile-phone">
                        <div className="relative">
                          <Input
                            id="profile-phone"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder={t('profile:page.fields.phonePlaceholder')}
                            className="focus:border-indigo-500 focus:ring-indigo-500/20 pr-9"
                          />
                          <PhoneIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                      </FormField>

                      {/* HÀNG 2 - CỘT 1: Mã nhân viên (khóa chỉ đọc, đặc trưng readOnly) */}
                      <FormField label={t('profile:page.fields.employeeId')} htmlFor="profile-emp-id">
                        <div className="relative">
                          <Input
                            id="profile-emp-id"
                            value={employeeCode}
                            readOnly
                            tabIndex={-1}
                            aria-readonly="true"
                            className="bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed select-none font-mono pr-9"
                          />
                          <FileTextIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                      </FormField>

                      {/* HÀNG 2 - CỘT 2: Phòng ban (khóa chỉ đọc, đặc trưng readOnly) */}
                      <FormField label={t('profile:page.fields.department')} htmlFor="profile-dept">
                        <div className="relative">
                          <Input
                            id="profile-dept"
                            value={department?.name ?? '—'}
                            readOnly
                            tabIndex={-1}
                            aria-readonly="true"
                            className="bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed select-none pr-9"
                          />
                          <BuildingIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                      </FormField>
                    </div>

                    {/* Nút lưu thay đổi thông tin cá nhân */}
                    <div className="flex justify-end pt-1">
                      <Button type="submit" isLoading={isSavingProfile}>
                        <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                        {t('profile:page.buttons.saveProfile')}
                      </Button>
                    </div>
                  </form>

                  {/* KHỐI CALLOUT LƯU Ý QUYỀN HẠN TINH TẾ */}
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3.5 text-xs text-amber-800 shadow-2xs">
                    <InfoIcon className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <p className="leading-relaxed font-medium">
                      {t('profile:page.contactAdminCallout')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* KHỐI 2: BẢO MẬT & ĐỔI MẬT KHẨU */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <LockIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t('profile:page.sections.security')}</CardTitle>
                      <CardDescription className="text-xs">{t('profile:page.sections.securityDesc')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5">
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    {/* Mật khẩu hiện tại */}
                    <FormField label={t('profile:page.fields.currentPassword')} htmlFor="current-password" required>
                      <PasswordInput
                        id="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={t('profile:page.fields.currentPasswordPlaceholder')}
                        className="focus:border-indigo-500 focus:ring-indigo-500/20"
                      />
                    </FormField>

                    {/* Mật khẩu mới & Xác nhận */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label={t('profile:page.fields.newPassword')} htmlFor="new-password" required>
                        <PasswordInput
                          id="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={t('profile:page.fields.newPasswordPlaceholder')}
                          className="focus:border-indigo-500 focus:ring-indigo-500/20"
                        />
                      </FormField>

                      <FormField label={t('profile:page.fields.confirmPassword')} htmlFor="confirm-password" required>
                        <PasswordInput
                          id="confirm-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t('profile:page.fields.confirmPasswordPlaceholder')}
                          className="focus:border-indigo-500 focus:ring-indigo-500/20"
                        />
                      </FormField>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" isLoading={isUpdatingPassword}>
                        <LockIcon className="h-4 w-4 mr-1.5" />
                        {t('profile:page.buttons.updatePassword')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}


