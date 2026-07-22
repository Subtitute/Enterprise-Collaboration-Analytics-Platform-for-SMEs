import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
// 22/07/2026: them QueryState de xu ly nhanh isError cho tasksQuery ben duoi (xem chu thich tai
// vi tri dung).
import { QueryState } from '@/components/ui/QueryState';
import { ChevronLeftIcon, PlusIcon, CheckCircleIcon, CalendarIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import { useProjectQuery, useTasksQuery, useCompleteProject } from './hooks';
import { projectStatusMeta, computeProgressFromTasks } from './utils';
import { KanbanBoard } from './components/KanbanBoard';
import { NewTaskModal } from './components/NewTaskModal';
import { TaskDetailModal } from './components/TaskDetailModal';

export function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const projectQuery = useProjectQuery(projectId);
  const tasksQuery = useTasksQuery(projectId);
  const completeProject = useCompleteProject(projectId);

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (projectQuery.isLoading) return <FullPageSpinner label="Đang tải dự án…" />;
  if (projectQuery.isError || !projectQuery.data) {
    return <EmptyState title="Không tìm thấy dự án" description="Dự án có thể đã bị xoá hoặc bạn không có quyền truy cập." />;
  }

  const project = projectQuery.data;
  const status = projectStatusMeta(project.status);
  const tasks = tasksQuery.data ?? [];
  const progress = project.progress ?? computeProgressFromTasks(tasks);

  return (
    <div className="space-y-5">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeftIcon className="h-4 w-4" /> Quay lại danh sách dự án
      </Link>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          {project.description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{project.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {project.dueDate && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <CalendarIcon className="h-3.5 w-3.5" /> Hạn: {formatDate(project.dueDate)}
              </span>
            )}
            <div className="w-40">
              <ProgressBar value={progress} showLabel />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {project.status !== 'COMPLETED' && (
            <Button variant="outline" onClick={() => completeProject.mutate()} isLoading={completeProject.isPending}>
              <CheckCircleIcon className="h-4 w-4" /> Hoàn thành dự án
            </Button>
          )}
          <Button onClick={() => setIsNewTaskOpen(true)}>
            <PlusIcon className="h-4 w-4" /> Công việc mới
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
        loadingFallback={<FullPageSpinner label="Đang tải công việc…" />}
        errorTitle="Không thể tải công việc"
        errorDescription="Đã xảy ra lỗi khi tải danh sách công việc của dự án. Vui lòng thử lại."
      >
        {tasks.length === 0 ? (
          <EmptyState
            title="Chưa có công việc nào"
            description="Thêm công việc đầu tiên để bắt đầu theo dõi tiến độ dự án."
            action={<Button onClick={() => setIsNewTaskOpen(true)}>Tạo công việc mới</Button>}
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
