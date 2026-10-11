import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CalendarIcon, CheckCircleIcon, EditIcon, MoreVerticalIcon, RefreshIcon, TrashIcon, UsersIcon } from '@/components/ui/Icons';
import { formatDate, canManageProjects } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useAuthStore } from '@/stores/auth.store';
import { projectStatusMeta, projectPriorityMeta } from '../utils';
import { useCompleteProject, useReopenProject, useDeleteProject } from '../hooks';
import { EditProjectModal } from './EditProjectModal';
import { ProjectMembersModal } from './ProjectMembersModal';
import { toast } from '@/stores/toast.store';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  progress: number;
  /** So thanh vien dang tham gia du an */
  memberCount?: number;
  /** Tong so cong viec trong du an */
  taskCount?: number;
  /** So cong viec da hoan thanh trong du an */
  completedTaskCount?: number;
}

export function ProjectCard({ project, progress, memberCount, taskCount, completedTaskCount }: ProjectCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageProjects(user?.roles);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [, setUpdateTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setUpdateTick((t) => t + 1);
    window.addEventListener('ec_projects_updated', handleUpdate);
    return () => window.removeEventListener('ec_projects_updated', handleUpdate);
  }, []);

  // 26/08/2026 (fix code review, loi MAJOR - Fix 3): chi con doc `status` (override lac quan cua
  // completeProject()/reopenProject(), xem api.ts) tu localStorage - `priority`/`leadId` truoc day
  // cung doc tu day nhung GIO LA truong that tu server (project.priority/project.leadUserId, xem
  // project.entity.ts) nen khong con override tu localStorage cho 2 truong nay nua (moi trinh
  // duyet/nguoi dung deu thay CUNG 1 gia tri).
  const usersQuery = useOrgUsersQuery();
  const projectMeta: { status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; leadId?: string } = (() => {
    try {
      const store = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
      return store[project.id] ?? {};
    } catch {
      return {};
    }
  })();

  const currentStatus = projectMeta.status ?? project.status;
  const currentPriority = project.priority ?? projectMeta.priority ?? 'MEDIUM';
  const currentLeadId = project.leadUserId ?? projectMeta.leadId;

  const status = projectStatusMeta(currentStatus);
  const complete = useCompleteProject(project.id);
  const reopen = useReopenProject(project.id);
  const del = useDeleteProject();

  // §5.1 Status badge colors & labels
  const statusConfig = {
    ACTIVE: {
      label: t('projects:enums.projectStatus.ACTIVE'),
      bg: 'bg-[#E4EFEE]',
      text: 'text-[#0E5E5E]',
      dot: 'bg-[#0E5E5E]',
    },
    COMPLETED: {
      label: t('projects:enums.projectStatus.COMPLETED'),
      bg: 'bg-[#E6F1E9]',
      text: 'text-[#2F6F44]',
      dot: 'bg-[#2F6F44]',
    },
    ARCHIVED: {
      label: t('projects:enums.projectStatus.ARCHIVED'),
      bg: 'bg-[#EFEDE8]',
      text: 'text-[#8A8781]',
      dot: 'bg-[#8A8781]',
    },
  }[currentStatus as 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'] ?? {
    label: status.label,
    bg: 'bg-[#E4EFEE]',
    text: 'text-[#0E5E5E]',
    dot: 'bg-[#0E5E5E]',
  };

  // §5.3 Progress bar fill: Teal #0E5E5E khi <100%, Success #2F6F44 khi =100%
  const isHundredPercent = Math.round(progress || 0) >= 100 || currentStatus === 'COMPLETED';
  const progressFillColor = isHundredPercent ? 'bg-[#2F6F44]' : 'bg-[#0E5E5E]';

  const leadUser = usersQuery.data?.find((u) => u.id === currentLeadId);

  // §5.2 Priority badge colors: Font 11/600, height 22, padding 2x8, radius 2px
  const priorityConfig = {
    LOW: {
      label: t('projects:newProjectModal.priorities.LOW'),
      className: 'bg-[#FAF9F6] text-[#8A8781]',
    },
    MEDIUM: {
      label: t('projects:newProjectModal.priorities.MEDIUM'),
      className: 'bg-[#EFEDE8] text-[#5C5A55]',
    },
    HIGH: {
      label: t('projects:newProjectModal.priorities.HIGH', 'Cao'),
      className: 'bg-[#FBEEE0] text-[#B45309]',
    },
    URGENT: {
      label: t('projects:newProjectModal.priorities.URGENT'),
      className: 'bg-[#F8E5E3] text-[#B3261E]',
    },
  }[currentPriority];

  return (
    <>
      <div
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/projects/${project.id}`);
          }
        }}
        onClick={() => navigate(`/projects/${project.id}`)}
        className="group relative flex min-h-[220px] flex-col justify-between p-5 rounded-radius-lg border border-border-subtle bg-white transition-all duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer select-none"
      >
        <div className="flex flex-col flex-1">
          {/* Row 1 — Title + Priority + Menu */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className="flex-1 min-w-0 text-[15px] leading-[22px] font-semibold text-text-primary line-clamp-2"
              title={project.name}
            >
              {project.name}
            </h3>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span
                className={`inline-flex items-center justify-center h-[22px] px-2 rounded-radius-xs text-[11px] font-semibold ${priorityConfig.className}`}
              >
                {priorityConfig.label}
              </span>

              {canManage && (
                <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
                  <Dropdown
                    trigger={({ toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        className="flex h-6 w-6 items-center justify-center rounded-radius-sm text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary cursor-pointer"
                        aria-label={t('projects:projectCard.optionsAriaLabel')}
                      >
                        <MoreVerticalIcon className="h-4 w-4" />
                      </button>
                    )}
                  >
                    {({ close }) => (
                      <div className="w-52 py-1.5">
                        <DropdownItem
                          className="text-text-secondary hover:bg-bg-subtle"
                          onClick={() => {
                            setIsEditOpen(true);
                            close();
                          }}
                        >
                          <EditIcon className="h-4 w-4 text-text-tertiary" /> {t('projects:projectCard.edit')}
                        </DropdownItem>
                        <DropdownItem
                          className="text-text-secondary hover:bg-bg-subtle"
                          onClick={() => {
                            setIsMembersOpen(true);
                            close();
                          }}
                        >
                          <UsersIcon className="h-4 w-4 text-text-tertiary" /> {t('projects:projectCard.manageMembers')}
                        </DropdownItem>
                        {currentStatus !== 'COMPLETED' ? (
                          <DropdownItem
                            onClick={() => {
                              const total = taskCount ?? 0;
                              const completedCount = completedTaskCount ?? 0;
                              const isFullyDone = total > 0 ? completedCount >= total : progress >= 100;

                              if (!isFullyDone) {
                                toast.error(t('projects:toast.project.incompleteTasksError'));
                                close();
                                return;
                              }

                              complete.mutate();
                              close();
                            }}
                          >
                            <CheckCircleIcon className="h-4 w-4 text-text-success" /> {t('projects:projectCard.markComplete')}
                          </DropdownItem>
                        ) : (
                          <DropdownItem
                            onClick={() => {
                              reopen.mutate();
                              close();
                            }}
                          >
                            <RefreshIcon className="h-4 w-4 text-accent" /> {t('projects:projectCard.reopen')}
                          </DropdownItem>
                        )}
                        <DropdownItem
                          className="text-text-error hover:bg-bg-subtle"
                          onClick={() => {
                            setConfirmDelete(true);
                            close();
                          }}
                        >
                          <TrashIcon className="h-4 w-4 text-text-error" /> {t('projects:projectCard.delete')}
                        </DropdownItem>
                      </div>
                    )}
                  </Dropdown>
                </div>
              )}
            </div>
          </div>

          {/* Row 2 — Description */}
          <p className="mt-1.5 text-[13px] leading-[20px] text-text-secondary line-clamp-2">
            {project.description ? (
              project.description
            ) : (
              <span className="italic text-text-tertiary font-normal">
                {t('projects:projectCard.noDescription')}
              </span>
            )}
          </p>

          {/* Khoảng trống co giãn */}
          <div className="flex-1 min-h-2" />

          {/* Row 2.5 — Người phụ trách (Lead) — CỐ ĐỊNH 24px, LUÔN HIỂN THỊ */}
          <div className="mt-4 mb-3 h-6 flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] leading-[16px] font-normal text-text-tertiary shrink-0">
              {t('projects:projectCard.leadLabel')}
            </span>
            {leadUser ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <Avatar
                  name={leadUser.fullName}
                  size="sm"
                  className="h-5 w-5 shrink-0 text-[10px] rounded-full bg-accent-soft text-accent font-medium"
                />
                <span className="truncate text-[13px] leading-[20px] font-medium text-text-primary">
                  {leadUser.fullName}
                </span>
              </div>
            ) : (
              <span className="text-[13px] leading-[20px] font-normal italic text-text-tertiary">
                {t('projects:projectCard.leadUnassigned')}
              </span>
            )}
          </div>

          {/* Row 3 — Tiến độ + % */}
          <div className="flex items-baseline justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="text-[12px] leading-[16px] font-medium text-text-secondary">
                {t('projects:projectCard.progressLabel')}
              </span>
              {typeof taskCount === 'number' && (
                <span className="font-mono text-[12px] leading-[16px] font-medium text-text-tertiary">
                  ({t('projects:projectCard.taskCountLabel', { completed: completedTaskCount ?? 0, total: taskCount })})
                </span>
              )}
            </div>
            <span className="font-mono text-[15px] leading-[20px] font-medium text-text-primary tabular-nums">
              {Math.round(progress || 0)}%
            </span>
          </div>

          {/* Row 4 — Progress bar (height 4px, radius full, track bg-subtle, fill teal #0E5E5E / success #2F6F44) */}
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
            <div
              className={`h-full rounded-full ${progressFillColor} transition-all duration-300`}
              style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }}
            />
          </div>
        </div>

        {/* Row 5 — Footer metadata (3 phần tử justify-between, margin-top 12) */}
        <div className="mt-3 pt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle">
          {/* Status badge: dot 4px cùng màu chữ, height 22, px-2, font 11/600 */}
          <div className="shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-radius-xs text-[11px] font-semibold ${statusConfig.bg} ${statusConfig.text}`}
            >
              <span className={`h-1 w-1 rounded-full ${statusConfig.dot}`} />
              <span>{statusConfig.label}</span>
            </span>
          </div>

          {/* Ngày kết thúc: icon calendar 14px stroke 1.5 + Mono 12/400 text-tertiary */}
          <div className="flex items-center gap-1 min-w-0">
            {project.dueDate ? (
              <span className="flex items-center gap-1 font-mono text-[12px] leading-[16px] font-normal text-text-tertiary">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 stroke-[1.5] text-text-tertiary" />
                <span>{formatDate(project.dueDate)}</span>
              </span>
            ) : (
              <span className="text-[12px] text-text-tertiary">—</span>
            )}
          </div>

          {/* Số members: icon users 14px stroke 1.5 + Mono 12/500 text-secondary */}
          <div className="shrink-0">
            {typeof memberCount === 'number' && (
              <div
                className="flex items-center gap-1"
                title={t('projects:projectCard.memberCount', { count: memberCount })}
              >
                <UsersIcon className="h-3.5 w-3.5 shrink-0 stroke-[1.5] text-text-tertiary" />
                <span className="font-mono text-[12px] leading-[16px] font-medium text-text-secondary tabular-nums">
                  {memberCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          del.mutate(project.id);
          setConfirmDelete(false);
        }}
        title={t('projects:projectCard.confirmDeleteTitle')}
        description={t('projects:projectCard.confirmDeleteDescription', { name: project.name })}
        confirmLabel={t('projects:projectCard.delete')}
        danger
      />

      {isEditOpen && (
        <EditProjectModal
          open={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          project={project}
        />
      )}

      {isMembersOpen && (
        <ProjectMembersModal
          open={isMembersOpen}
          onClose={() => setIsMembersOpen(false)}
          project={project}
        />
      )}
    </>
  );
}
