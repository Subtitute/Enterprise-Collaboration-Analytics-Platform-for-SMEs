import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
// 22/07/2026: them QueryState de xu ly nhanh isError cho tasksQuery ben duoi (xem chu thich tai
// vi tri dung).
import { QueryState } from '@/components/ui/QueryState';
import { ChevronLeftIcon, PlusIcon, CheckCircleIcon, CalendarIcon, RefreshIcon, UsersIcon } from '@/components/ui/Icons';
import { formatDate, cn, canManageProjects } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { Avatar } from '@/components/ui/Avatar';
import { useProjectQuery, useTasksQuery, useCompleteProject, useReopenProject, useProjectMembersQuery } from './hooks';
import { projectStatusMeta, computeProgressFromTasks, projectPriorityMeta } from './utils';
import { KanbanBoard } from './components/KanbanBoard';
import { NewTaskModal } from './components/NewTaskModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { ProjectMembersModal } from './components/ProjectMembersModal';
import { toast } from '@/stores/toast.store';
import type { TaskStatus } from '@/types';

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectQuery = useProjectQuery(projectId);
  const tasksQuery = useTasksQuery(projectId);
  const completeProject = useCompleteProject(projectId);
  const reopenProject = useReopenProject(projectId);
  const orgUsersQuery = useOrgUsersQuery();
  const projectMembersQuery = useProjectMembersQuery(projectId);
  const user = useAuthStore((s) => s.user);

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<TaskStatus | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  // Xử lý Deep Link: Đọc taskId từ URL để tự động mở modal chi tiết & cuộn tới vị trí thẻ task
  const handledDeepLinkRef = useRef(false);
  useEffect(() => {
    const deepTaskId = searchParams.get('taskId');
    if (deepTaskId && !handledDeepLinkRef.current && tasksQuery.data) {
      handledDeepLinkRef.current = true;
      setSelectedTaskId(deepTaskId);
      setHighlightedTaskId(deepTaskId);

      // Cuộn mượt đến vị trí thẻ sau khi DOM đã render
      setTimeout(() => {
        const el = document.getElementById(`task-card-${deepTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);

      // Tắt highlight sau 5 giây để giao diện trở về trạng thái bình thường
      setTimeout(() => {
        setHighlightedTaskId(null);
      }, 5000);

      // Xóa query param taskId khỏi URL để giữ URL tinh gọn
      searchParams.delete('taskId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, tasksQuery.data]);

  if (projectQuery.isLoading) return <FullPageSpinner label={t('projects:detail.loading')} />;
  if (projectQuery.isError || !projectQuery.data) {
    return <EmptyState title={t('projects:detail.notFoundTitle')} description={t('projects:detail.notFoundDescription')} />;
  }

  const project = projectQuery.data;

  const isLead = Boolean(user?.id && project.leadUserId && user.id === project.leadUserId);
  const isCreator = Boolean(user?.id && project.createdByUserId && user.id === project.createdByUserId);
  const canManage = canManageProjects(user?.roles) || isLead || isCreator;

  // 26/08/2026 (fix code review, loi MAJOR - Fix 3): chi con doc `status` (override lac quan cua
  // completeProject()/reopenProject(), xem api.ts) tu localStorage - `priority` truoc day cung doc
  // tu day nhung GIO LA truong that tu server (project.priority, xem project.entity.ts) nen khong
  // con override tu localStorage cho truong nay nua (moi trinh duyet/nguoi dung deu thay CUNG 1
  // gia tri).
  const projectMeta: { status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' } = (() => {
    try {
      const meta = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
      return meta[project.id] ?? {};
    } catch {
      return {};
    }
  })();

  const currentStatus = projectMeta.status ?? project.status;
  const currentPriority = project.priority ?? projectMeta.priority ?? 'MEDIUM';
  const status = projectStatusMeta(currentStatus);
  const tasks = tasksQuery.data ?? [];
  const progress = project.progress ?? computeProgressFromTasks(tasks);

  const statusDotColor =
    currentStatus === 'COMPLETED'
      ? 'bg-emerald-500 ring-emerald-200'
      : currentStatus === 'ACTIVE'
        ? 'bg-primary-500 ring-primary-200'
        : 'bg-slate-400 ring-slate-200';

  const priorityMeta = {
    LOW: { label: t('projects:newProjectModal.priorities.LOW'), color: 'text-slate-600 bg-slate-50 border-slate-200' },
    MEDIUM: { label: t('projects:newProjectModal.priorities.MEDIUM'), color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    HIGH: { label: t('projects:newProjectModal.priorities.HIGH'), color: 'text-amber-700 bg-amber-50 border-amber-200' },
    URGENT: { label: t('projects:newProjectModal.priorities.URGENT'), color: 'text-rose-700 bg-rose-50 border-rose-200' },
  }[currentPriority];

  return (
    <div className="space-y-5">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ChevronLeftIcon className="h-4 w-4" /> {t('projects:detail.backToList')}
      </Link>

      <div className="rounded-md border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        {/* Hàng 1: Tiêu đề, Badge độ ưu tiên, Badge trạng thái (bên trái) + 2 Nút hành động (bên phải) */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 break-words">{project.name}</h1>
              {project.priority && (
                <span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold border ${priorityMeta.color}`}>
                  {priorityMeta.label}
                </span>
              )}
              <Badge variant={status.variant} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold">
                <span className={`h-1.5 w-1.5 rounded-full ${statusDotColor}`} />
                <span>{status.label}</span>
              </Badge>
            </div>
            {project.description && <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-slate-500 break-words leading-relaxed">{project.description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 w-full sm:w-auto">
            {canManage && (
              currentStatus !== 'COMPLETED' ? (
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  onClick={() => {
                    const isFullyDone = tasks.length > 0
                      ? tasks.every((t) => t.status === 'DONE')
                      : progress >= 100;

                    if (!isFullyDone) {
                      toast.error(t('projects:toast.project.incompleteTasksError'));
                      return;
                    }

                    completeProject.mutate();
                  }}
                  isLoading={completeProject.isPending}
                >
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600" /> {t('projects:detail.completeProject')}
                </Button>
              ) : (
                <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => reopenProject.mutate()} isLoading={reopenProject.isPending}>
                  <RefreshIcon className="h-4 w-4 text-primary-600" /> {t('projects:detail.reopenProject')}
                </Button>
              )
            )}
            <Button className="flex-1 sm:flex-initial" onClick={() => setIsNewTaskOpen(true)}>
              <PlusIcon className="h-4 w-4" /> {t('projects:detail.newTask')}
            </Button>
          </div>
        </div>

        {/* Hàng 2: Dải nền xám nhạt khóa đáy thẻ chứa 3 Widget (Hạn hoàn thành, Tiến độ dự án & Thành viên) */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 rounded-md bg-slate-50/90 border border-slate-200/60 p-2 shadow-2xs w-full sm:w-auto">
            {project.dueDate && (
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 w-full sm:w-52 h-[52px] shadow-2xs">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-200/60 text-slate-500 shadow-2xs">
                  <CalendarIcon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-slate-500 leading-tight">
                    {t('projects:newProjectModal.dueDateLabel')}
                  </span>
                  <span className="block text-xs font-bold text-slate-800 truncate mt-0.5">
                    {formatDate(project.dueDate)}
                  </span>
                </div>
              </div>
            )}
            
            {/* Widget tiến độ hoàn thành công việc */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 w-full sm:w-52 h-[52px] shadow-2xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 leading-tight">{t('projects:detail.projectProgress')}</span>
                  <span className={cn(
                    "text-xs font-bold font-display",
                    progress >= 100 ? "text-emerald-600" : "text-primary-600"
                  )}>
                    {progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner border border-slate-200/40">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      progress >= 100 
                        ? "bg-emerald-500" 
                        : "bg-primary-500"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Widget Thành viên dự án */}
            {(() => {
              // 22/09/2026: "thanh vien du an" = hop cua 3 nguon (mirror dung logic server-side tai
              // ProjectsService.getVisibleProjectIds()/addMember()): nguoi phu trach (leadUserId),
              // nguoi dang duoc giao >=1 Task (TaskAssignee), va thanh vien duoc them THANG qua
              // ProjectMember (that, server-side - thay localStorage truoc day).
              const memberIdSet = new Set<string>();
              if (project.leadUserId) memberIdSet.add(project.leadUserId);
              for (const task of tasks) {
                for (const assignee of task.assignees ?? []) {
                  if (assignee.userId) memberIdSet.add(assignee.userId);
                }
              }
              for (const member of projectMembersQuery.data ?? []) memberIdSet.add(member.userId);

              const allUsers = orgUsersQuery.data ?? [];
              const userMap = new Map(allUsers.map((u) => [u.id, u]));
              const projectMembers = Array.from(memberIdSet).map((id) => userMap.get(id)).filter(Boolean);
              const previewMembers = projectMembers.slice(0, 3);
              const remainingCount = Math.max(0, projectMembers.length - 3);

              return (
                <button
                  type="button"
                  onClick={() => setIsMembersModalOpen(true)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 w-full sm:w-64 h-[52px] shadow-2xs hover:border-indigo-300 hover:bg-slate-50/70 transition-all text-left cursor-pointer active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 leading-tight group-hover:text-indigo-600 transition-colors">
                      <UsersIcon className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600" />
                      <span>{t('projects:detail.projectMembers')}</span>
                    </div>
                    <span className="block text-xs font-bold text-slate-800 truncate mt-0.5">
                      {t('projects:detail.membersCountLabel', { count: projectMembers.length })}
                    </span>
                  </div>

                  <div className="flex items-center -space-x-1.5 overflow-hidden shrink-0">
                    {previewMembers.map((m) => (
                      <Avatar
                        key={m!.id}
                        name={m!.fullName}
                        size="sm"
                        className="h-6 w-6 text-[10px] ring-2 ring-white shadow-2xs"
                      />
                    ))}
                    {remainingCount > 0 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-2 ring-white shadow-2xs">
                        +{remainingCount}
                      </span>
                    )}
                    {projectMembers.length === 0 && (
                      <span className="text-[11px] text-slate-400 italic">{t('projects:detail.noMembers')}</span>
                    )}
                  </div>
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 22/07/2026: sua loi thuc te - nhanh render ben duoi truoc day chi kiem tra isLoading va
          tasks.length === 0, KHONG kiem tra tasksQuery.isError, nen khi GET /tasks that bai thi
          UI hien y het truong hop "du an chua co cong viec nao" (kem nut "Tao cong viec moi") -
          nguoi dung bi danh lua rang du an trong trong khi thuc ra la loi mang/server, va khong
          co cach nao de thu lai ngoai reload ca trang. Boc bang QueryState (cung pattern da dung
          o DocumentsPage.tsx) de tach rieng nhanh loi + nut "Thu lai" khoi nhanh empty-state that su. */}
      <QueryState
        isLoading={tasksQuery.isLoading}
        isError={tasksQuery.isError}
        onRetry={() => tasksQuery.refetch()}
        loadingFallback={<FullPageSpinner label={t('projects:detail.tasksLoading')} />}
        errorTitle={t('projects:detail.tasksErrorTitle')}
        errorDescription={t('projects:detail.tasksErrorDescription')}
      >
        {tasks.length === 0 ? (
          <EmptyState
            title={t('projects:detail.emptyTasksTitle')}
            description={t('projects:detail.emptyTasksDescription')}
            action={<Button onClick={() => setIsNewTaskOpen(true)}>{t('projects:detail.createFirstTask')}</Button>}
          />
        ) : (
          <KanbanBoard
            projectId={projectId}
            tasks={tasks}
            onTaskClick={(task) => setSelectedTaskId(task.id)}
            onQuickAdd={(status) => {
              setNewTaskColumn(status);
              setIsNewTaskOpen(true);
            }}
            highlightedTaskId={highlightedTaskId}
            isLead={isLead}
            canManage={canManage}
          />
        )}
      </QueryState>

      <NewTaskModal
        projectId={projectId}
        open={isNewTaskOpen}
        defaultColumn={newTaskColumn}
        onClose={() => {
          setIsNewTaskOpen(false);
          setNewTaskColumn(undefined);
        }}
      />
      <TaskDetailModal
        projectId={projectId}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
      <ProjectMembersModal
        open={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        project={project}
        tasks={tasks}
      />
    </div>
  );
}
