import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import type { Task, User } from '@/types';

export interface ProjectSummaryCardsProps {
  dueDate?: string | null;
  progress: number;
  progressFillColor: string;
  leadUserId?: string | null;
  tasks: Task[];
  projectMembers?: { userId: string }[];
  allUsers?: User[];
  onOpenMembersModal: () => void;
}

export const ProjectSummaryCards = React.memo(function ProjectSummaryCards({
  dueDate,
  progress,
  progressFillColor,
  leadUserId,
  tasks,
  projectMembers = [],
  allUsers = [],
  onOpenMembersModal,
}: ProjectSummaryCardsProps) {
  const { t } = useTranslation();

  const { projectMembersList, previewMembers, remainingCount } = useMemo(() => {
    const memberIdSet = new Set<string>();
    if (leadUserId) memberIdSet.add(leadUserId);
    for (const task of tasks) {
      for (const assignee of task.assignees ?? []) {
        if (assignee.userId) memberIdSet.add(assignee.userId);
      }
    }
    for (const member of projectMembers) memberIdSet.add(member.userId);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const list = Array.from(memberIdSet).map((id) => userMap.get(id)).filter(Boolean);
    const preview = list.slice(0, 3);
    const remaining = Math.max(0, list.length - 3);

    return { projectMembersList: list, previewMembers: preview, remainingCount: remaining };
  }, [leadUserId, tasks, projectMembers, allUsers]);

  return (
    /* Hàng 2: 3 Summary Cards (§3.1) */
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Card 1: Hạn hoàn thành */}
      <div className="flex items-center gap-3 rounded-radius-md border border-border-subtle bg-white p-3 h-16 shadow-none">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-radius-sm bg-bg-subtle text-text-tertiary">
          <CalendarIcon className="h-4 w-4 stroke-1.5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-text-tertiary uppercase tracking-wider leading-none">
            {t('projects:newProjectModal.dueDateLabel', 'Hạn hoàn thành')}
          </span>
          <span className="block font-mono text-[13px] font-medium text-text-primary tabular-nums truncate mt-1">
            {dueDate ? formatDate(dueDate) : t('common:none', 'Chưa đặt')}
          </span>
        </div>
      </div>

      {/* Card 2: Tiến độ */}
      <div className="flex flex-col justify-center rounded-radius-md border border-border-subtle bg-white px-3.5 py-2.5 h-16 shadow-none">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider leading-none">
            {t('projects:detail.projectProgress', 'Tiến độ')}
          </span>
          <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums leading-none">
            {progress}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
          <div
            className={cn('h-full transition-all duration-300 rounded-full', progressFillColor)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      {/* Card 3: Thành viên */}
      <button
        type="button"
        onClick={onOpenMembersModal}
        className="group flex items-center justify-between gap-3 rounded-radius-md border border-border-subtle bg-white p-3 h-16 shadow-none hover:border-border-strong hover:bg-bg-subtle/50 transition-colors text-left cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider leading-none">
            {t('projects:detail.projectMembers', 'Thành viên')}
          </div>
          <span className="block text-[12px] font-normal text-text-secondary truncate mt-1">
            {t('projects:detail.membersCountLabel', { count: projectMembersList.length, defaultValue: `${projectMembersList.length} thành viên` })}
          </span>
        </div>

        <div className="flex items-center -space-x-2 overflow-hidden shrink-0">
          {previewMembers.map((m) => {
            const initials = (m!.fullName || m!.email || '?')
              .split(' ')
              .map((p: string) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <div
                key={m!.id}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent text-[10px] font-semibold ring-2 ring-white"
                title={m!.fullName}
              >
                {initials}
              </div>
            );
          })}
          {remainingCount > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-subtle text-[11px] font-medium font-mono text-text-secondary ring-2 ring-white">
              +{remainingCount}
            </span>
          )}
          {projectMembersList.length === 0 && (
            <span className="text-[11px] text-text-tertiary italic">{t('projects:detail.noMembers', 'Chưa có')}</span>
          )}
        </div>
      </button>
    </div>
  );
});

