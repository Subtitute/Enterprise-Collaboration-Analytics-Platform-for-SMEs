import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Input';
import { FolderKanbanIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons';
import { useAllTasksQuery, useProjectsQuery } from './hooks';
import { ProjectCard } from './components/ProjectCard';
import { NewProjectModal } from './components/NewProjectModal';
import { computeProgressFromTasks } from './utils';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
];

export function ProjectsListPage() {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // Debounce 400ms de khong goi API lien tuc theo tung ky tu go (Wireframe.md muc 4.1:
  // "[Tim kiem du an___] [Trang thai v]", khong con bo loc "Phong ban" - xem ghi chu 21/07/2026).
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const projectsQuery = useProjectsQuery({ limit: 100, search: search || undefined, status: status || undefined });
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
  const hasFilters = Boolean(search || status);

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm kiếm dự án…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" style={{ width: 'auto' }}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <QueryState
        isLoading={projectsQuery.isLoading}
        isError={projectsQuery.isError}
        onRetry={() => projectsQuery.refetch()}
        loadingFallback={<FullPageSpinner label="Đang tải danh sách dự án…" />}
        errorTitle="Không thể tải danh sách dự án"
        errorDescription="Đã xảy ra lỗi khi tải danh sách dự án. Vui lòng thử lại."
      >
        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanbanIcon className="h-10 w-10" />}
            title={hasFilters ? 'Không tìm thấy dự án phù hợp' : 'Chưa có dự án nào'}
            description={
              hasFilters
                ? 'Thử điều chỉnh từ khóa tìm kiếm hoặc trạng thái đã chọn.'
                : 'Tạo dự án đầu tiên để bắt đầu phân chia công việc cho nhóm của bạn.'
            }
            action={!hasFilters && <Button onClick={() => setIsNewOpen(true)}>Tạo dự án mới</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                progress={project.completionRate ?? project.progress ?? progressByProject[project.id] ?? 0}
                memberCount={project.memberCount}
              />
            ))}
          </div>
        )}
      </QueryState>

      <NewProjectModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
