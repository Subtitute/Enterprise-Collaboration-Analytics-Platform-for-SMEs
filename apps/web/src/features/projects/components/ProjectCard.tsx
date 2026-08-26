import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CalendarIcon, CheckCircleIcon, EditIcon, MoreVerticalIcon, RefreshIcon, TrashIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { projectStatusMeta } from '../utils';
import { useCompleteProject, useReopenProject, useDeleteProject } from '../hooks';
import { EditProjectModal } from './EditProjectModal';
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Đọc metadata mở rộng từ localStorage (priority, lead, status override)
  const usersQuery = useOrgUsersQuery();
  const projectMeta: { priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; leadId?: string; status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' } = (() => {
    try {
      const store = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
      return store[project.id] ?? {};
    } catch {
      return {};
    }
  })();

  const currentStatus = projectMeta.status ?? project.status;
  const status = projectStatusMeta(currentStatus);
  const complete = useCompleteProject(project.id);
  const reopen = useReopenProject(project.id);
  const del = useDeleteProject();

  // Điểm nhấn viền trái theo trạng thái
  const borderLeftColor =
    currentStatus === 'COMPLETED'
      ? 'border-l-emerald-500'
      : currentStatus === 'ACTIVE'
        ? 'border-l-primary-600'
        : 'border-l-slate-400';

  const statusDotColor =
    currentStatus === 'COMPLETED'
      ? 'bg-emerald-500 ring-emerald-200'
      : currentStatus === 'ACTIVE'
        ? 'bg-primary-500 ring-primary-200'
        : 'bg-slate-400 ring-slate-200';

  const progressColor =
    progress >= 100
      ? 'bg-emerald-500'
      : progress > 50
        ? 'bg-primary-600'
        : 'bg-amber-500';

  const leadUser = usersQuery.data?.find((u) => u.id === projectMeta.leadId);

  const priorityMeta = {
    LOW: { label: t('projects:newProjectModal.priorities.LOW'), color: 'text-slate-600 bg-slate-50 border-slate-200' },
    MEDIUM: { label: t('projects:newProjectModal.priorities.MEDIUM'), color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    HIGH: { label: t('projects:newProjectModal.priorities.HIGH'), color: 'text-amber-700 bg-amber-50 border-amber-200' },
    URGENT: { label: t('projects:newProjectModal.priorities.URGENT'), color: 'text-rose-700 bg-rose-50 border-rose-200' },
  }[projectMeta.priority ?? 'MEDIUM'];

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
        className={`group relative flex h-full flex-col justify-between p-4 border-l-4 ${borderLeftColor} border-slate-200/80 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 active:scale-[0.98] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 cursor-pointer select-none`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-primary-600">
                  {project.name}
                </p>
                {projectMeta.priority && (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${priorityMeta.color}`}>
                    {priorityMeta.label}
                  </span>
                )}
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                trigger={({ toggle }) => (
                  <button
                    onClick={toggle}
                    className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                    aria-label={t('projects:projectCard.optionsAriaLabel')}
                  >
                    <MoreVerticalIcon className="h-5 w-5" />
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
                    {currentStatus !== 'COMPLETED' ? (
                      <DropdownItem
                        onClick={() => {
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
          </div>

          {/* Mô tả luôn giữ chiều cao cố định min-h-[1.15rem] để các thẻ luôn cao bằng nhau */}
          <p className="mt-1 h-4 line-clamp-1 text-xs text-slate-500">
            {project.description || <span className="italic text-slate-300">{t('projects:projectCard.noDescription')}</span>}
          </p>

          {/* Hàng Tiến độ: Nhãn "Tiến độ" + [Số việc hoàn thành/tổng] + Thanh % + Số % */}
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">{t('projects:projectCard.progressLabel')}</span>
              {typeof taskCount === 'number' && (
                <span className="text-[11px] font-medium text-slate-500">
                  {t('projects:projectCard.taskCountLabel', { completed: completedTaskCount ?? 0, total: taskCount })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ProgressBar
                  value={progress}
                  trackClassName="h-2 bg-slate-100/90 rounded-full"
                  barClassName={`h-2 rounded-full ${progressColor} transition-all duration-300`}
                />
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums text-slate-900">{Math.round(progress || 0)}%</span>
            </div>
          </div>
        </div>

        {/* Hàng dưới cùng: Thẻ trạng thái & Ngày hạn bên trái + Người phụ trách & Số thành viên bên phải (Chống tràn) */}
        <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-slate-100/80 pt-2.5">
          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
            <Badge variant={status.variant} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold shadow-xs">
              <span className={`h-1.5 w-1.5 rounded-full ring-2 ${statusDotColor}`} />
              <span>{status.label}</span>
            </Badge>

            {project.dueDate && (
              <span className="hidden xl:flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <CalendarIcon className="h-3 w-3" /> {formatDate(project.dueDate)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0 shrink">
            {leadUser && (
              <div
                className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 min-w-0 max-w-[100px]"
                title={t('projects:projectCard.leadByTitle', { name: leadUser.fullName })}
              >
                <Avatar name={leadUser.fullName} size="sm" className="h-3.5 w-3.5 shrink-0 text-[8px]" />
                <span className="truncate text-[10px] font-medium text-slate-700">{leadUser.fullName}</span>
              </div>
            )}
            {typeof memberCount === 'number' && (
              <span className="shrink-0 text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                {t('projects:projectCard.memberUnit', { count: memberCount })}
              </span>
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

      <EditProjectModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        project={project}
      />
    </>
  );
}
