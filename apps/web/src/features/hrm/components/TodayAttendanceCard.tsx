import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CameraIcon, CheckIcon, ClockIcon } from '@/components/ui/Icons';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { FaceMatchBadge, OnSiteBadge } from './attendance-shared';
import type { Attendance } from '@/types';

interface TodayAttendanceCardProps {
  today: string;
  todayRecord?: Attendance | null;
  onOpenCheckIn: () => void;
  onOpenCheckOut: () => void;
  className?: string;
}

export const TodayAttendanceCard = memo(function TodayAttendanceCard({
  today,
  todayRecord,
  onOpenCheckIn,
  onOpenCheckOut,
  className,
}: TodayAttendanceCardProps) {
  const { t } = useTranslation();

  // Đồng hồ chạy ngầm cô lập trong component này, không làm re-render toàn trang AttendancePage
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <Card className={cn('border border-border-subtle bg-surface shadow-none overflow-hidden flex flex-col h-full rounded-radius-md', className)}>
      <CardHeader className="pb-3 border-b border-border-subtle">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <CardTitle className="text-[15px] font-semibold text-text-primary min-w-0">
            {t('hrm:attendancePage.today.cardTitle', { date: formatDate(today) })}
          </CardTitle>
          {todayRecord?.checkOutAt ? (
            <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-success-soft text-success whitespace-nowrap shrink-0">
              <span className="h-1 w-1 rounded-full bg-success" />
              {t('hrm:attendancePage.today.doneToday')}
            </span>
          ) : todayRecord ? (
            <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-bg-muted text-text-secondary whitespace-nowrap shrink-0">
              <span className="h-1 w-1 rounded-full bg-text-secondary" />
              {t('hrm:attendancePage.today.checkedInBadge')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-bg-muted text-text-secondary whitespace-nowrap shrink-0">
              <span className="h-1 w-1 rounded-full bg-text-secondary" />
              {t('hrm:attendancePage.today.notCheckedInBadge')}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col items-center text-center flex-1 justify-between">
        <div className="w-full">
          {/* Đồng hồ số điện tử lớn: IBM Plex Mono 40/48 w500 tabular-nums, CĂN GIỮA */}
          <div className="py-2 text-center">
            <div
              className="font-mono text-[40px] leading-[48px] font-medium text-text-primary tabular-nums tracking-normal text-center select-none"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {timeString}
            </div>
            <p className="text-[12px] leading-[18px] text-text-tertiary font-normal mt-1 text-center">
              {t('hrm:attendancePage.today.systemTimeLabel')}
            </p>
          </div>

          {/* Trạng thái chấm công trong ngày: 2 row thông tin nền bg-subtle radius 6 padding 12 */}
          <div className="mt-4 w-full rounded-radius-sm bg-bg-subtle p-3 text-left space-y-2 border border-border-subtle">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text-secondary flex items-center gap-1.5 font-normal">
                <ClockIcon className="h-3.5 w-3.5 text-text-tertiary" />
                {t('hrm:attendancePage.today.checkInLabel')}
              </span>
              {todayRecord ? (
                <span className="font-medium text-text-primary flex items-center gap-1.5">
                  <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
                    {formatTime(todayRecord.checkInAt)}
                  </span>
                  <OnSiteBadge isOnSite={todayRecord.checkInIsOnSite} />
                  <FaceMatchBadge matched={todayRecord.checkInFaceMatched} score={todayRecord.checkInFaceMatchScore} />
                </span>
              ) : (
                <span className="text-text-tertiary italic font-normal">{t('hrm:attendancePage.today.notRecorded')}</span>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-[13px]">
              <span className="text-text-secondary flex items-center gap-1.5 font-normal">
                <ClockIcon className="h-3.5 w-3.5 text-text-tertiary" />
                {t('hrm:attendancePage.today.checkOutLabel')}
              </span>
              {todayRecord?.checkOutAt ? (
                <span className="font-medium text-text-primary flex items-center gap-1.5">
                  <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
                    {formatTime(todayRecord.checkOutAt)}
                  </span>
                  <OnSiteBadge isOnSite={todayRecord.checkOutIsOnSite} />
                  <FaceMatchBadge matched={todayRecord.checkOutFaceMatched} score={todayRecord.checkOutFaceMatchScore} />
                </span>
              ) : (
                <span className="text-text-tertiary italic font-normal">{t('hrm:attendancePage.today.notRecorded')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Nút hành động Check-in / Check-out */}
        <div className="mt-5 w-full">
          {!todayRecord && (
            <Button
              size="lg"
              className="w-full justify-center bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-10 text-[14px] font-medium cursor-pointer"
              onClick={onOpenCheckIn}
            >
              <CameraIcon className="h-4 w-4" /> {t('hrm:attendancePage.today.checkInButton')}
            </Button>
          )}
          {todayRecord && !todayRecord.checkOutAt && (
            <Button
              size="lg"
              className="w-full justify-center bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-10 text-[14px] font-medium cursor-pointer"
              onClick={onOpenCheckOut}
            >
              <CameraIcon className="h-4 w-4" /> {t('hrm:attendancePage.today.checkOutButton')}
            </Button>
          )}
          {todayRecord?.checkOutAt && (
            <div className="flex items-center justify-center gap-2 rounded-radius-sm bg-success-soft px-3 py-2.5 text-[13px] font-medium text-success text-center">
              <CheckIcon className="h-3.5 w-3.5" />
              <span>{t('hrm:attendancePage.today.completedMessage')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

