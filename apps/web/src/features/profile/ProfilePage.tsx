import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FormField, Input, PasswordInput, Checkbox } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  CalendarIcon,
  BuildingIcon,
  ShieldIcon,
  PhoneIcon,
  UploadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LockIcon,
  FileTextIcon,
  UserIcon,
  CopyIcon,
  CheckIcon,
  CameraIcon,
  TrashIcon,
} from '@/components/ui/Icons';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useToastStore } from '@/stores/toast.store';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { CheckInCamera } from '@/features/hrm/components/CheckInCamera';
import { useDeleteFaceEnrollment, useEnrollFace, useFaceEnrollmentStatusQuery } from '@/features/hrm/hooks';
import { useMyProfileQuery } from './hooks';

export function ProfilePage() {
  const { t } = useTranslation();
  const toast = useToastStore((s) => s.push);
  const profileQuery = useMyProfileQuery();
  const departmentsQuery = useDepartmentsQuery();
  const user = profileQuery.data;
  const department = departmentsQuery.data?.find((d) => d.id === user?.departmentId);
  const { map: userNameMap } = useUserNameMap();
  const departmentManagerName = department?.managerId ? userNameMap[department.managerId] : undefined;

  // Trạng thái cục bộ cho tương tác người dùng
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('0912 345 678');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [copiedEmployeeCode, setCopiedEmployeeCode] = useState(false);

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

  // 24/10/2026: Face recognition (verify 1:1 cho cham cong, canh bao MEM) - dang ky/xoa khuon mat
  // CUA CHINH nguoi dang xem, mirror tinh than "tu phuc vu" cua Cham cong/Nghi phep. Opt-in that
  // su (checkbox dong y BAT BUOC tick truoc khi bam dang ky) vi day la du lieu sinh trac hoc -
  // xem Technical_Spec.md.
  const faceEnrollmentQuery = useFaceEnrollmentStatusQuery();
  const enrollFaceMutation = useEnrollFace();
  const deleteFaceEnrollmentMutation = useDeleteFaceEnrollment();
  const [faceConsentChecked, setFaceConsentChecked] = useState(false);
  const [isFaceCameraOpen, setIsFaceCameraOpen] = useState(false);
  const [isDeleteFaceConfirmOpen, setIsDeleteFaceConfirmOpen] = useState(false);

  function handleEnrollFacePhoto(photo: Blob) {
    enrollFaceMutation.mutate(photo, { onSuccess: () => setIsFaceCameraOpen(false) });
  }

  // 24/10/2026 (fix phat hien qua QA doc lap): xoa dang ky xong PHAI buoc tick lai o dong y o lan
  // dang ky tiep theo - neu khong, rut lai dong y roi dang ky lai khong can opt-in moi, lam vo
  // nghia yeu cau "dong y THAT SU" ban dau (du lieu sinh trac hoc).
  function handleDeleteFaceEnrollment() {
    deleteFaceEnrollmentMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDeleteFaceConfirmOpen(false);
        setFaceConsentChecked(false);
      },
    });
  }

  // Giả lập mã nhân viên chuẩn đẹp từ ID
  const employeeCode = user?.id ? `SME-${user.id.slice(0, 6).toUpperCase()}` : 'SME-ADMIN';

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
      setAvatarPreview(url);
      toast({
        variant: 'success',
        title: t('profile:page.toasts.avatarSimulated'),
      });
    }
  }

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
      {/* 3.1 Header */}
      <div>
        <h1 className="text-[28px] leading-[36px] font-semibold text-text-primary tracking-tight">
          {t('profile:page.title')}
        </h1>
        <p className="mt-1 text-sm leading-[22px] text-text-secondary">
          {t('profile:page.subtitle')}
        </p>
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
            {/* 3.2 CỘT TRÁI (~1/3): THẺ ĐỊNH DANH */}
            <div className="lg:col-span-4">
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
            </div>

            {/* 3.3 & 3.4 CỘT PHẢI (~2/3): 2 CARD CHỨC NĂNG */}
            <div className="space-y-6 lg:col-span-8">
              {/* CARD 1: THÔNG TIN CÁ NHÂN */}
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
                            onChange={(e) => setFullName(e.target.value)}
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
                            value={department?.name || '—'}
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

              {/* CARD 2: BẢO MẬT TÀI KHOẢN */}
              <Card className="border border-border-subtle bg-bg-surface rounded-radius-md shadow-none">
                <CardHeader className="pb-4 border-b border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    {/* Icon frame 32x32 accent-soft + icon 16px accent */}
                    <div className="flex h-8 w-8 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
                      <LockIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-[15px] font-semibold text-text-primary">
                        {t('profile:page.sections.security')}
                      </CardTitle>
                      <CardDescription className="text-[13px] text-text-secondary">
                        {t('profile:page.sections.securityDesc')}
                      </CardDescription>
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
                        />
                      </FormField>

                      <FormField label={t('profile:page.fields.confirmPassword')} htmlFor="confirm-password" required>
                        <PasswordInput
                          id="confirm-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t('profile:page.fields.confirmPasswordPlaceholder')}
                        />
                      </FormField>
                    </div>

                    {/* Nút cập nhật mật khẩu: Primary ink + icon lock 14px */}
                    <div className="flex justify-end pt-2">
                      <Button type="submit" variant="primary" isLoading={isUpdatingPassword}>
                        <LockIcon className="h-3.5 w-3.5 mr-1.5" />
                        {t('profile:page.buttons.updatePassword')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* CARD 3: NHAN DIEN KHUON MAT CHO CHAM CONG (24/10/2026) */}
              <Card className="border border-border-subtle bg-bg-surface rounded-radius-md shadow-none">
                <CardHeader className="pb-4 border-b border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
                      <CameraIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-[15px] font-semibold text-text-primary">
                        {t('hrm:faceEnroll.sectionTitle')}
                      </CardTitle>
                      <CardDescription className="text-[13px] text-text-secondary">
                        {t('hrm:faceEnroll.sectionDesc')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {/* 24/10/2026 (fix phat hien qua QA doc lap): truoc day chi kiem tra isLoading
                      roi doc thang data?.enrolled - loi 5xx/403 (vd ml-service tam thoi khong
                      ket noi duoc) khien `data` la undefined, roi xuong NHANH "chua dang ky" va
                      hien form dong y/dang ky thay vi bao loi ro rang. Nguoi dang THAT SU da
                      dang ky se bi yeu cau "dang ky lai" trong khi ho khong can. */}
                  {faceEnrollmentQuery.isLoading ? (
                    <Spinner className="h-5 w-5 text-accent" />
                  ) : faceEnrollmentQuery.isError ? (
                    <div className="flex items-center justify-between gap-2.5 rounded-radius-sm border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                      <span>{t('hrm:faceEnroll.loadError')}</span>
                      <Button type="button" variant="secondary" size="sm" onClick={() => faceEnrollmentQuery.refetch()}>
                        {t('common:queryState.retry')}
                      </Button>
                    </div>
                  ) : faceEnrollmentQuery.data?.enrolled ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-radius-sm border border-success/20 bg-success-soft px-3 py-2.5 text-[13px] text-success">
                        <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {t('hrm:faceEnroll.enrolledAt', {
                            date: faceEnrollmentQuery.data.enrolledAt ? formatDateTime(faceEnrollmentQuery.data.enrolledAt) : '—',
                          })}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => setIsFaceCameraOpen(true)}>
                          <CameraIcon className="h-3.5 w-3.5 mr-1.5" />
                          {t('hrm:faceEnroll.reEnrollButton')}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setIsDeleteFaceConfirmOpen(true)}>
                          <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
                          {t('hrm:faceEnroll.deleteButton')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="flex items-start gap-2.5 text-[13px] text-text-secondary cursor-pointer">
                        <Checkbox checked={faceConsentChecked} onChange={(e) => setFaceConsentChecked(e.target.checked)} className="mt-0.5" />
                        <span>{t('hrm:faceEnroll.consentLabel')}</span>
                      </label>
                      <Button type="button" variant="primary" disabled={!faceConsentChecked} onClick={() => setIsFaceCameraOpen(true)}>
                        <CameraIcon className="h-3.5 w-3.5 mr-1.5" />
                        {t('hrm:faceEnroll.enrollButton')}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 rounded-radius-sm border border-[#1E5A8A]/20 bg-[#E4EEF5] px-3 py-2.5 text-[13px] leading-[20px] text-[#1E5A8A]">
                    <AlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-[#1E5A8A] mt-0.5" />
                    <p className="font-normal">{t('hrm:faceEnroll.softWarningNote')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </QueryState>

      <CheckInCamera
        open={isFaceCameraOpen}
        onClose={() => setIsFaceCameraOpen(false)}
        onConfirm={handleEnrollFacePhoto}
        isSubmitting={enrollFaceMutation.isPending}
        mode="enroll"
      />

      <ConfirmDialog
        open={isDeleteFaceConfirmOpen}
        onClose={() => setIsDeleteFaceConfirmOpen(false)}
        onConfirm={handleDeleteFaceEnrollment}
        title={t('hrm:faceEnroll.deleteConfirmTitle')}
        description={t('hrm:faceEnroll.deleteConfirmDescription')}
        danger
        isLoading={deleteFaceEnrollmentMutation.isPending}
      />
    </div>
  );
}
