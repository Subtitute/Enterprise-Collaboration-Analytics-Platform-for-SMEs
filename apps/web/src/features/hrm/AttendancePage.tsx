import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CameraIcon, ClockIcon, MapPinIcon } from '@/components/ui/Icons';
import { formatDateTime, formatDate } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { CheckInCamera } from './components/CheckInCamera';
import type { CheckInLocation } from './components/CheckInCamera';
import { useAllAttendanceQuery, useCheckIn, useCheckOut, useMyAttendanceQuery } from './hooks';

/**
 * 13/08/2026 (Technical_Spec.md muc 17): huy hieu co "on-site"/"off-site" - `null`/`undefined`
 * (chua co du lieu de danh gia) KHONG hien gi ca, CHI hien khi co ket qua ro rang. Day la tin
 * hieu THEM cho Manager doi chieu voi anh, khong phai trang thai loi/canh bao chan cham cong.
 */
function OnSiteBadge({ isOnSite }: { isOnSite?: boolean | null }) {
  const { t } = useTranslation();
  if (isOnSite === undefined || isOnSite === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${isOnSite ? 'text-emerald-600' : 'text-amber-600'}`}
      title={isOnSite ? t('hrm:attendancePage.onSiteBadge.onSiteTitle') : t('hrm:attendancePage.onSiteBadge.offSiteTitle')}
    >
      <MapPinIcon className="h-3.5 w-3.5" />
      {isOnSite ? t('hrm:attendancePage.onSiteBadge.onSite') : t('hrm:attendancePage.onSiteBadge.offSite')}
    </span>
  );
}

/** Ngay hien tai theo lich GMT+7, dang 'YYYY-MM-DD' - dung 'en-CA' vi dinh dang chuan cua locale
 *  nay trung khop ISO date (YYYY-MM-DD), tranh phai tu ghep chuoi thu cong. */
function getTodayGmt7(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

/** Trang Cham cong (HRM-lite) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
export function AttendancePage() {
  const { t } = useTranslation();
  const [cameraMode, setCameraMode] = useState<'checkin' | 'checkout' | null>(null);
  const attendanceQuery = useMyAttendanceQuery({ limit: 20 });
  const allAttendanceQuery = useAllAttendanceQuery();
  const { map: userNameMap } = useUserNameMap();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const today = useMemo(getTodayGmt7, []);
  const todayRecord = attendanceQuery.data?.data.find((a) => a.workDate === today);
  // 403 (khong co PERMISSIONS.ATTENDANCE_VIEW) la ket qua BINH THUONG cho Employee thuong - coi
  // nhu "khong ap dung", mirror canApprove cua LeaveRequestsPage.tsx.
  const canViewAll = !allAttendanceQuery.isError && allAttendanceQuery.isSuccess;

  function handleConfirmPhoto(photo: Blob, location?: CheckInLocation) {
    const mutation = cameraMode === 'checkin' ? checkInMutation : checkOutMutation;
    mutation.mutate({ photo, location }, { onSuccess: () => setCameraMode(null) });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('hrm:attendancePage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('hrm:attendancePage.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('hrm:attendancePage.today.cardTitle', { date: formatDate(today) })}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ClockIcon className="h-4 w-4 text-slate-400" />
            {!todayRecord && <span>{t('hrm:attendancePage.today.notCheckedIn')}</span>}
            {todayRecord && !todayRecord.checkOutAt && (
              <span className="flex items-center gap-2">
                {t('hrm:attendancePage.today.checkedInPrefix')} <strong>{formatDateTime(todayRecord.checkInAt)}</strong>
                <OnSiteBadge isOnSite={todayRecord.checkInIsOnSite} />
              </span>
            )}
            {todayRecord?.checkOutAt && (
              <span className="flex flex-wrap items-center gap-2">
                {t('hrm:attendancePage.today.checkInLabel')} <strong>{formatDateTime(todayRecord.checkInAt)}</strong>
                <OnSiteBadge isOnSite={todayRecord.checkInIsOnSite} />
                {t('hrm:attendancePage.today.checkOutLabel')}{' '}
                <strong>{formatDateTime(todayRecord.checkOutAt)}</strong>
                <OnSiteBadge isOnSite={todayRecord.checkOutIsOnSite} />
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {!todayRecord && (
              <Button onClick={() => setCameraMode('checkin')}>
                <CameraIcon className="h-4 w-4" /> {t('hrm:attendancePage.today.checkInButton')}
              </Button>
            )}
            {todayRecord && !todayRecord.checkOutAt && (
              <Button onClick={() => setCameraMode('checkout')}>
                <CameraIcon className="h-4 w-4" /> {t('hrm:attendancePage.today.checkOutButton')}
              </Button>
            )}
            {todayRecord?.checkOutAt && <Badge variant="success">{t('hrm:attendancePage.today.doneToday')}</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('hrm:attendancePage.history.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={attendanceQuery.isLoading}
            isError={attendanceQuery.isError}
            onRetry={() => attendanceQuery.refetch()}
            loadingFallback={<FullPageSpinner label={t('hrm:attendancePage.history.loading')} />}
            errorTitle={t('hrm:attendancePage.history.errorTitle')}
            errorDescription={t('hrm:attendancePage.history.errorDescription')}
          >
            {(attendanceQuery.data?.data.length ?? 0) === 0 ? (
              <EmptyState
                title={t('hrm:attendancePage.history.emptyTitle')}
                description={t('hrm:attendancePage.history.emptyDescription')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                      <th className="py-2 pr-4">{t('hrm:attendancePage.history.columns.date')}</th>
                      <th className="py-2 pr-4">{t('hrm:attendancePage.history.columns.checkIn')}</th>
                      <th className="py-2 pr-4">{t('hrm:attendancePage.history.columns.checkOut')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceQuery.data?.data.map((record) => (
                      <tr key={record.id}>
                        <td className="py-2 pr-4 text-slate-700">{formatDate(record.workDate)}</td>
                        <td className="py-2 pr-4 text-slate-600">
                          <div className="flex flex-col gap-0.5">
                            {formatDateTime(record.checkInAt)}
                            <OnSiteBadge isOnSite={record.checkInIsOnSite} />
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {record.checkOutAt ? (
                            <div className="flex flex-col gap-0.5">
                              {formatDateTime(record.checkOutAt)}
                              <OnSiteBadge isOnSite={record.checkOutIsOnSite} />
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      {canViewAll && (allAttendanceQuery.data?.data.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('hrm:attendancePage.allAttendance.cardTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="py-2 pr-4">{t('hrm:attendancePage.allAttendance.columns.employee')}</th>
                    <th className="py-2 pr-4">{t('hrm:attendancePage.allAttendance.columns.date')}</th>
                    <th className="py-2 pr-4">{t('hrm:attendancePage.allAttendance.columns.checkIn')}</th>
                    <th className="py-2 pr-4">{t('hrm:attendancePage.allAttendance.columns.checkOut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allAttendanceQuery.data?.data.map((record) => (
                    <tr key={record.id}>
                      <td className="py-2 pr-4 text-slate-700">{userNameMap[record.userId] ?? record.userId}</td>
                      <td className="py-2 pr-4 text-slate-700">{formatDate(record.workDate)}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        <div className="flex flex-col gap-0.5">
                          {formatDateTime(record.checkInAt)}
                          <OnSiteBadge isOnSite={record.checkInIsOnSite} />
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {record.checkOutAt ? (
                          <div className="flex flex-col gap-0.5">
                            {formatDateTime(record.checkOutAt)}
                            <OnSiteBadge isOnSite={record.checkOutIsOnSite} />
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <CheckInCamera
        open={cameraMode !== null}
        onClose={() => setCameraMode(null)}
        onConfirm={handleConfirmPhoto}
        isSubmitting={checkInMutation.isPending || checkOutMutation.isPending}
      />
    </div>
  );
}
