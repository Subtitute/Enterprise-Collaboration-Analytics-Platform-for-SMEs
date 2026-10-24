import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeftIcon, CameraIcon } from '@/components/ui/Icons';
import { formatDate, formatTime, formatDateTime } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { useApprovedAttendanceAdjustmentsQuery, useEmployeeAttendanceQuery } from './hooks';
import { AttendanceStatusBadge, FaceMatchBadge, formatTotalHours, getTodayGmt7, OnSiteBadge, PhotoProofModal } from './AttendancePage';

type PhotoTarget = {
  id: string;
  kind: 'checkin' | 'checkout';
  time: string;
  userName?: string;
  isOnSite?: boolean | null;
  faceMatched?: boolean | null;
  faceMatchScore?: number | null;
} | null;

/**
 * 03/10/2026: trang chi tiet cham cong cua 1 nhan vien (/attendance/:userId) - CHI Manager/Org Admin
 * (PERMISSIONS.ATTENDANCE_VIEW), mirror CustomerDetailPage.tsx (useParams + 1 hook fetch theo id +
 * back-link). Tai su dung nguyen cac helper/sub-component DA CO cua AttendancePage.tsx (export moi
 * tai do - xem AttendanceStatusBadge/OnSiteBadge/PhotoProofModal/formatTotalHours/getTodayGmt7) thay
 * vi chep lai y het logic hien thi 1 dong lich su cham cong - rieng "nhat ky" (khong gop theo thang)
 * nen chi can bang don gian, khong can MonthlyTimesheetTable.
 */
export default function AttendanceDetailPage() {
  const { t } = useTranslation();
  const { userId = '' } = useParams<{ userId: string }>();
  const permissions = usePermissions();
  const canView = permissions.includes(PERMISSIONS.ATTENDANCE_VIEW);

  const attendanceQuery = useEmployeeAttendanceQuery(userId, { enabled: canView });
  const approvedAdjustmentsQuery = useApprovedAttendanceAdjustmentsQuery();
  const { map: userNameMap } = useUserNameMap();
  const [viewingPhoto, setViewingPhoto] = useState<PhotoTarget>(null);
  const today = useMemo(getTodayGmt7, []);

  const approvedAdjustmentAttendanceIds = useMemo(
    () => new Set((approvedAdjustmentsQuery.data ?? []).map((a) => a.attendanceId)),
    [approvedAdjustmentsQuery.data],
  );

  // 03/10/2026: bao ve tang trang (bo sung, khong thay the lop ben ngoai) - route nay se duoc wire
  // boi task dieu huong dong thoi, co the kem hoac khong kem ProtectedRoute requiredPermission o
  // App.tsx; tu kiem tra o day de khong bao gio phu thuoc hoan toan vao lop ben ngoai, mirror
  // ProtectedRoute.tsx (dieu huong ve trang danh sach thay vi hien noi dung khi thieu quyen).
  if (!canView) return <Navigate to="/attendance" replace />;

  const records = attendanceQuery.data?.data ?? [];
  const employeeName = userNameMap[userId] ?? userId;

  return (
    <div className="space-y-5">
      <Link to="/attendance" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeftIcon className="h-4 w-4" /> {t('hrm:attendanceDetailPage.backLink')}
      </Link>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <Avatar name={employeeName} size="md" />
        <h1 className="min-w-0 truncate text-lg font-semibold text-slate-900">
          {t('hrm:attendanceDetailPage.title', { name: employeeName })}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('hrm:attendancePage.history.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={attendanceQuery.isLoading}
            isError={attendanceQuery.isError}
            onRetry={() => attendanceQuery.refetch()}
            loadingFallback={<FullPageSpinner label={t('hrm:attendanceDetailPage.loading')} />}
            errorTitle={t('hrm:attendanceDetailPage.errorTitle')}
            errorDescription={t('hrm:attendanceDetailPage.errorDescription')}
          >
            {records.length === 0 ? (
              <EmptyState title={t('hrm:attendanceDetailPage.emptyTitle')} description={t('hrm:attendanceDetailPage.emptyDescription')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                      <th className="py-2.5 pr-4">{t('hrm:attendancePage.history.columns.date')}</th>
                      <th className="py-2.5 pr-4">{t('hrm:attendancePage.history.columns.checkIn')}</th>
                      <th className="py-2.5 pr-4">{t('hrm:attendancePage.history.columns.checkOut')}</th>
                      <th className="py-2.5 pr-4">{t('hrm:attendancePage.history.columns.totalHours')}</th>
                      <th className="py-2.5 pr-4">{t('hrm:attendancePage.history.columns.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 pr-4 text-slate-700 font-medium whitespace-nowrap">{formatDate(record.workDate)}</td>
                        <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-800">{formatTime(record.checkInAt)}</span>
                            <OnSiteBadge isOnSite={record.checkInIsOnSite} />
                            <FaceMatchBadge matched={record.checkInFaceMatched} score={record.checkInFaceMatchScore} />
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({
                                  id: record.id,
                                  kind: 'checkin',
                                  time: formatDateTime(record.checkInAt),
                                  userName: employeeName,
                                  isOnSite: record.checkInIsOnSite,
                                  faceMatched: record.checkInFaceMatched,
                                  faceMatchScore: record.checkInFaceMatchScore,
                                })
                              }
                              className="inline-flex items-center justify-center h-5.5 w-5.5 rounded bg-slate-100 text-slate-500 hover:bg-[#E4EFEE] hover:text-[#0E5E5E] transition-colors cursor-pointer"
                              title={t('hrm:attendancePage.history.viewProofIn')}
                              aria-label={t('hrm:attendancePage.history.viewProofIn')}
                            >
                              <CameraIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                          {record.checkOutAt ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-slate-800">{formatTime(record.checkOutAt)}</span>
                              <OnSiteBadge isOnSite={record.checkOutIsOnSite} />
                              <FaceMatchBadge matched={record.checkOutFaceMatched} score={record.checkOutFaceMatchScore} />
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingPhoto({
                                    id: record.id,
                                    kind: 'checkout',
                                    time: formatDateTime(record.checkOutAt),
                                    userName: employeeName,
                                    isOnSite: record.checkOutIsOnSite,
                                    faceMatched: record.checkOutFaceMatched,
                                    faceMatchScore: record.checkOutFaceMatchScore,
                                  })
                                }
                                className="inline-flex items-center justify-center h-5.5 w-5.5 rounded bg-slate-100 text-slate-500 hover:bg-[#E4EFEE] hover:text-[#0E5E5E] transition-colors cursor-pointer"
                                title={t('hrm:attendancePage.history.viewProofOut')}
                                aria-label={t('hrm:attendancePage.history.viewProofOut')}
                              >
                                <CameraIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">{t('hrm:attendancePage.today.notRecorded')}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-700 font-medium whitespace-nowrap tabular-nums">
                          <span className={record.checkOutAt ? 'font-semibold text-slate-900' : 'text-slate-400 font-normal'}>
                            {formatTotalHours(t, record.checkInAt, record.checkOutAt)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <AttendanceStatusBadge record={record} today={today} isAdjusted={approvedAdjustmentAttendanceIds.has(record.id)} />
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

      <PhotoProofModal target={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </div>
  );
}
