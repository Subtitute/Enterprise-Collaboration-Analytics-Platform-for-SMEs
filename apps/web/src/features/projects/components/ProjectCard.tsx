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
  const isCreator = Boolean(user?.id && project.createdByUserId && user.id === project.createdByUserId);
  const canManage = canManageProjects(user?.roles) || isCreator;
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

  const statusDotColor =
    currentStatus === 'COMPLETED'
      ? 'bg-emerald-500 ring-emerald-200'
      : currentStatus === 'ACTIVE'
        ? 'bg-primary-500 ring-primary-200'
        : 'bg-slate-400 ring-slate-200';

  const isProjectCompleted =
    String(currentStatus).toUpperCase() === 'COMPLETED' ||
    String(currentStatus).toUpperCase() === 'DONE' ||
    progress >= 100;

  const progressColor = isProjectCompleted ? 'bg-emerald-500' : 'bg-primary-500';

  const leadUser = usersQuery.data?.find((u) => u.id === currentLeadId);

  const priorityMeta = {
    LOW: { label: t('projects:newProjectModal.priorities.LOW'), color: 'text-slate-600 bg-slate-50 border-slate-200' },
    MEDIUM: { label: t('projects:newProjectModal.priorities.MEDIUM'), color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    HIGH: { label: t('projects:newProjectModal.priorities.HIGH'), color: 'text-amber-700 bg-amber-50 border-amber-200' },
    URGENT: { label: t('projects:newProjectModal.priorities.URGENT'), color: 'text-rose-700 bg-rose-50 border-rose-200' },
  }[currentPriority];

  return (
    <>
      <Card
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/projects/${project.id}`);
          }
        }}
        onClick={() => navigate(`/projects/${project.id}`)}
        className="group relative flex h-full flex-col justify-between p-4 border border-slate-200/60 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 cursor-pointer select-none"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="truncate flex-1 min-w-0 text-sm font-bold text-slate-900 transition-colors group-hover:text-primary-600" title={project.name}>
                  {project.name}
                </p>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${priorityMeta.color}`}>
                  {priorityMeta.label}
                </span>
              </div>
            </div>
            {canManage && (
              <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
                <Dropdown
                  trigger={({ toggle }) => (
                    <button
                      onClick={toggle}
                      className="flex h-7 w-7 items-center justify-center -mr-1.5 rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                      aria-label={t('projects:projectCard.optionsAriaLabel')}
                    >
                      <MoreVerticalIcon className="h-4.5 w-4.5" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <div className="w-52 py-1.5">
                      <DropdownItem
                        className="text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setIsEditOpen(true);
                          close();
                        }}
                      >
                        <EditIcon className="h-4 w-4 text-slate-500" /> {t('projects:projectCard.edit')}
                      </DropdownItem>
                      <DropdownItem
                        className="text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setIsMembersOpen(true);
                          close();
                        }}
                      >
                        <UsersIcon className="h-4 w-4 text-slate-500" /> {t('projects:projectCard.manageMembers')}
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
                          <CheckCircleIcon className="h-4 w-4 text-emerald-600" /> {t('projects:projectCard.markComplete')}
                        </DropdownItem>
                      ) : (
                        <DropdownItem
                          onClick={() => {
                            reopen.mutate();
                            close();
                          }}
                        >
                          <RefreshIcon className="h-4 w-4 text-primary-600" /> {t('projects:projectCard.reopen')}
                        </DropdownItem>
                      )}
                      <DropdownItem
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          setConfirmDelete(true);
                          close();
                        }}
                      >
                        <TrashIcon className="h-4 w-4 text-rose-600" /> {t('projects:projectCard.delete')}
                      </DropdownItem>
                    </div>
                  )}
                </Dropdown>
              </div>
            )}
          </div>

          {/* Mô tả luôn giữ chiều cao cố định min-h-[1.15rem] để các thẻ luôn cao bằng nhau */}
          <p className="mt-1 h-4 line-clamp-1 text-xs text-slate-500">
            {project.description || <span className="italic text-slate-300">{t('projects:projectCard.noDescription')}</span>}
          </p>

          {/* Người phụ trách (Leader) - Khu vực rộng rãi, trực quan ngay dưới mô tả */}
          {leadUser ? (
            <div className="mt-2.5 flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 text-xs font-medium text-slate-400">{t('projects:projectCard.leadLabel')}:</span>
              <Avatar name={leadUser.fullName} size="sm" className="h-4.5 w-4.5 shrink-0 text-[9px] shadow-2xs ring-1 ring-slate-200/80" />
              <span className="truncate text-xs font-semibold text-slate-800">{leadUser.fullName}</span>
            </div>
          ) : (
            <div className="mt-2.5 h-5" />
          )}

          {/* Hàng Tiến độ chuẩn 'Thanh máu boss': Hàng trên chứa nhãn, số việc, con số %; Hàng dưới thanh ProgressBar kéo dài w-full */}
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">{t('projects:projectCard.progressLabel')}</span>
                {typeof taskCount === 'number' && (
                  <span className="text-[11px] font-medium text-slate-400">
                    ({t('projects:projectCard.taskCountLabel', { completed: completedTaskCount ?? 0, total: taskCount })})
                  </span>
                )}
              </div>
              <span className="font-bold tabular-nums text-slate-900">{Math.round(progress || 0)}%</span>
            </div>
            <ProgressBar
              value={progress}
              trackClassName="h-2 w-full bg-slate-100/90 rounded-full shadow-inner"
              barClassName={`h-2 rounded-full ${progressColor} transition-all duration-300`}
            />
          </div>
        </div>

        {/* Hàng dưới cùng: Thẻ trạng thái & Ngày hạn bên trái + Số thành viên bên phải (Gọn gàng, thoáng đãng) */}
        <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-slate-100/80 pt-2.5">
          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
            <Badge variant={status.variant} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold shadow-xs">
              <span className={`h-1.5 w-1.5 rounded-full ring-2 ${statusDotColor}`} />
              <span>{status.label}</span>
            </Badge>

            {project.dueDate && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 ml-1">
                <CalendarIcon className="h-3 w-3" /> {formatDate(project.dueDate)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 shrink">
            {typeof memberCount === 'number' && (
              <div
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500"
                title={t('projects:projectCard.memberCount', { count: memberCount })}
              >
                <UsersIcon className="w-4 h-4 text-slate-400" />
                <span className="tabular-nums font-semibold text-slate-700">{memberCount}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

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
