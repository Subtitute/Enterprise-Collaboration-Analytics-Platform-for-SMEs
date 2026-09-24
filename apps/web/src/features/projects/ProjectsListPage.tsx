import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { FolderKanbanIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons';
import { useAllTasksQuery, useProjectsQuery } from './hooks';
import { ProjectCard } from './components/ProjectCard';
import { NewProjectModal } from './components/NewProjectModal';
import { computeProgressFromTasks } from './utils';
import { matchesVietnameseSearch, canManageProjects } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { Project } from '@/types';

const LIMIT = 20;
const ORDER_STORAGE_KEY = 'ec_projects_custom_order';

export function ProjectsListPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageProjects(user?.roles);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my-projects'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'all' || tabParam === 'my-projects') return tabParam;
    return canManage ? 'all' : 'my-projects';
  });

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      if (canManage) {
        setIsNewOpen(true);
      }
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canManage]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status')?.toUpperCase() || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [orderedProjects, setOrderedProjects] = useState<Project[]>([]);

  const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: t('projects:list.statusFilter.all') },
    { value: 'ACTIVE', label: t('projects:enums.projectStatus.ACTIVE') },
    { value: 'COMPLETED', label: t('projects:enums.projectStatus.COMPLETED') },
    { value: 'ARCHIVED', label: t('projects:enums.projectStatus.ARCHIVED') },
  ];

  const PRIORITY_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: t('projects:list.priorityFilter.all') },
    { value: 'LOW', label: t('projects:list.priorityFilter.LOW') },
    { value: 'MEDIUM', label: t('projects:list.priorityFilter.MEDIUM') },
    { value: 'HIGH', label: t('projects:list.priorityFilter.HIGH') },
    { value: 'URGENT', label: t('projects:list.priorityFilter.URGENT') },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status, priorityFilter]);

  const projectsQuery = useProjectsQuery({ page, limit: LIMIT, search: search || undefined });
  const tasksQuery = useAllTasksQuery();

  const rawProjects = projectsQuery.data?.data ?? [];

  const [updateTick, setUpdateTick] = useState(0);

  // Lắng nghe sự kiện cập nhật trạng thái hoặc thứ tự dự án từ bất kỳ đâu
  useEffect(() => {
    const handleUpdate = () => setUpdateTick((t) => t + 1);
    window.addEventListener('ec_projects_updated', handleUpdate);
    return () => window.removeEventListener('ec_projects_updated', handleUpdate);
  }, []);

  // Đồng bộ danh sách dự án với thứ tự đã lưu trong localStorage và lọc theo trạng thái + độ ưu tiên
  useEffect(() => {
    if (rawProjects.length === 0) {
      setOrderedProjects([]);
      return;
    }
    try {
      const savedOrder: string[] = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || '[]');
      // 26/08/2026 (fix code review, loi MAJOR - Fix 3): chi con doc `status` (override lac quan cua
      // completeProject()/reopenProject(), xem api.ts) tu metaStore nay - `priority` truoc day cung
      // doc tu day nhung GIO LA truong that tu server (p.priority, xem project.entity.ts) nen loc/
      // sap xep ben duoi doc THANG tu server thay vi override rieng tung trinh duyet.
      const metaStore: Record<string, { status?: string; priority?: string }> = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');

      let list = [...rawProjects];

      // 1. Lọc theo TAB NGỮ CẢNH: "Tất cả dự án" vs "Dự án của tôi"
      if (activeTab === 'my-projects' && user?.id) {
        const myTasks = (tasksQuery.data ?? []).filter((t) =>
          t.assignees?.some((a) => a.userId === user.id)
        );
        const myTaskProjectIds = new Set(myTasks.map((t) => t.projectId));

        list = list.filter((p) => {
          const isLead = p.leadUserId === user.id;
          const isCreator = p.createdByUserId === user.id;
          const hasAssignedTask = myTaskProjectIds.has(p.id);
          return isLead || isCreator || hasAssignedTask;
        });
      }

      // 2. Lọc theo TRẠNG THÁI thực tế (status filter)
      if (status) {
        list = list.filter((p) => {
          const pStatus = metaStore[p.id]?.status ?? p.status;
          return pStatus === status;
        });
      }

      // 2. Lọc theo ĐỘ ƯU TIÊN (priority filter)
      if (priorityFilter) {
        list = list.filter((p) => {
          const pPriority = p.priority ?? metaStore[p.id]?.priority ?? 'MEDIUM';
          return pPriority === priorityFilter;
        });
      }

      const PRIORITY_WEIGHT: Record<string, number> = {
        URGENT: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };

      // 3. Phân chia 2 nhóm: Đang hoạt động (activeList) và Đã hoàn thành (completedList)
      const activeList: typeof list = [];
      const completedList: typeof list = [];

      for (const p of list) {
        const pStatus = metaStore[p.id]?.status ?? p.status;
        if (pStatus === 'COMPLETED') {
          completedList.push(p);
        } else {
          activeList.push(p);
        }
      }

      // 4. Sắp xếp danh sách ĐANG HOẠT ĐỘNG & HOÀN THÀNH:
      const sortGroup = (group: typeof list) => {
        if (savedOrder.length > 0) {
          group.sort((a, b) => {
            const idxA = savedOrder.indexOf(a.id);
            const idxB = savedOrder.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            const weightA = PRIORITY_WEIGHT[a.priority ?? 'MEDIUM'] ?? 2;
            const weightB = PRIORITY_WEIGHT[b.priority ?? 'MEDIUM'] ?? 2;
            return weightB - weightA;
          });
        } else {
          group.sort((a, b) => {
            const weightA = PRIORITY_WEIGHT[a.priority ?? 'MEDIUM'] ?? 2;
            const weightB = PRIORITY_WEIGHT[b.priority ?? 'MEDIUM'] ?? 2;
            return weightB - weightA;
          });
        }
      };

      sortGroup(activeList);
      sortGroup(completedList);

      // 5. Ghép danh sách: Toàn bộ ACTIVE ở trên, toàn bộ COMPLETED LUÔN NẰM DƯỚI CÙNG. Luôn ghép
      // qua activeList/completedList (đã sắp xếp ở bước 4) thay vì dùng thẳng `list` khi có lọc
      // trạng thái - `list` giữ nguyên thứ tự trả về từ server, dùng thẳng sẽ MẤT sắp xếp theo độ
      // ưu tiên/thứ tự đã lưu ngay khi người dùng bật bộ lọc trạng thái.
      let finalSorted = [...activeList, ...completedList];

      // 6. Nếu có tìm kiếm từ khóa, lọc và sắp xếp theo độ khớp tiếng Việt (có dấu hoặc không dấu)
      if (search) {
        finalSorted = finalSorted.filter((p) => matchesVietnameseSearch(p.name, search) || matchesVietnameseSearch(p.description, search));
      }

      setOrderedProjects(finalSorted);
    } catch {
      setOrderedProjects(rawProjects);
    }
  }, [rawProjects, status, priorityFilter, search, activeTab, tasksQuery.data, user?.id, updateTick]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== id && dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const sourceIndex = orderedProjects.findIndex((p) => p.id === draggedId);
    const destIndex = orderedProjects.findIndex((p) => p.id === targetId);

    if (sourceIndex !== -1 && destIndex !== -1) {
      const updated = Array.from(orderedProjects);
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(destIndex, 0, moved);
      setOrderedProjects(updated);
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(updated.map((p) => p.id)));
    }
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const { progressByProject, taskStatsByProject, memberCountByProject } = useMemo(() => {
    const pMap: Record<string, number> = {};
    const statsMap: Record<string, { total: number; completed: number }> = {};
    const membersMap: Record<string, number> = {};
    const tasks = tasksQuery.data ?? [];
    const byProject: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      (byProject[task.projectId] ??= []).push(task);
    }
    for (const [projectId, list] of Object.entries(byProject)) {
      pMap[projectId] = computeProgressFromTasks(list);
      statsMap[projectId] = {
        total: list.length,
        completed: list.filter((t) => t.status === 'DONE').length,
      };
    }
    for (const p of rawProjects) {
      // 22/09/2026: gop leadUserId + TaskAssignee cuc bo (tranh N+1 API rieng cho ProjectMember cua
      // MOI project trong danh sach) roi lay max voi p.memberCount that tu server (TaskAssignee-only,
      // xem ProjectsService.computeProjectStats()) - so lieu chi mang tinh XEM TRUOC o day, con so
      // chinh xac tuyet doi (gom ca ProjectMember rieng, khong gan Task/khong phai lead) hien trong
      // ProjectMembersModal khi mo tung du an.
      const pTasks = byProject[p.id] ?? [];
      const memberSet = new Set<string>();
      if (p.leadUserId) memberSet.add(p.leadUserId);
      for (const task of pTasks) {
        for (const assignee of task.assignees ?? []) {
          if (assignee.userId) memberSet.add(assignee.userId);
        }
      }
      membersMap[p.id] = Math.max(memberSet.size, p.memberCount ?? 0);
    }
    return { progressByProject: pMap, taskStatsByProject: statsMap, memberCountByProject: membersMap };
  }, [tasksQuery.data, rawProjects, updateTick]);

  const meta = projectsQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };
  const hasFilters = Boolean(search || status || priorityFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('projects:list.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('projects:list.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setStatus('');
                setPriorityFilter('');
              }}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              {t('projects:list.viewAll')}
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setIsNewOpen(true)} size="sm">
              <PlusIcon className="h-4 w-4" /> {t('projects:list.newProject')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs chuyển đổi ngữ cảnh: "Tất cả dự án" & "Dự án của tôi" */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            searchParams.set('tab', 'all');
            setSearchParams(searchParams, { replace: true });
          }}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          {t('projects:list.tabs.all')}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('my-projects');
            searchParams.set('tab', 'my-projects');
            setSearchParams(searchParams, { replace: true });
          }}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'my-projects'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          {t('projects:list.tabs.myProjects')}
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('projects:list.searchPlaceholder')}
            aria-label={t('projects:list.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CustomFilterSelect
            value={status}
            onChange={(val) => setStatus(val)}
            ariaLabel={t('projects:list.statusFilter.all')}
            options={STATUS_OPTIONS}
          />
          <CustomFilterSelect
            value={priorityFilter}
            onChange={(val) => setPriorityFilter(val)}
            ariaLabel={t('projects:list.priorityFilter.all')}
            options={PRIORITY_FILTER_OPTIONS}
          />
        </div>
      </div>

      <QueryState
        isLoading={projectsQuery.isLoading}
        isError={projectsQuery.isError}
        onRetry={() => projectsQuery.refetch()}
        loadingFallback={<FullPageSpinner label={t('projects:list.loading')} />}
        errorTitle={t('projects:list.errorTitle')}
        errorDescription={t('projects:list.errorDescription')}
      >
        {orderedProjects.length === 0 ? (
          <EmptyState
            icon={<FolderKanbanIcon className="h-10 w-10" />}
            title={hasFilters ? t('projects:list.emptyFilteredTitle') : t('projects:list.emptyTitle')}
            description={
              hasFilters
                ? t('projects:list.emptyFilteredDescription')
                : t('projects:list.emptyDescription')
            }
            action={!hasFilters && canManage && <Button onClick={() => setIsNewOpen(true)}>{t('projects:list.createFirst')}</Button>}
          />
        ) : (
          <>
            {/* Lưới 3 cột chuẩn CSS Grid tích hợp Kéo thả & Hiệu ứng chuyển động mượt mà */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-300">
              {orderedProjects.map((project) => {
                const isDragging = draggedId === project.id;
                const isOver = dragOverId === project.id;

                return (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, project.id)}
                    onDragOver={(e) => handleDragOver(e, project.id)}
                    onDrop={(e) => handleDrop(e, project.id)}
                    onDragEnd={handleDragEnd}
                    className={`animate-fade-in transition-all duration-300 ease-out transform ${
                      isDragging ? 'opacity-40 scale-95 ring-2 ring-primary-500 rounded-xl' : 'opacity-100 scale-100'
                    } ${isOver ? 'scale-[1.02] ring-2 ring-primary-400/80 rounded-xl' : ''}`}
                  >
                    <ProjectCard
                      project={project}
                      progress={project.completionRate ?? project.progress ?? progressByProject[project.id] ?? 0}
                      memberCount={memberCountByProject[project.id] ?? project.memberCount}
                      taskCount={taskStatsByProject[project.id]?.total}
                      completedTaskCount={taskStatsByProject[project.id]?.completed}
                    />
                  </div>
                );
              })}
            </div>

            <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </QueryState>

      <NewProjectModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
