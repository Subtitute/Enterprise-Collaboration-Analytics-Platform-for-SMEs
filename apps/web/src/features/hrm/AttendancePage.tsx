import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CameraIcon, ClockIcon, MapPinIcon, UsersIcon, UserIcon } from '@/components/ui/Icons';
import { formatTime, formatDateTime, formatDate } from '@/lib/utils';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { CheckInCamera } from './components/CheckInCamera';
import type { CheckInLocation } from './components/CheckInCamera';
import { getAttendancePhotoUrl } from './api';
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
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isOnSite ? 'text-emerald-600' : 'text-amber-600'}`}
      title={isOnSite ? t('hrm:attendancePage.onSiteBadge.onSiteTitle') : t('hrm:attendancePage.onSiteBadge.offSiteTitle')}
    >
      <MapPinIcon className="h-3 w-3" />
      {isOnSite ? t('hrm:attendancePage.onSiteBadge.onSite') : t('hrm:attendancePage.onSiteBadge.offSite')}
    </span>
  );
}

/**
 * Tính tổng số giờ làm việc giữa check-in và check-out (Ví dụ: 8.5 giờ)
 */
function formatTotalHours(t: TFunction, checkInAt?: string | null, checkOutAt?: string | null): string {
  if (!checkInAt || !checkOutAt) return '—';
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '—';
  const diffHours = (end - start) / (1000 * 60 * 60);
  return t('hrm:attendancePage.totalHoursValue', { hours: diffHours.toFixed(1) });
}

/**
 * Modal hiển thị ảnh chụp bằng chứng chấm công (Photo-Proof Modal)
 */
function PhotoProofModal({
  target,
  onClose,
}: {
  target: { id: string; kind: 'checkin' | 'checkout'; time: string; userName?: string; isOnSite?: boolean | null } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!target) {
      setPhotoUrl(null);
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    setError(false);

    getAttendancePhotoUrl(target.id, target.kind)
      .then((url) => {
        if (isMounted) {
          setPhotoUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [target]);

  if (!target) return null;

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-slate-900">
          <CameraIcon className="h-5 w-5 text-primary-600" />
          <span>{t('hrm:photoProofModal.title', { kind: target.kind === 'checkin' ? t('hrm:attendancePage.today.checkInLabel') : t('hrm:attendancePage.today.checkOutLabel') })}</span>
        </div>
      }
      size="sm"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div>
            <span className="font-semibold text-slate-700">{target.userName || t('hrm:photoProofModal.anonymousUser')}</span>
            <div className="font-mono text-slate-900 font-bold mt-0.5">{target.time}</div>
          </div>
          <OnSiteBadge isOnSite={target.isOnSite} />
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-200 flex items-center justify-center shadow-inner">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 text-slate-300">
              <Spinner />
              <span className="text-xs text-slate-400">{t('hrm:photoProofModal.loadingPhoto')}</span>
            </div>
          )}
          {error && (
            <div className="p-4 text-center text-xs text-rose-400">
              {t('hrm:photoProofModal.loadError')}
            </div>
          )}
          {photoUrl && !isLoading && (
            <img src={photoUrl} alt={t('hrm:photoProofModal.photoAlt')} className="h-full w-full object-cover" />
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common:actions.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hệ thống Nhãn trạng thái (Status Badges) cho chấm công:
 * - Đúng giờ (bg-emerald-100 text-emerald-700)
 * - Đi muộn (bg-amber-100 text-amber-700)
 * - Quên check-out (bg-rose-100 text-rose-600)
 */
function AttendanceStatusBadge({ record, today }: { record: { workDate: string; checkInAt: string; checkOutAt?: string | null }; today: string }) {
  const { t } = useTranslation();
  const checkInDate = new Date(record.checkInAt);
  // 15/09/2026 (sua loi thuc te): dong comment cu "Gio check-in tinh theo GMT+7" o day tung SAI -
  // Date.getHours()/getMinutes() doc gio theo timezone cua TRINH DUYET nguoi xem, khong phai GMT+7
  // - dung 1 nguoi xem trang tu may dat timezone khac VN se bi tinh sai "di muon"/"dung gio" du
  // du lieu server dung. Day chinh la loi da duoc ghi nhan va sua toan bo du an ngay 22/07/2026
  // (xem formatDate/formatTime trong lib/utils.ts) nhung tai xuat hien o component moi nay - dung
  // Intl.DateTimeFormat voi timeZone: 'Asia/Ho_Chi_Minh' de doc dung gio hien thi GMT+7.
  const gmt7Parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(checkInDate);
  const checkInHour = Number(gmt7Parts.find((p) => p.type === 'hour')?.value ?? 0);
  const checkInMinute = Number(gmt7Parts.find((p) => p.type === 'minute')?.value ?? 0);
  const isLate = checkInHour > 8 || (checkInHour === 8 && checkInMinute > 30); // Giờ chuẩn vào ca 8:30
  const isPastDay = record.workDate < today;
  const isMissingCheckOut = !record.checkOutAt && isPastDay;

  if (isMissingCheckOut) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-600 whitespace-nowrap">
        {t('hrm:attendancePage.statusBadge.missingCheckOut')}
      </span>
    );
  }

  if (isLate) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
        {t('hrm:attendancePage.statusBadge.late')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
      {t('hrm:attendancePage.statusBadge.onTime')}
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
  const [viewingPhoto, setViewingPhoto] = useState<{ id: string; kind: 'checkin' | 'checkout'; time: string; userName?: string; isOnSite?: boolean | null } | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Bộ lọc Dropdown Tháng/Năm đơn giản (mặc định tháng hiện tại: 'YYYY-MM')
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Tạo danh sách 6 tháng gần nhất để lựa chọn nhanh
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: t('hrm:attendancePage.monthFilter.allTime') }];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = t('hrm:attendancePage.monthFilter.monthYear', { month: d.getMonth() + 1, year: d.getFullYear() });
      options.push({ value: val, label: lbl });
    }
    return options;
  }, [t]);

  // Đồng hồ chạy thời gian thực (Live Digital Clock)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const attendanceQuery = useMyAttendanceQuery({ limit: 50 });
  const allAttendanceQuery = useAllAttendanceQuery();
  const { map: userNameMap } = useUserNameMap();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const today = useMemo(getTodayGmt7, []);
  const todayRecord = attendanceQuery.data?.data.find((a) => a.workDate === today);
  // 403 (khong co PERMISSIONS.ATTENDANCE_VIEW) la ket qua BINH THUONG cho Employee thuong - coi
  // nhu "khong ap dung", mirror canApprove cua LeaveRequestsPage.tsx.
  const canViewAll = !allAttendanceQuery.isError && allAttendanceQuery.isSuccess;

  // Lọc dữ liệu theo Tháng/Năm đã chọn
  const filteredMyRecords = useMemo(() => {
    const records = attendanceQuery.data?.data ?? [];
    if (selectedMonth === 'all') return records;
    return records.filter((r) => r.workDate.startsWith(selectedMonth));
  }, [attendanceQuery.data?.data, selectedMonth]);

  const filteredAllRecords = useMemo(() => {
    const records = allAttendanceQuery.data?.data ?? [];
    if (selectedMonth === 'all') return records;
    return records.filter((r) => r.workDate.startsWith(selectedMonth));
  }, [allAttendanceQuery.data?.data, selectedMonth]);

  function handleConfirmPhoto(photo: Blob, location?: CheckInLocation) {
    const mutation = cameraMode === 'checkin' ? checkInMutation : checkOutMutation;
    mutation.mutate({ photo, location }, { onSuccess: () => setCameraMode(null) });
  }

  const timeString = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('hrm:attendancePage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('hrm:attendancePage.subtitle')}</p>
      </div>

      {/* Bố cục Lưới bất đối xứng (Grid & Tabs): Gập 1 cột mượt mà trên Mobile (grid-cols-1), 2 cột trên Desktop (lg:grid-cols-12) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Khối bên trái: Widget Check-in với đồng hồ số lớn */}
        <div className="w-full lg:col-span-5">
          <Card className="border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">
                  {t('hrm:attendancePage.today.cardTitle', { date: formatDate(today) })}
                </CardTitle>
                {todayRecord?.checkOutAt ? (
                  <Badge variant="success">{t('hrm:attendancePage.today.doneToday')}</Badge>
                ) : todayRecord ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                    {t('hrm:attendancePage.today.checkedInBadge')}
                  </span>
                ) : (
                  <Badge variant="outline">{t('hrm:attendancePage.today.notCheckedInBadge')}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6 flex flex-col items-center text-center">
              {/* Đồng hồ số điện tử lớn */}
              <div className="mb-2 inline-flex items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 px-6 py-3.5 shadow-2xs">
                <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-slate-900 tabular-nums">
                  {timeString}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">{t('hrm:attendancePage.today.systemTimeLabel')}</p>

              {/* Trạng thái chấm công trong ngày */}
              <div className="mt-5 w-full rounded-xl bg-slate-50/80 p-3.5 border border-slate-100/90 text-left text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                    {t('hrm:attendancePage.today.checkInLabel')}
                  </span>
                  {todayRecord ? (
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 font-mono text-sm">{formatTime(todayRecord.checkInAt)}</span>
                      <OnSiteBadge isOnSite={todayRecord.checkInIsOnSite} />
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">{t('hrm:attendancePage.today.notRecorded')}</span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                    {t('hrm:attendancePage.today.checkOutLabel')}
                  </span>
                  {todayRecord?.checkOutAt ? (
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 font-mono text-sm">{formatTime(todayRecord.checkOutAt)}</span>
                      <OnSiteBadge isOnSite={todayRecord.checkOutIsOnSite} />
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">{t('hrm:attendancePage.today.notRecorded')}</span>
                  )}
                </div>
              </div>

              {/* Nút hành động Check-in / Check-out lớn */}
              <div className="mt-5 w-full">
                {!todayRecord && (
                  <Button size="lg" className="w-full justify-center shadow-md py-3" onClick={() => setCameraMode('checkin')}>
                    <CameraIcon className="h-5 w-5" /> {t('hrm:attendancePage.today.checkInButton')}
                  </Button>
                )}
                {todayRecord && !todayRecord.checkOutAt && (
                  <Button size="lg" className="w-full justify-center shadow-md py-3 bg-amber-600 hover:bg-amber-700" onClick={() => setCameraMode('checkout')}>
                    <CameraIcon className="h-5 w-5" /> {t('hrm:attendancePage.today.checkOutButton')}
                  </Button>
                )}
                {todayRecord?.checkOutAt && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-700 text-center">
                    ✓ {t('hrm:attendancePage.today.completedMessage')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Khối bên phải: Tabs gộp "Lịch sử cá nhân" (mặc định) và "Toàn tổ chức" */}
        <div className="w-full lg:col-span-7">
          <Card className="border border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Cụm Tabs chuyển đổi tức thì không giật lag */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 p-1 border border-slate-200/60 w-fit">
                  <button
                    type="button"
                    onClick={() => setActiveTab('my')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'my'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>{t('hrm:attendancePage.history.cardTitle')}</span>
                  </button>

                  {canViewAll && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        activeTab === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <UsersIcon className="h-3.5 w-3.5" />
                      <span>{t('hrm:attendancePage.allAttendance.cardTitle')}</span>
                    </button>
                  )}
                </div>

                {/* Bộ lọc Dropdown Tháng/Năm tùy biến cao cấp với ChevronDownIcon & border-slate-200 */}
                <div className="flex items-center gap-2">
                  <CustomFilterSelect
                    value={selectedMonth}
                    options={monthOptions}
                    onChange={setSelectedMonth}
                    ariaLabel={t('hrm:attendancePage.monthFilter.ariaLabel')}
                    className="min-w-[150px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {activeTab === 'my' ? (
                <QueryState
                  isLoading={attendanceQuery.isLoading}
                  isError={attendanceQuery.isError}
                  onRetry={() => attendanceQuery.refetch()}
                  loadingFallback={<FullPageSpinner label={t('hrm:attendancePage.history.loading')} />}
                  errorTitle={t('hrm:attendancePage.history.errorTitle')}
                  errorDescription={t('hrm:attendancePage.history.errorDescription')}
                >
                  {filteredMyRecords.length === 0 ? (
                    <EmptyState
                      title={t('hrm:attendancePage.history.emptyTitle')}
                      description={selectedMonth !== 'all' ? t('hrm:attendancePage.history.emptyFilteredDescription', { month: monthOptions.find((m) => m.value === selectedMonth)?.label }) : t('hrm:attendancePage.history.emptyDescription')}
                    />
                  ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.history.columns.date')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.history.columns.checkIn')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.history.columns.checkOut')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.columns.totalHours')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.columns.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredMyRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 pr-4 text-slate-700 font-medium whitespace-nowrap">{formatDate(record.workDate)}</td>
                              <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-slate-800">{formatTime(record.checkInAt)}</span>
                                  <OnSiteBadge isOnSite={record.checkInIsOnSite} />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingPhoto({
                                        id: record.id,
                                        kind: 'checkin',
                                        time: formatDateTime(record.checkInAt),
                                        isOnSite: record.checkInIsOnSite,
                                      })
                                    }
                                    className="inline-flex items-center justify-center h-5.5 w-5.5 rounded bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                                    title={t('hrm:attendancePage.history.viewCheckInProofTitle')}
                                    aria-label={t('hrm:attendancePage.history.viewCheckInProofTitle')}
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
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setViewingPhoto({
                                          id: record.id,
                                          kind: 'checkout',
                                          time: formatDateTime(record.checkOutAt),
                                          isOnSite: record.checkOutIsOnSite,
                                        })
                                      }
                                      className="inline-flex items-center justify-center h-5.5 w-5.5 rounded bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                                      title={t('hrm:attendancePage.history.viewCheckOutProofTitle')}
                                      aria-label={t('hrm:attendancePage.history.viewCheckOutProofTitle')}
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
                                <AttendanceStatusBadge record={record} today={today} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </QueryState>
              ) : (
                <QueryState
                  isLoading={allAttendanceQuery.isLoading}
                  isError={allAttendanceQuery.isError}
                  onRetry={() => allAttendanceQuery.refetch()}
                  loadingFallback={<FullPageSpinner label={t('hrm:attendancePage.allAttendance.loading')} />}
                  errorTitle={t('hrm:attendancePage.allAttendance.errorTitle')}
                  errorDescription={t('hrm:attendancePage.allAttendance.errorDescription')}
                >
                  {filteredAllRecords.length === 0 ? (
                    <EmptyState
                      title={t('hrm:attendancePage.allAttendance.emptyTitle')}
                      description={selectedMonth !== 'all' ? t('hrm:attendancePage.allAttendance.emptyFilteredDescription', { month: monthOptions.find((m) => m.value === selectedMonth)?.label }) : t('hrm:attendancePage.allAttendance.emptyDescription')}
                    />
                  ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.allAttendance.columns.employee')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.allAttendance.columns.date')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.allAttendance.columns.checkIn')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.allAttendance.columns.checkOut')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.columns.totalHours')}</th>
                            <th className="py-2.5 pr-4 bg-white">{t('hrm:attendancePage.columns.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAllRecords.map((record) => {
                            const name = userNameMap[record.userId] ?? record.userId;
                            return (
                              <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2.5 pr-4 text-slate-900 font-semibold whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <Avatar name={name} size="sm" className="h-6 w-6 text-[10px] shadow-2xs" />
                                    <span className="truncate max-w-[160px]">{name}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap">{formatDate(record.workDate)}</td>
                                <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold text-slate-800">{formatTime(record.checkInAt)}</span>
                                    <OnSiteBadge isOnSite={record.checkInIsOnSite} />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setViewingPhoto({
                                          id: record.id,
                                          kind: 'checkin',
                                          time: formatDateTime(record.checkInAt),
                                          userName: name,
                                          isOnSite: record.checkInIsOnSite,
                                        })
                                      }
                                      className="inline-flex items-center justify-center h-5.5 w-5.5 rounded bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                                      title={t('hrm:attendancePage.allAttendance.viewCheckInProofTitle', { name })}
                                      aria-label={t('hrm:attendancePage.allAttendance.viewCheckInProofTitle', { name })}
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
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewingPhoto({
                                            id: record.id,
                                            kind: 'checkout',
                                            time: formatDateTime(record.checkOutAt),
                                            userName: name,
                                            isOnSite: record.checkOutIsOnSite,
                                          })
                                        }
                                        className="inline-flex items-center justify-center h-5.5 w-5.5 rounded bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                                        title={t('hrm:attendancePage.allAttendance.viewCheckOutProofTitle', { name })}
                                        aria-label={t('hrm:attendancePage.allAttendance.viewCheckOutProofTitle', { name })}
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
                                  <AttendanceStatusBadge record={record} today={today} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </QueryState>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal xác thực camera check-in / check-out */}
      <CheckInCamera
        open={cameraMode !== null}
        onClose={() => setCameraMode(null)}
        onConfirm={handleConfirmPhoto}
        isSubmitting={checkInMutation.isPending || checkOutMutation.isPending}
      />

      {/* Modal xem ảnh bằng chứng chấm công */}
      <PhotoProofModal
        target={viewingPhoto}
        onClose={() => setViewingPhoto(null)}
      />
    </div>
  );
}
