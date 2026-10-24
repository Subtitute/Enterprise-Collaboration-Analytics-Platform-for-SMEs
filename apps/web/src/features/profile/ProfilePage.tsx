import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useMyProfileQuery } from './hooks';
import { ProfileIdentityCard } from './components/ProfileIdentityCard';
import { ProfileInfoCard } from './components/ProfileInfoCard';
import { ProfileSecurityCard } from './components/ProfileSecurityCard';
import { ProfileFaceEnrollmentCard } from './components/ProfileFaceEnrollmentCard';

/** Ho so ca nhan (Wireframe.md - bo sung 22/07/2026, xem changelog): trang chi-doc, hien thi du
 *  lieu that cua chinh nguoi dung dang dang nhap (ten, email, phong ban, vai tro, trang thai,
 *  ngay tham gia) - lay qua GET /users/:id da co san, khong bia them field khong nam trong
 *  entity User (Technical_Spec.md muc 5: User chi co fullName/email/departmentId/roles/isActive/
 *  createdAt, khong co avatar/so dien thoai/tieu su). Sua thong tin (doi phong ban/vai tro) van
 *  thuc hien o Quan tri > Thanh vien (yeu cau quyen user:manage) - khong lap lai o day. */
export function ProfilePage() {
  const { t } = useTranslation();
  const profileQuery = useMyProfileQuery();
  const departmentsQuery = useDepartmentsQuery();
  const user = profileQuery.data;
  const department = departmentsQuery.data?.find((d) => d.id === user?.departmentId);
  const { map: userNameMap } = useUserNameMap();
  const departmentManagerName = department?.managerId ? userNameMap[department.managerId] : undefined;

  // Trạng thái cục bộ cho tương tác người dùng
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');

  // Đồng bộ họ và tên từ dữ liệu server khi load xong
  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user?.fullName]);

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

      {/* 22/07/2026: sua loi thuc te - truoc ban sua nay isError chi doc tu profileQuery, nen neu
          GET /departments loi (departmentsQuery.isError) thi QueryState van coi la "thanh cong",
          render thang Card voi department?.name luon la '—' MAI MAI - khong the phan biet duoc
          voi truong hop "nguoi dung that su khong co phong ban". Gop ca isError va onRetry cua
          departmentsQuery vao day de loi duoc hien thi + co nut "Thu lai" dung nhu profileQuery. */}
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
              <ProfileIdentityCard
                user={user}
                fullName={fullName}
                avatarPreview={avatarPreview}
                onAvatarChange={setAvatarPreview}
              />
            </div>

            {/* 3.3 & 3.4 CỘT PHẢI (~2/3): 2 CARD CHỨC NĂNG */}
            <div className="space-y-6 lg:col-span-8">
              {/* CARD 1: THÔNG TIN CÁ NHÂN */}
              <ProfileInfoCard
                user={user}
                fullName={fullName}
                onFullNameChange={setFullName}
                departmentName={department?.name}
                departmentManagerName={departmentManagerName}
              />

              {/* CARD 2: BẢO MẬT TÀI KHOẢN */}
              <ProfileSecurityCard />

              {/* CARD 3: NHAN DIEN KHUON MAT CHO CHAM CONG (24/10/2026) */}
              <ProfileFaceEnrollmentCard />
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}
