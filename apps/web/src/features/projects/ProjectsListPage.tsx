import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

export function ProjectsListPage() {
  const { t } = useTranslation();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: t('projects:list.statusFilter.all') },
    { value: 'ACTIVE', label: t('projects:enums.projectStatus.ACTIVE') },
    { value: 'COMPLETED', label: t('projects:enums.projectStatus.COMPLETED') },
    { value: 'ARCHIVED', label: t('projects:enums.projectStatus.ARCHIVED') },
  ];

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
    for (const task of tasks) {
      (byProject[task.projectId] ??= []).push(task);
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
          <h1 className="text-xl font-semibold text-slate-900">{t('projects:list.title')}</h1>
          <p className="text-sm text-slate-500">{t('projects:list.subtitle')}</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)}>
          <PlusIcon className="h-4 w-4" /> {t('projects:list.newProject')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('projects:list.searchPlaceholder')}
            // 28/07/2026: them aria-label khop voi placeholder (phat hien qua ra soat kha nang tiep
            // can) - placeholder bien mat ngay khi go chu va khong phai luon duoc trinh doc man hinh
            // dung lam ten truy cap, nen can aria-label rieng.
            aria-label={t('projects:list.searchPlaceholder')}
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
        loadingFallback={<FullPageSpinner label={t('projects:list.loading')} />}
        errorTitle={t('projects:list.errorTitle')}
        errorDescription={t('projects:list.errorDescription')}
      >
        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanbanIcon className="h-10 w-10" />}
            title={hasFilters ? t('projects:list.emptyFilteredTitle') : t('projects:list.emptyTitle')}
            description={
              hasFilters
                ? t('projects:list.emptyFilteredDescription')
                : t('projects:list.emptyDescription')
            }
            action={!hasFilters && <Button onClick={() => setIsNewOpen(true)}>{t('projects:list.createFirst')}</Button>}
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
