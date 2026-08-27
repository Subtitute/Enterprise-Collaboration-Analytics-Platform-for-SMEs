import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
// 22/07/2026: them QueryState de xu ly nhanh isError cho tasksQuery ben duoi (xem chu thich tai
// vi tri dung).
import { QueryState } from '@/components/ui/QueryState';
import { ChevronLeftIcon, PlusIcon, CheckCircleIcon, CalendarIcon, RefreshIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import { useProjectQuery, useTasksQuery, useCompleteProject, useReopenProject } from './hooks';
import { projectStatusMeta, computeProgressFromTasks, projectPriorityMeta } from './utils';
import { KanbanBoard } from './components/KanbanBoard';
import { NewTaskModal } from './components/NewTaskModal';
import { TaskDetailModal } from './components/TaskDetailModal';

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const projectQuery = useProjectQuery(projectId);
  const tasksQuery = useTasksQuery(projectId);
  const completeProject = useCompleteProject(projectId);
  const reopenProject = useReopenProject(projectId);

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
  const projectMeta: { status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' } = (() => {
    try {
      const meta = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
      return meta[project.id] ?? {};
    } catch {
      return {};
    }
  })();

  const currentStatus = projectMeta.status ?? project.status;
  const status = projectStatusMeta(currentStatus);
  const tasks = tasksQuery.data ?? [];
  const progress = project.progress ?? computeProgressFromTasks(tasks);

  const statusDotColor =
    currentStatus === 'COMPLETED'
      ? 'bg-emerald-500 ring-emerald-200'
      : currentStatus === 'ACTIVE'
        ? 'bg-primary-500 ring-primary-200'
        : 'bg-slate-400 ring-slate-200';

  // 26/08/2026: chuyen sang dung projectPriorityMeta() dung chung trong ./utils.ts (xem ghi chu tai
  // do) thay vi tu khai bao object nhan cung dinh o day - fix check-hardcoded-vietnamese.js.
  const priorityMeta = projectPriorityMeta(project.priority ?? 'MEDIUM');

  return (
    <div className="space-y-5">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ChevronLeftIcon className="h-4 w-4" /> {t('projects:detail.backToList')}
      </Link>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center shadow-xs">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
            {project.priority && (
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold border ${priorityMeta.color}`}>
                {priorityMeta.label}
              </span>
            )}
            <Badge variant={status.variant} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold shadow-xs">
              <span className={`h-1.5 w-1.5 rounded-full ring-2 ${statusDotColor}`} />
              <span>{status.label}</span>
            </Badge>
          </div>
          {project.description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{project.description}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-4">
            {project.dueDate && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <CalendarIcon className="h-3.5 w-3.5" /> {t('projects:detail.dueDate', { date: formatDate(project.dueDate) })}
              </span>
            )}
            <div className="w-40">
              <ProgressBar value={progress} showLabel />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentStatus !== 'COMPLETED' ? (
            <Button variant="outline" onClick={() => completeProject.mutate()} isLoading={completeProject.isPending}>
              <CheckCircleIcon className="h-4 w-4" /> {t('projects:detail.completeProject')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => reopenProject.mutate()} isLoading={reopenProject.isPending}>
              <RefreshIcon className="h-4 w-4 text-primary-600" /> {t('projects:detail.reopenProject')}
            </Button>
          )}
          <Button onClick={() => setIsNewTaskOpen(true)}>
            <PlusIcon className="h-4 w-4" /> {t('projects:detail.newTask')}
          </Button>
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
          <KanbanBoard projectId={projectId} tasks={tasks} onTaskClick={(task) => setSelectedTaskId(task.id)} />
        )}
      </QueryState>

      <NewTaskModal projectId={projectId} open={isNewTaskOpen} onClose={() => setIsNewTaskOpen(false)} />
      <TaskDetailModal projectId={projectId} taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
}
