import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { UsersIcon, EditIcon, ClockIcon } from '@/components/ui/Icons';
import type { Attendance, AttendanceAdjustment, OvertimeRequest, User, Department } from '@/types';
import { MonthlyTimesheetTable } from './MonthlyTimesheetTable';
import { PendingAdjustmentsList } from './PendingAdjustmentsList';
import { PendingOvertimeList } from './PendingOvertimeList';
import { OrgAttendanceLogTable } from './OrgAttendanceLogTable';
import type { ViewingPhotoTarget } from './attendance-shared';

export interface OrgAttendanceCardProps {
  canViewAll: boolean;
  canViewAdjustments: boolean;
  canViewOvertime: boolean;
  orgSubTab: 'timesheet' | 'log' | 'adjustments' | 'overtime';
  setOrgSubTab: (tab: 'timesheet' | 'log' | 'adjustments' | 'overtime') => void;
  pendingAdjustmentsCount: number;
  pendingOtCount: number;
  orgSelectedMonth: string;
  setOrgSelectedMonth: (m: string) => void;
  monthOptions: { value: string; label: string }[];
  pendingAdjustmentsWithName: (AttendanceAdjustment & { userName: string })[];
  pendingOvertimeWithName: (OvertimeRequest & { userName: string })[];
  onApproveAdjustment: (id: string) => void;
  onRejectAdjustment: (id: string) => void;
  onApproveOt: (id: string) => void;
  onRejectOt: (id: string) => void;
  isAllAttendanceLoading: boolean;
  isAllAttendanceError: boolean;
  isDepartmentsLoading: boolean;
  onRetryAllAttendance: () => void;
  filteredAllRecords: Attendance[];
  orgUsers: User[];
  departments: Department[];
  today: string;
  approvedOvertime: OvertimeRequest[];
  userNameMap: Record<string, string>;
  approvedAdjustmentAttendanceIds: Set<string>;
  onNavigateUser: (userId: string) => void;
  onViewPhoto: (target: ViewingPhotoTarget) => void;
}

export function OrgAttendanceCard({
  canViewAll,
  canViewAdjustments,
  canViewOvertime,
  orgSubTab,
  setOrgSubTab,
  pendingAdjustmentsCount,
  pendingOtCount,
  orgSelectedMonth,
  setOrgSelectedMonth,
  monthOptions,
  pendingAdjustmentsWithName,
  pendingOvertimeWithName,
  onApproveAdjustment,
  onRejectAdjustment,
  onApproveOt,
  onRejectOt,
  isAllAttendanceLoading,
  isAllAttendanceError,
  isDepartmentsLoading,
  onRetryAllAttendance,
  filteredAllRecords,
  orgUsers,
  departments,
  today,
  approvedOvertime,
  userNameMap,
  approvedAdjustmentAttendanceIds,
  onNavigateUser,
  onViewPhoto,
}: OrgAttendanceCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="border border-border-subtle bg-surface shadow-none overflow-hidden rounded-radius-md">
      <CardHeader className="pb-3 border-b border-border-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Tiêu đề & Segmented Control */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-text-tertiary" />
              <CardTitle className="text-[15px] font-semibold text-text-primary">
                {t('hrm:extensions.orgTabs.mainTitle')}
              </CardTitle>
            </div>

            {/* Sub-tabs điều hướng: Segmented Control phẳng (nền bg-subtle, active nền trắng + Ink w600 + border subtle) */}
            <div className="flex flex-wrap items-center gap-1 rounded-radius-sm bg-bg-subtle p-1 border border-border-subtle">
              {canViewAll && (
                <button
                  type="button"
                  onClick={() => setOrgSubTab('timesheet')}
                  className={`px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                    orgSubTab === 'timesheet'
                      ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t('hrm:extensions.orgTabs.subtabs.timesheet')}
                </button>
              )}

              {canViewAll && (
                <button
                  type="button"
                  onClick={() => setOrgSubTab('log')}
                  className={`px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                    orgSubTab === 'log'
                      ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t('hrm:extensions.orgTabs.subtabs.log')}
                </button>
              )}

              {canViewAdjustments && (
                <button
                  type="button"
                  onClick={() => setOrgSubTab('adjustments')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                    orgSubTab === 'adjustments'
                      ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <EditIcon className="h-3 w-3" />
                  <span>{t('hrm:extensions.orgTabs.subtabs.adjustments')}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                      pendingAdjustmentsCount > 0
                        ? 'bg-warning-soft text-warning'
                        : 'bg-bg-muted text-text-tertiary'
                    }`}
                  >
                    {pendingAdjustmentsCount}
                  </span>
                </button>
              )}

              {canViewOvertime && (
                <button
                  type="button"
                  onClick={() => setOrgSubTab('overtime')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                    orgSubTab === 'overtime'
                      ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <ClockIcon className="h-3 w-3" />
                  <span>{t('hrm:extensions.orgTabs.subtabs.overtime')}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                      pendingOtCount > 0
                        ? 'bg-warning-soft text-warning'
                        : 'bg-bg-muted text-text-tertiary'
                    }`}
                  >
                    {pendingOtCount}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Bộ lọc tháng cho Quản lý tổ chức (khi xem Timesheet hoặc Log) */}
          {(orgSubTab === 'timesheet' || orgSubTab === 'log') && (
            <div className="flex items-center gap-2">
              <CustomFilterSelect
                value={orgSelectedMonth}
                options={monthOptions}
                onChange={setOrgSelectedMonth}
                ariaLabel={t('hrm:attendancePage.monthFilter.ariaLabel')}
                className="min-w-[140px]"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {orgSubTab === 'adjustments' ? (
          <PendingAdjustmentsList
            adjustments={pendingAdjustmentsWithName}
            onApprove={onApproveAdjustment}
            onReject={onRejectAdjustment}
          />
        ) : orgSubTab === 'overtime' ? (
          <PendingOvertimeList
            overtimeList={pendingOvertimeWithName}
            onApprove={onApproveOt}
            onReject={onRejectOt}
          />
        ) : (
          <QueryState
            isLoading={isAllAttendanceLoading || isDepartmentsLoading}
            isError={isAllAttendanceError}
            onRetry={onRetryAllAttendance}
            loadingFallback={<FullPageSpinner label={t('hrm:attendancePage.allAttendance.loading')} />}
            errorTitle={t('hrm:attendancePage.allAttendance.errorTitle')}
            errorDescription={t('hrm:attendancePage.allAttendance.errorDescription')}
          >
            {orgSubTab === 'timesheet' ? (
              <MonthlyTimesheetTable
                records={filteredAllRecords}
                users={orgUsers}
                departments={departments}
                selectedMonth={orgSelectedMonth}
                today={today}
                approvedOvertime={approvedOvertime}
              />
            ) : filteredAllRecords.length === 0 ? (
              <EmptyState
                title={t('hrm:attendancePage.allAttendance.emptyTitle')}
                description={
                  orgSelectedMonth !== 'all'
                    ? t('hrm:attendancePage.allAttendance.emptyFilteredDescription', {
                        month: monthOptions.find((m) => m.value === orgSelectedMonth)?.label,
                      })
                    : t('hrm:attendancePage.allAttendance.emptyDescription')
                }
              />
            ) : (
              <OrgAttendanceLogTable
                records={filteredAllRecords}
                userNameMap={userNameMap}
                today={today}
                approvedAdjustmentAttendanceIds={approvedAdjustmentAttendanceIds}
                onNavigateUser={onNavigateUser}
                onViewPhoto={onViewPhoto}
              />
            )}
          </QueryState>
        )}
      </CardContent>
    </Card>
  );
}

