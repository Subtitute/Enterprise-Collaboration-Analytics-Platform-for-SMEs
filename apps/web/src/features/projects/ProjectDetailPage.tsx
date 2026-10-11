import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
// 22/07/2026: them QueryState de xu ly nhanh isError cho tasksQuery ben duoi (xem chu thich tai
// vi tri dung).
import { QueryState } from '@/components/ui/QueryState';
import { ChevronLeftIcon, PlusIcon, CheckCircleIcon, RefreshIcon } from '@/components/ui/Icons';
import { cn, canManageProjects } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useProjectQuery, useTasksQuery, useCompleteProject, useReopenProject, useProjectMembersQuery } from './hooks';
import { projectStatusMeta, computeProgressFromTasks } from './utils';
import { KanbanBoard } from './components/KanbanBoard';
import { NewTaskModal } from './components/NewTaskModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { ProjectMembersModal } from './components/ProjectMembersModal';
import { ProjectSummaryCards } from './components/ProjectSummaryCards';
import { toast } from '@/stores/toast.store';
import type { Task, TaskStatus } from '@/types';

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

  const user = useAuthStore((s) => s.user);
  const canManage = canManageProjects(user?.roles);

  const handleOpenMembersModal = useCallback(() => setIsMembersModalOpen(true), []);
  const handleCloseMembersModal = useCallback(() => setIsMembersModalOpen(false), []);
  const handleTaskClick = useCallback((task: Task) => setSelectedTaskId(task.id), []);
  const handleQuickAdd = useCallback((status: TaskStatus) => {
    setNewTaskColumn(status);
    setIsNewTaskOpen(true);
  }, []);
  const handleCloseTaskDetail = useCallback(() => setSelectedTaskId(null), []);
  const handleCloseNewTask = useCallback(() => {
    setIsNewTaskOpen(false);
    setNewTaskColumn(undefined);
  }, []);

  if (projectQuery.isLoading) return <FullPageSpinner label={t('projects:detail.loading')} />;
  if (projectQuery.isError || !projectQuery.data) {
    return <EmptyState title={t('projects:detail.notFoundTitle')} description={t('projects:detail.notFoundDescription')} />;
  }

  const project = projectQuery.data;

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

  const priorityConfig = {
    LOW: { label: t('projects:newProjectModal.priorities.LOW', 'Thấp'), className: 'bg-[#FAF9F6] text-[#8A8781]' },
    MEDIUM: { label: t('projects:newProjectModal.priorities.MEDIUM', 'Trung bình'), className: 'bg-[#EFEDE8] text-[#5C5A55]' },
    HIGH: { label: t('projects:newProjectModal.priorities.HIGH', 'Cao'), className: 'bg-[#FBEEE0] text-[#B45309]' },
    URGENT: { label: t('projects:newProjectModal.priorities.URGENT', 'Khẩn cấp'), className: 'bg-[#F8E5E3] text-[#B3261E]' },
  }[currentPriority] ?? { label: t('projects:newProjectModal.priorities.MEDIUM', 'Trung bình'), className: 'bg-[#EFEDE8] text-[#5C5A55]' };

  const isHundredPercent = Math.round(progress || 0) >= 100 || currentStatus === 'COMPLETED';
  const progressFillColor = isHundredPercent ? 'bg-[#2F6F44]' : 'bg-[#0E5E5E]';

  return (
    <div className="space-y-5">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-[13px] font-normal text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5 text-text-tertiary" /> {t('projects:detail.backToList', 'Quay lại danh sách dự án')}
      </Link>

      <div className="rounded-radius-lg border border-border-subtle bg-white p-5 space-y-5">
        {/* Hàng 1: Tiêu đề, Badge độ ưu tiên, Badge trạng thái (bên trái) + 2 Nút hành động (bên phải) */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-sans text-[22px] leading-[30px] font-semibold tracking-tight text-text-primary break-words">
                {project.name}
              </h1>
              <span className={cn('shrink-0 rounded-[2px] px-2 py-0.5 text-[11px] font-semibold leading-normal', priorityConfig.className)}>
                {priorityConfig.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-normal',
                  currentStatus === 'COMPLETED'
                    ? 'bg-[#E6F1E9] text-[#2F6F44]'
                    : currentStatus === 'ARCHIVED'
                    ? 'bg-[#EFEDE8] text-[#8A8781]'
                    : 'bg-[#E4EFEE] text-[#0E5E5E]'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    currentStatus === 'COMPLETED'
                      ? 'bg-[#2F6F44]'
                      : currentStatus === 'ARCHIVED'
                      ? 'bg-[#8A8781]'
                      : 'bg-[#0E5E5E]'
                  )}
                />
                <span>{status.label}</span>
              </span>
            </div>
            {project.description && (
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-secondary break-words">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 w-full sm:w-auto">
            {canManage && (
              currentStatus !== 'COMPLETED' ? (
                <button
                  type="button"
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
                  disabled={completeProject.isPending}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-radius-md border border-border-strong bg-white text-[13px] font-medium text-text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircleIcon className="h-4 w-4 text-[#2F6F44]" /> {t('projects:detail.completeProject')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => reopenProject.mutate()}
                  disabled={reopenProject.isPending}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-radius-md border border-border-strong bg-white text-[13px] font-medium text-text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshIcon className="h-4 w-4 text-text-secondary" /> {t('projects:detail.reopenProject')}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setIsNewTaskOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-radius-md bg-[#1C1B1A] text-white text-[13px] font-medium hover:bg-[#2E2C29] transition-colors cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" /> {t('projects:detail.newTask')}
            </button>
          </div>
        </div>

        {/* Hàng 2: 3 Summary Cards (§3.1) */}
        <ProjectSummaryCards
          dueDate={project.dueDate}
          progress={progress}
          progressFillColor={progressFillColor}
          leadUserId={project.leadUserId}
          tasks={tasks}
          projectMembers={projectMembersQuery.data}
          allUsers={orgUsersQuery.data}
          onOpenMembersModal={handleOpenMembersModal}
        />
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
            onTaskClick={handleTaskClick}
            onQuickAdd={handleQuickAdd}
            highlightedTaskId={highlightedTaskId}
          />
        )}
      </QueryState>

      <NewTaskModal
        projectId={projectId}
        open={isNewTaskOpen}
        defaultColumn={newTaskColumn}
        onClose={handleCloseNewTask}
      />
      <TaskDetailModal
        projectId={projectId}
        taskId={selectedTaskId}
        onClose={handleCloseTaskDetail}
      />
      <ProjectMembersModal
        open={isMembersModalOpen}
        onClose={handleCloseMembersModal}
        project={project}
        tasks={tasks}
      />
    </div>
  );
}
