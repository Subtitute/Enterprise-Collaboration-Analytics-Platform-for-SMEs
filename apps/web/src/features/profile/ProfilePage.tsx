import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { CalendarIcon, BuildingIcon, ShieldIcon, MailIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useMyProfileQuery } from './hooks';

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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('profile:page.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('profile:page.subtitle')}</p>
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
          <Card>
            <CardHeader>
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={user.fullName} size="lg" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{user.fullName}</CardTitle>
                  <p className="truncate text-sm text-slate-500">{user.email}</p>
                </div>
              </div>
              <Badge variant={user.isActive === false ? 'danger' : 'success'}>
                {user.isActive === false ? t('profile:page.status.inactive') : t('profile:page.status.active')}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-400">{t('profile:page.fields.email')}</dt>
                    <dd className="text-sm font-medium text-slate-800">{user.email}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <BuildingIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-400">{t('profile:page.fields.department')}</dt>
                    <dd className="text-sm font-medium text-slate-800">{department?.name ?? '—'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-400">{t('profile:page.fields.roles')}</dt>
                    <dd className="flex flex-wrap gap-1">
                      {(user.roles ?? []).length === 0 ? (
                        <span className="text-sm text-slate-400">—</span>
                      ) : (
                        (user.roles ?? []).map((r) => (
                          <Badge key={r.id} variant="outline">
                            {r.name}
                          </Badge>
                        ))
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-400">{t('profile:page.fields.joinedAt')}</dt>
                    <dd className="text-sm font-medium text-slate-800">{formatDate(user.createdAt)}</dd>
                  </div>
                </div>
              </dl>
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
                {t('profile:page.contactAdminNote')}
              </p>
            </CardContent>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
