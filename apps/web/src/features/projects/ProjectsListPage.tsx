import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { FolderKanbanIcon, PlusIcon } from '@/components/ui/Icons';
import { useAllTasksQuery, useProjectsQuery } from './hooks';
import { ProjectCard } from './components/ProjectCard';
import { NewProjectModal } from './components/NewProjectModal';
import { computeProgressFromTasks } from './utils';

export function ProjectsListPage() {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const projectsQuery = useProjectsQuery({ limit: 100 });
  const tasksQuery = useAllTasksQuery();

  const progressByProject = useMemo(() => {
    const map: Record<string, number> = {};
    const tasks = tasksQuery.data ?? [];
    const byProject: Record<string, typeof tasks> = {};
    for (const t of tasks) {
      (byProject[t.projectId] ??= []).push(t);
    }
    for (const [projectId, list] of Object.entries(byProject)) {
      map[projectId] = computeProgressFromTasks(list);
    }
    return map;
  }, [tasksQuery.data]);

  const projects = projectsQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dự án &amp; Công việc</h1>
          <p className="text-sm text-slate-500">Quản lý dự án và theo dõi tiến độ công việc dạng Kanban.</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)}>
          <PlusIcon className="h-4 w-4" /> Dự án mới
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <FullPageSpinner label="Đang tải danh sách dự án…" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanbanIcon className="h-10 w-10" />}
          title="Chưa có dự án nào"
          description="Tạo dự án đầu tiên để bắt đầu phân chia công việc cho nhóm của bạn."
          action={<Button onClick={() => setIsNewOpen(true)}>Tạo dự án mới</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} progress={project.progress ?? progressByProject[project.id] ?? 0} />
          ))}
        </div>
      )}

      <NewProjectModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
