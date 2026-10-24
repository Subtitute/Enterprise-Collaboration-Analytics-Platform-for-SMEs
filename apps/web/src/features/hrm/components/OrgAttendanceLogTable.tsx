import React from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { CameraIcon } from '@/components/ui/Icons';
import { formatDate, formatTime, formatDateTime } from '@/lib/utils';
import type { Attendance } from '@/types';
import {
  OnSiteBadge,
  FaceMatchBadge,
  formatTotalHours,
  AttendanceStatusBadge,
  type ViewingPhotoTarget,
} from './attendance-shared';

interface OrgAttendanceLogRowProps {
  record: Attendance;
  name: string;
  today: string;
  isAdjusted: boolean;
  onNavigateUser: (userId: string) => void;
  onViewPhoto: (target: ViewingPhotoTarget) => void;
}

const OrgAttendanceLogRow = React.memo(function OrgAttendanceLogRow({
  record,
  name,
  today,
  isAdjusted,
  onNavigateUser,
  onViewPhoto,
}: OrgAttendanceLogRowProps) {
  const { t } = useTranslation();

  return (
    <tr
      onClick={() => onNavigateUser(record.userId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onNavigateUser(record.userId);
      }}
      className="cursor-pointer hover:bg-bg-subtle transition-colors"
    >
      <td className="py-2.5 px-3 text-text-primary font-medium whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Avatar name={name} size="sm" className="h-6 w-6 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
          <span className="truncate max-w-[160px]">{name}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-text-primary font-mono text-[13px] whitespace-nowrap">
        {formatDate(record.workDate)}
      </td>
      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
            {formatTime(record.checkInAt)}
          </span>
          <OnSiteBadge isOnSite={record.checkInIsOnSite} />
          <FaceMatchBadge matched={record.checkInFaceMatched} score={record.checkInFaceMatchScore} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewPhoto({
                id: record.id,
                kind: 'checkin',
                time: formatDateTime(record.checkInAt),
                userName: name,
                isOnSite: record.checkInIsOnSite,
                faceMatched: record.checkInFaceMatched,
                faceMatchScore: record.checkInFaceMatchScore,
              });
            }}
            className="inline-flex items-center justify-center h-6 w-6 rounded-radius-sm bg-bg-subtle text-text-tertiary hover:bg-canvas hover:text-text-primary transition-colors cursor-pointer"
            title={t('hrm:attendancePage.allAttendance.viewProofInOf', { name })}
            aria-label={t('hrm:attendancePage.allAttendance.viewProofInOf', { name })}
          >
            <CameraIcon className="h-3 w-3" />
          </button>
        </div>
      </td>
      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
        {record.checkOutAt ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
              {formatTime(record.checkOutAt)}
            </span>
            <OnSiteBadge isOnSite={record.checkOutIsOnSite} />
            <FaceMatchBadge matched={record.checkOutFaceMatched} score={record.checkOutFaceMatchScore} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewPhoto({
                  id: record.id,
                  kind: 'checkout',
                  time: formatDateTime(record.checkOutAt),
                  userName: name,
                  isOnSite: record.checkOutIsOnSite,
                  faceMatched: record.checkOutFaceMatched,
                  faceMatchScore: record.checkOutFaceMatchScore,
                });
              }}
              className="inline-flex items-center justify-center h-6 w-6 rounded-radius-sm bg-bg-subtle text-text-tertiary hover:bg-canvas hover:text-text-primary transition-colors cursor-pointer"
              title={t('hrm:attendancePage.allAttendance.viewProofOutOf', { name })}
              aria-label={t('hrm:attendancePage.allAttendance.viewProofOutOf', { name })}
            >
              <CameraIcon className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="text-text-tertiary italic font-normal">{t('hrm:attendancePage.today.notRecorded')}</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-[13px] font-medium whitespace-nowrap tabular-nums">
        <span className={record.checkOutAt ? 'text-text-primary' : 'text-text-tertiary font-normal'}>
          {formatTotalHours(t, record.checkInAt, record.checkOutAt)}
        </span>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <AttendanceStatusBadge
          record={record}
          today={today}
          isAdjusted={isAdjusted}
        />
      </td>
    </tr>
  );
});

export interface OrgAttendanceLogTableProps {
  records: Attendance[];
  userNameMap: Record<string, string>;
  today: string;
  approvedAdjustmentAttendanceIds: Set<string>;
  onNavigateUser: (userId: string) => void;
  onViewPhoto: (target: ViewingPhotoTarget) => void;
}

export function OrgAttendanceLogTable({
  records,
  userNameMap,
  today,
  approvedAdjustmentAttendanceIds,
  onNavigateUser,
  onViewPhoto,
}: OrgAttendanceLogTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-bg-subtle z-10 border-b border-border-subtle">
          <tr className="text-left text-[12px] font-medium text-text-tertiary">
            <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.employee')}</th>
            <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.date')}</th>
            <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.checkIn')}</th>
            <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.checkOut')}</th>
            <th className="py-2.5 px-3 bg-bg-subtle text-right">{t('hrm:attendancePage.allAttendance.columns.totalHours')}</th>
            <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {records.map((record) => (
            <OrgAttendanceLogRow
              key={record.id}
              record={record}
              name={userNameMap[record.userId] ?? record.userId}
              today={today}
              isAdjusted={approvedAdjustmentAttendanceIds.has(record.id)}
              onNavigateUser={onNavigateUser}
              onViewPhoto={onViewPhoto}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
